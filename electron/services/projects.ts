import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { settings } from './settings';

const execAsync = promisify(exec);
const fsPromises = fs.promises;

export interface Project {
  id: string;
  name: string;
  path: string;
  hasBeads: boolean;
  lastModified?: string;
  gitRemote?: string;
  gitBranch?: string;
}

export interface ClaudeSession {
  pid: number;
  workingDir: string;
  projectName?: string;
  command: string;
  startTime?: string;
}

// Generate a simple ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Get stored projects
export function getProjects(): Project[] {
  return (settings.get('projects') as Project[]) || [];
}

// Add a project
export async function addProject(projectPath: string): Promise<Project> {
  const projects = getProjects();

  // Check if already exists
  const existing = projects.find(p => p.path === projectPath);
  if (existing) {
    return existing;
  }

  const project = await scanProject(projectPath);
  projects.push(project);
  settings.set('projects', projects);
  return project;
}

// Remove a project
export function removeProject(projectId: string): void {
  const projects = getProjects();
  const filtered = projects.filter(p => p.id !== projectId);
  settings.set('projects', filtered);
}

// Scan a single project for details
export async function scanProject(projectPath: string): Promise<Project> {
  const name = path.basename(projectPath);
  const project: Project = {
    id: generateId(),
    name,
    path: projectPath,
    hasBeads: false,
  };

  try {
    // Check for .beads folder
    const beadsPath = path.join(projectPath, '.beads', 'beads.jsonl');
    try {
      await fsPromises.access(beadsPath);
      project.hasBeads = true;
    } catch {
      project.hasBeads = false;
    }

    // Get git info
    try {
      const { stdout: remote } = await execAsync('git remote get-url origin', {
        cwd: projectPath,
        timeout: 5000,
      });
      project.gitRemote = remote.trim();
    } catch {
      // No remote
    }

    try {
      const { stdout: branch } = await execAsync('git branch --show-current', {
        cwd: projectPath,
        timeout: 5000,
      });
      project.gitBranch = branch.trim();
    } catch {
      // Not a git repo or error
    }

    // Get last modified time
    try {
      const stats = await fsPromises.stat(projectPath);
      project.lastModified = stats.mtime.toISOString();
    } catch {
      // Ignore
    }
  } catch (err) {
    console.error(`Error scanning project ${projectPath}:`, err);
  }

  return project;
}

// Refresh all projects
export async function refreshProjects(): Promise<Project[]> {
  const projects = getProjects();
  const refreshed: Project[] = [];

  for (const project of projects) {
    try {
      const updated = await scanProject(project.path);
      updated.id = project.id; // Keep the same ID
      refreshed.push(updated);
    } catch {
      // Keep the old project info if scan fails
      refreshed.push(project);
    }
  }

  settings.set('projects', refreshed);
  return refreshed;
}

// Auto-discover git repos in common locations
export async function discoverGitRepos(): Promise<Project[]> {
  const discovered: Project[] = [];
  const homeDir = app.getPath('home');

  // Common development directories to scan
  const scanDirs = [
    path.join(homeDir, 'git'),
    path.join(homeDir, 'repos'),
    path.join(homeDir, 'projects'),
    path.join(homeDir, 'dev'),
    path.join(homeDir, 'code'),
    path.join(homeDir, 'src'),
    path.join(homeDir, 'workspace'),
    path.join(homeDir, 'GitHub'),
    path.join(homeDir, 'Documents', 'GitHub'),
    path.join(homeDir, 'Documents', 'git'),
    path.join(homeDir, 'Documents', 'projects'),
  ];

  // Also check WSL paths if on Windows
  if (process.platform === 'win32') {
    scanDirs.push(
      'C:\\git',
      'C:\\repos',
      'C:\\projects',
      'C:\\dev',
    );
  }

  for (const dir of scanDirs) {
    try {
      await fsPromises.access(dir);
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const repoPath = path.join(dir, entry.name);
          const gitPath = path.join(repoPath, '.git');

          try {
            await fsPromises.access(gitPath);
            // It's a git repo
            const project = await scanProject(repoPath);
            discovered.push(project);
          } catch {
            // Not a git repo, skip
          }
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return discovered;
}

// Detect running Claude Code sessions
export async function detectClaudeSessions(): Promise<ClaudeSession[]> {
  const sessions: ClaudeSession[] = [];

  try {
    if (process.platform === 'win32') {
      // Windows: Use WMIC or PowerShell
      try {
        const { stdout } = await execAsync(
          'powershell -Command "Get-Process | Where-Object {$_.ProcessName -like \'*claude*\' -or $_.ProcessName -like \'*node*\'} | Select-Object Id,ProcessName,Path,StartTime | ConvertTo-Json"',
          { timeout: 10000 }
        );

        if (stdout.trim()) {
          const processes = JSON.parse(stdout);
          const procList = Array.isArray(processes) ? processes : [processes];

          for (const proc of procList) {
            if (proc.Path && (proc.Path.includes('claude') || proc.ProcessName === 'claude')) {
              sessions.push({
                pid: proc.Id,
                workingDir: path.dirname(proc.Path),
                command: proc.ProcessName,
                startTime: proc.StartTime,
              });
            }
          }
        }
      } catch {
        // Try wmic as fallback
        const { stdout } = await execAsync(
          'wmic process where "name like \'%claude%\'" get processid,commandline,creationdate /format:csv',
          { timeout: 10000 }
        );

        const lines = stdout.trim().split('\n').slice(1);
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 3) {
            sessions.push({
              pid: parseInt(parts[2]) || 0,
              workingDir: '',
              command: parts[1] || 'claude',
            });
          }
        }
      }
    } else {
      // Unix-like: Use ps
      const { stdout } = await execAsync(
        'ps aux | grep -E "claude|claude-code" | grep -v grep',
        { timeout: 5000 }
      );

      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 11) {
          const pid = parseInt(parts[1]);
          const command = parts.slice(10).join(' ');

          // Try to get the working directory
          let workingDir = '';
          try {
            const { stdout: cwd } = await execAsync(`lsof -p ${pid} | grep cwd | awk '{print $9}'`, { timeout: 2000 });
            workingDir = cwd.trim();
          } catch {
            // Try /proc on Linux
            try {
              workingDir = await fsPromises.readlink(`/proc/${pid}/cwd`);
            } catch {
              // Ignore
            }
          }

          sessions.push({
            pid,
            workingDir,
            command,
          });
        }
      }
    }

    // Match sessions to known projects
    const projects = getProjects();
    for (const session of sessions) {
      if (session.workingDir) {
        const project = projects.find(p =>
          session.workingDir.startsWith(p.path) ||
          p.path.startsWith(session.workingDir)
        );
        if (project) {
          session.projectName = project.name;
        }
      }
    }
  } catch (err) {
    console.error('Error detecting Claude sessions:', err);
  }

  return sessions;
}

// Get combined status
export async function getSystemStatus(): Promise<{
  projects: Project[];
  sessions: ClaudeSession[];
  discovered: Project[];
}> {
  const [projects, sessions, discovered] = await Promise.all([
    refreshProjects(),
    detectClaudeSessions(),
    discoverGitRepos(),
  ]);

  // Filter out already-added projects from discovered
  const existingPaths = new Set(projects.map(p => p.path));
  const newDiscovered = discovered.filter(d => !existingPaths.has(d.path));

  return {
    projects,
    sessions,
    discovered: newDiscovered,
  };
}
