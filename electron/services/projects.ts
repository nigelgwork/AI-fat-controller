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
  hasClaude: boolean;
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
  source: 'windows' | 'wsl' | 'history';
  status: 'running' | 'recent';
  sessionId?: string;
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
    hasClaude: false,
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

    // Check for CLAUDE.md file
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    try {
      await fsPromises.access(claudeMdPath);
      project.hasClaude = true;
    } catch {
      project.hasClaude = false;
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

// Discover git repos in WSL
async function discoverWslGitRepos(): Promise<Project[]> {
  const discovered: Project[] = [];

  if (process.platform !== 'win32') {
    return discovered;
  }

  // Common WSL development directories
  const wslDirs = [
    '~/git',
    '~/repos',
    '~/projects',
    '~/dev',
    '~/code',
    '~/src',
    '~/workspace',
    '/git',
  ];

  try {
    // Find git repos in WSL using a single command
    const findCmd = wslDirs.map(d => `find ${d} -maxdepth 2 -name .git -type d 2>/dev/null`).join('; ');
    const { stdout } = await execAsync(
      `wsl.exe -e bash -c "${findCmd}"`,
      { timeout: 30000 }
    );

    if (stdout.trim()) {
      const gitDirs = stdout.trim().split('\n').filter(Boolean);

      for (const gitDir of gitDirs) {
        // gitDir is like /home/user/git/project/.git
        const repoPath = gitDir.replace(/\/.git$/, '');
        const repoName = path.basename(repoPath);

        // Convert WSL path to Windows path for display
        let windowsPath = repoPath;
        try {
          const { stdout: winPath } = await execAsync(
            `wsl.exe -e wslpath -w "${repoPath}"`,
            { timeout: 5000 }
          );
          windowsPath = winPath.trim();
        } catch {
          // Keep the WSL path
        }

        // Check for CLAUDE.md and .beads
        let hasClaude = false;
        let hasBeads = false;
        try {
          const { stdout: checkResult } = await execAsync(
            `wsl.exe -e bash -c "[ -f '${repoPath}/CLAUDE.md' ] && echo 'claude'; [ -d '${repoPath}/.beads' ] && echo 'beads'"`,
            { timeout: 5000 }
          );
          hasClaude = checkResult.includes('claude');
          hasBeads = checkResult.includes('beads');
        } catch {
          // Ignore
        }

        // Get git info
        let gitBranch = '';
        let gitRemote = '';
        try {
          const { stdout: branchOut } = await execAsync(
            `wsl.exe -e git -C "${repoPath}" branch --show-current`,
            { timeout: 5000 }
          );
          gitBranch = branchOut.trim();
        } catch {
          // Ignore
        }
        try {
          const { stdout: remoteOut } = await execAsync(
            `wsl.exe -e git -C "${repoPath}" remote get-url origin 2>/dev/null`,
            { timeout: 5000 }
          );
          gitRemote = remoteOut.trim();
        } catch {
          // Ignore
        }

        discovered.push({
          id: generateId(),
          name: `(WSL) ${repoName}`,
          path: windowsPath,
          hasBeads,
          hasClaude,
          gitBranch,
          gitRemote,
        });
      }
    }
  } catch (err) {
    console.error('WSL git repo discovery failed:', err);
  }

  return discovered;
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

  // Also check Windows paths
  if (process.platform === 'win32') {
    scanDirs.push(
      'C:\\git',
      'C:\\repos',
      'C:\\projects',
      'C:\\dev',
    );
  }

  // Scan Windows/native paths
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

  // Also scan WSL paths on Windows
  if (process.platform === 'win32') {
    try {
      const wslRepos = await discoverWslGitRepos();
      discovered.push(...wslRepos);
    } catch (err) {
      console.error('WSL discovery failed:', err);
    }
  }

  return discovered;
}

// Scan ~/.claude/projects/ for recent session files
async function getRecentSessionsFromHistory(): Promise<ClaudeSession[]> {
  const sessions: ClaudeSession[] = [];
  const homeDir = app.getPath('home');
  const projectsDir = path.join(homeDir, '.claude', 'projects');

  try {
    await fsPromises.access(projectsDir);
  } catch {
    return sessions;
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  try {
    const entries = await fsPromises.readdir(projectsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sessionDir = path.join(projectsDir, entry.name);

      try {
        const files = await fsPromises.readdir(sessionDir);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

        for (const file of jsonlFiles) {
          const filePath = path.join(sessionDir, file);

          try {
            const stats = await fsPromises.stat(filePath);
            if (stats.mtime.getTime() < oneDayAgo) continue;

            // Parse the first line for session metadata
            const content = await fsPromises.readFile(filePath, 'utf-8');
            const firstLine = content.split('\n')[0];

            if (firstLine) {
              try {
                const meta = JSON.parse(firstLine);
                const sessionId = path.basename(file, '.jsonl');

                // Decode project path from directory name
                let workingDir = '';
                try {
                  workingDir = decodeURIComponent(entry.name.replace(/-/g, '/'));
                  if (!workingDir.startsWith('/') && !workingDir.match(/^[A-Za-z]:/)) {
                    workingDir = '/' + workingDir;
                  }
                } catch {
                  workingDir = entry.name;
                }

                sessions.push({
                  pid: 0,
                  workingDir,
                  projectName: path.basename(workingDir),
                  command: 'Recent session',
                  startTime: stats.mtime.toISOString(),
                  source: 'history',
                  status: 'recent',
                  sessionId,
                });
              } catch {
                // Invalid JSON, skip
              }
            }
          } catch {
            // Can't read file, skip
          }
        }
      } catch {
        // Can't read session dir, skip
      }
    }
  } catch (err) {
    console.error('Error reading session history:', err);
  }

  // Sort by start time, newest first
  sessions.sort((a, b) => {
    if (!a.startTime || !b.startTime) return 0;
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });

  // Return only the 10 most recent
  return sessions.slice(0, 10);
}

// Detect running Claude Code sessions
export async function detectClaudeSessions(): Promise<ClaudeSession[]> {
  const sessions: ClaudeSession[] = [];
  const runningPids = new Set<number>();

  try {
    if (process.platform === 'win32') {
      // Windows: Use Get-CimInstance (modern) for broader process detection
      // Search for @anthropic-ai, claude-code, or claude in command line
      try {
        const { stdout } = await execAsync(
          `powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -like '*@anthropic-ai*' -or $_.CommandLine -like '*claude-code*' -or $_.Name -like 'claude*') } | Select-Object ProcessId,Name,CommandLine,CreationDate | ConvertTo-Json"`,
          { timeout: 15000 }
        );

        if (stdout.trim()) {
          let processes;
          try {
            processes = JSON.parse(stdout);
          } catch {
            processes = [];
          }
          const procList = Array.isArray(processes) ? processes : [processes];
          const seenPids = new Set<number>();

          for (const proc of procList) {
            if (!proc.ProcessId || seenPids.has(proc.ProcessId)) continue;

            const cmdLine = proc.CommandLine || '';
            const procName = proc.Name || '';

            // Skip Electron/Desktop app processes
            if (cmdLine.includes('AnthropicClaude') ||
                cmdLine.includes('--type=') ||
                cmdLine.includes('crashpad') ||
                cmdLine.includes('electron') ||
                procName.toLowerCase().includes('anthropicclaude')) {
              continue;
            }

            // Must have some indication it's Claude Code CLI
            const lowerCmd = cmdLine.toLowerCase();
            if (!lowerCmd.includes('@anthropic-ai') &&
                !lowerCmd.includes('claude-code') &&
                !lowerCmd.includes('claude') &&
                !lowerCmd.includes('cli.js')) {
              continue;
            }

            seenPids.add(proc.ProcessId);
            runningPids.add(proc.ProcessId);

            // Try to extract working directory from command line
            let workingDir = '';

            // Look for --cwd, --project, or -p flags
            const cwdMatch = cmdLine.match(/(?:--cwd|--project|-p)[=\s]["']?([A-Za-z]:[^"'\s]+|\/[^"'\s]+)["']?/i);
            if (cwdMatch) {
              workingDir = cwdMatch[1];
            }

            // Also try to find path in the command line
            if (!workingDir) {
              const pathMatch = cmdLine.match(/(?:cd\s+|cwd[=:]\s*)["']?([A-Za-z]:[\\\/][^"'\s]+)["']?/i);
              if (pathMatch) {
                workingDir = pathMatch[1];
              }
            }

            // Parse start time from WMI date format
            let startTime = '';
            if (proc.CreationDate) {
              // CIM returns ISO format or WMI format
              if (typeof proc.CreationDate === 'string') {
                if (proc.CreationDate.includes('T')) {
                  startTime = proc.CreationDate;
                } else {
                  const match = proc.CreationDate.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
                  if (match) {
                    const date = new Date(
                      parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
                      parseInt(match[4]), parseInt(match[5]), parseInt(match[6])
                    );
                    startTime = date.toISOString();
                  }
                }
              }
            }

            // Extract meaningful part of command for display
            let displayCmd = 'Claude Code CLI';
            if (cmdLine.includes('--print') || cmdLine.match(/-p\s+["']/)) {
              displayCmd = 'Claude Code (one-shot)';
            } else if (cmdLine.includes('--resume') || cmdLine.includes('-r')) {
              displayCmd = 'Claude Code (resumed session)';
            } else if (cmdLine.includes('--continue') || cmdLine.includes('-c')) {
              displayCmd = 'Claude Code (continued)';
            }

            sessions.push({
              pid: proc.ProcessId,
              workingDir,
              command: displayCmd,
              startTime,
              source: 'windows',
              status: 'running',
            });
          }
        }
      } catch (err) {
        console.error('PowerShell detection failed:', err);
      }

      // Also check WSL for Claude Code sessions using pgrep
      try {
        const { stdout: wslOutput } = await execAsync(
          'wsl.exe -e bash -c "pgrep -af claude 2>/dev/null || pgrep -af @anthropic-ai 2>/dev/null || true"',
          { timeout: 10000 }
        );

        if (wslOutput.trim()) {
          const lines = wslOutput.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;

            const match = line.match(/^(\d+)\s+(.+)$/);
            if (!match) continue;

            const pid = parseInt(match[1]);
            const command = match[2];

            // Skip if not actually claude CLI
            const lowerCmd = command.toLowerCase();
            if (!lowerCmd.includes('claude') && !lowerCmd.includes('@anthropic-ai')) {
              continue;
            }

            // Skip grep processes
            if (command.includes('grep') || command.includes('pgrep')) {
              continue;
            }

            runningPids.add(pid);

            // Try to get working directory
            let workingDir = '';
            try {
              const { stdout: cwd } = await execAsync(
                `wsl.exe -e bash -c "readlink -f /proc/${pid}/cwd 2>/dev/null"`,
                { timeout: 3000 }
              );
              workingDir = cwd.trim();
            } catch {
              // Ignore
            }

            sessions.push({
              pid,
              workingDir: workingDir || '(WSL)',
              command: 'Claude Code CLI (WSL)',
              source: 'wsl',
              status: 'running',
            });
          }
        }
      } catch {
        // WSL not available or no sessions
      }
    } else {
      // Unix-like: Use pgrep for more reliable detection
      try {
        const { stdout } = await execAsync(
          'pgrep -af "claude|@anthropic-ai" 2>/dev/null || true',
          { timeout: 5000 }
        );

        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          const match = line.match(/^(\d+)\s+(.+)$/);
          if (!match) continue;

          const pid = parseInt(match[1]);
          const command = match[2];

          // Skip grep/pgrep processes
          if (command.includes('grep') || command.includes('pgrep')) {
            continue;
          }

          runningPids.add(pid);

          // Try to get the working directory
          let workingDir = '';
          try {
            workingDir = await fsPromises.readlink(`/proc/${pid}/cwd`);
          } catch {
            try {
              const { stdout: cwd } = await execAsync(`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $9}'`, { timeout: 2000 });
              workingDir = cwd.trim();
            } catch {
              // Ignore
            }
          }

          sessions.push({
            pid,
            workingDir,
            command,
            source: process.platform === 'linux' ? 'wsl' : 'windows',
            status: 'running',
          });
        }
      } catch {
        // pgrep failed
      }
    }

    // Add recent sessions from history
    const historySessions = await getRecentSessionsFromHistory();
    for (const histSession of historySessions) {
      // Check if this session is still running (by matching working directory)
      const isRunning = sessions.some(s =>
        s.workingDir && histSession.workingDir &&
        s.workingDir.toLowerCase() === histSession.workingDir.toLowerCase()
      );

      if (!isRunning) {
        sessions.push(histSession);
      }
    }

    // Match sessions to known projects
    const projects = getProjects();
    for (const session of sessions) {
      if (session.workingDir && !session.projectName) {
        const project = projects.find(p =>
          session.workingDir.toLowerCase().includes(p.path.toLowerCase()) ||
          p.path.toLowerCase().includes(session.workingDir.toLowerCase())
        );
        if (project) {
          session.projectName = project.name;
        }
      }

      // Also try to extract project name from command line
      if (!session.projectName && session.command) {
        for (const project of projects) {
          if (session.command.toLowerCase().includes(project.name.toLowerCase())) {
            session.projectName = project.name;
            break;
          }
        }
      }

      // Fallback: extract from working directory
      if (!session.projectName && session.workingDir) {
        session.projectName = path.basename(session.workingDir);
      }
    }
  } catch (err) {
    console.error('Error detecting Claude sessions:', err);
  }

  // Sort: running first, then recent; within each group, by start time
  sessions.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'running' ? -1 : 1;
    }
    if (!a.startTime && !b.startTime) return 0;
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });

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
