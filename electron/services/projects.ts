import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { settings } from './settings';
import { createLogger } from '../utils/logger';

const log = createLogger('Projects');
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
    log.error(`Error scanning project ${projectPath}:`, err);
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
    log.error('WSL git repo discovery failed:', err);
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
      log.error('WSL discovery failed:', err);
    }
  }

  return discovered;
}

// Decode project path from ~/.claude/projects/ directory name
function decodeProjectPath(encodedName: string): string {
  // This is a fallback - prefer reading cwd from session files
  // Claude encodes paths by replacing / or \ with - and URL encoding special chars
  // e.g., "/git/project" -> "-git-project", "C:\Users\name" -> "C--Users-name"
  try {
    let decoded = encodedName;

    // First try URL decoding
    try {
      decoded = decodeURIComponent(encodedName);
    } catch {
      // Not URL encoded, use as-is
    }

    // Check for Windows path: starts with drive letter followed by --
    // "C--Users-name" means "C:\Users\name" (: and \ both become -)
    const windowsMatch = decoded.match(/^([A-Za-z])--(.*)$/);
    if (windowsMatch) {
      const driveLetter = windowsMatch[1];
      const rest = windowsMatch[2];
      // For Windows, replace dashes with / but this is imperfect
      // for paths with hyphens in folder names
      return `${driveLetter}:/${rest.replace(/-/g, '/')}`;
    }

    // Unix path: starts with -
    if (decoded.startsWith('-')) {
      // Simple approach: just replace leading dash with /
      // Don't try to decode further - folder names may have hyphens
      return '/' + decoded.substring(1).replace(/-/g, '/');
    }

    return decoded;
  } catch {
    return encodedName;
  }
}

// Scan ~/.claude/projects/ for session files
// Returns sessions with isActive flag based on recent modification
async function getSessionsFromHistory(activeThresholdMs: number = 2 * 60 * 1000): Promise<ClaudeSession[]> {
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

            const sessionId = path.basename(file, '.jsonl');
            const timeSinceModified = now - stats.mtime.getTime();
            const isActive = timeSinceModified < activeThresholdMs;

            // Try to get working directory from session file content
            // Session files contain cwd field in jsonl entries
            let workingDir = '';
            try {
              const content = await fsPromises.readFile(filePath, 'utf-8');
              const lines = content.split('\n').slice(0, 10); // Check first 10 lines
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const entry = JSON.parse(line);
                  if (entry.cwd) {
                    workingDir = entry.cwd;
                    break;
                  }
                } catch {
                  // Skip invalid JSON lines
                }
              }
            } catch {
              // Fall back to decoding folder name
            }

            // Fall back to decoding folder name if cwd not found in file
            if (!workingDir) {
              workingDir = decodeProjectPath(entry.name);
            }

            const projectName = path.basename(workingDir);

            sessions.push({
              pid: 0,
              workingDir,
              projectName,
              command: isActive ? 'Active session' : 'Recent session',
              startTime: stats.mtime.toISOString(),
              source: 'history',
              status: isActive ? 'running' : 'recent',
              sessionId,
            });
          } catch {
            // Can't read file, skip
          }
        }
      } catch {
        // Can't read session dir, skip
      }
    }
  } catch (err) {
    log.error('Error reading session history:', err);
  }

  // Sort by modification time, newest first
  sessions.sort((a, b) => {
    if (!a.startTime || !b.startTime) return 0;
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });

  return sessions;
}

// Legacy wrapper for backwards compatibility
async function getRecentSessionsFromHistory(): Promise<ClaudeSession[]> {
  const sessions = await getSessionsFromHistory();
  return sessions.filter(s => s.status === 'recent').slice(0, 10);
}

// Detect running Claude Code sessions
export async function detectClaudeSessions(): Promise<ClaudeSession[]> {
  const sessions: ClaudeSession[] = [];

  try {
    // PRIMARY SOURCE: Session history files in ~/.claude/projects/
    // Active sessions = files modified in last 2 minutes
    // Recent sessions = files modified in last 24 hours
    const allHistorySessions = await getSessionsFromHistory(2 * 60 * 1000);
    const activeSessions = allHistorySessions.filter(s => s.status === 'running');
    const recentSessions = allHistorySessions.filter(s => s.status === 'recent').slice(0, 10);

    // WINDOWS: Detect Claude Code CLI processes using PowerShell
    // Note: We look for Claude Code CLI running as:
    // 1. claude.exe (standalone binary)
    // 2. node.exe running @anthropic-ai/claude-code
    // And exclude Claude Desktop app (AnthropicClaude\app-*)
    if (process.platform === 'win32') {
      try {
        // Use PowerShell to find claude and node processes
        // Claude Code CLI can run as claude.exe or as node running the claude script
        const psCommand = `
          Get-CimInstance Win32_Process | Where-Object {
            $_.Name -eq 'claude.exe' -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'claude|@anthropic-ai')
          } | Select-Object ProcessId, Name, CommandLine, CreationDate | ConvertTo-Json -Compress
        `.replace(/\n\s*/g, ' ').trim();

        const { stdout: psOutput } = await execAsync(
          `powershell.exe -NoProfile -Command "${psCommand}"`,
          { timeout: 10000 }
        );

        if (psOutput.trim()) {
          try {
            let processes = JSON.parse(psOutput.trim());
            // Handle single object vs array
            if (!Array.isArray(processes)) {
              processes = [processes];
            }

            for (const proc of processes) {
              if (!proc || !proc.ProcessId) continue;

              const pid = proc.ProcessId;
              const command = proc.CommandLine || proc.Name || '';

              // Skip Claude Desktop app processes (AnthropicClaude folder)
              if (command.includes('AnthropicClaude') || command.includes('AppData\\Local\\AnthropicClaude')) {
                continue;
              }

              // Skip helper/child processes (Electron internals)
              if (command.includes('--type=') || command.includes('crashpad')) continue;

              // Verify this is Claude Code CLI
              const isClaudeCodeCli = command.includes('.local\\bin\\claude') ||
                                      command.includes('.local/bin/claude') ||
                                      command.includes('@anthropic-ai/claude-code') ||
                                      command.includes('@anthropic-ai\\claude-code') ||
                                      command.includes('npx') && command.includes('claude') ||
                                      (!command.includes('AnthropicClaude') && command.toLowerCase().includes('claude'));

              if (!isClaudeCodeCli) continue;

              sessions.push({
                pid,
                workingDir: '',
                projectName: 'Claude Code',
                command: 'Claude Code (Windows)',
                startTime: proc.CreationDate ? new Date(proc.CreationDate).toISOString() : undefined,
                source: 'windows',
                status: 'running',
              });
            }
          } catch (parseErr) {
            log.error('Error parsing PowerShell output:', parseErr);
          }
        }
      } catch (psErr) {
        log.error('PowerShell process detection failed:', psErr);
      }

      // WSL: Can get working directory from /proc/{pid}/cwd
      try {
        const { stdout: wslOutput } = await execAsync(
          'wsl.exe -e bash -c "pgrep -af claude 2>/dev/null || true"',
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

            // Skip grep/pgrep processes
            if (command.includes('grep') || command.includes('pgrep')) continue;

            // Must be claude
            if (!command.toLowerCase().includes('claude')) continue;

            // Get working directory from /proc
            let workingDir = '';
            let projectName = '';
            try {
              const { stdout: cwd } = await execAsync(
                `wsl.exe -e bash -c "readlink -f /proc/${pid}/cwd 2>/dev/null"`,
                { timeout: 3000 }
              );
              workingDir = cwd.trim();
              projectName = path.basename(workingDir);
            } catch {
              // Ignore
            }

            sessions.push({
              pid,
              workingDir,
              projectName: projectName || 'WSL Session',
              command: workingDir ? `Working in ${projectName}` : 'Claude Code (WSL)',
              source: 'wsl',
              status: 'running',
            });
          }
        }
      } catch {
        // WSL not available
      }
    } else {
      // Linux/Mac: Use pgrep and /proc
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

          if (command.includes('grep') || command.includes('pgrep')) continue;

          let workingDir = '';
          try {
            workingDir = await fsPromises.readlink(`/proc/${pid}/cwd`);
          } catch {
            // Ignore
          }

          const projectName = workingDir ? path.basename(workingDir) : '';

          sessions.push({
            pid,
            workingDir,
            projectName: projectName || 'Claude Session',
            command: workingDir ? `Working in ${projectName}` : command.substring(0, 50),
            source: 'wsl',
            status: 'running',
          });
        }
      } catch {
        // pgrep failed
      }
    }

    // Merge Windows sessions with active history sessions
    // Windows process detection gives us PID, history gives us project/workingDir
    const windowsSessions = sessions.filter(s => s.source === 'windows' && !s.workingDir);
    const wslSessions = sessions.filter(s => s.source === 'wsl');

    // For each active history session, try to match with a Windows process
    const usedWindowsSessions = new Set<number>();

    for (const activeSession of activeSessions) {
      // First check if this matches a WSL session (by working dir)
      const wslMatch = wslSessions.find(s =>
        s.workingDir && activeSession.workingDir &&
        (s.workingDir.includes(activeSession.projectName || '') ||
         activeSession.workingDir.includes(s.projectName || ''))
      );

      if (wslMatch) {
        // Merge info into WSL session
        wslMatch.sessionId = activeSession.sessionId;
        wslMatch.command = `Working in ${wslMatch.projectName || activeSession.projectName}`;
        continue;
      }

      // Try to find an unmatched Windows session to pair with
      const availableWindowsSession = windowsSessions.find((_, idx) => !usedWindowsSessions.has(idx));
      const windowsIdx = availableWindowsSession ? windowsSessions.indexOf(availableWindowsSession) : -1;

      if (windowsIdx >= 0 && availableWindowsSession) {
        usedWindowsSessions.add(windowsIdx);
        // Update the Windows session with history info
        const sessionIdx = sessions.indexOf(availableWindowsSession);
        if (sessionIdx >= 0) {
          sessions[sessionIdx].workingDir = activeSession.workingDir;
          sessions[sessionIdx].projectName = activeSession.projectName;
          sessions[sessionIdx].sessionId = activeSession.sessionId;
          sessions[sessionIdx].command = `Working in ${activeSession.projectName}`;
        }
      } else {
        // No Windows process to pair with - add as history-only active session
        sessions.push({
          pid: 0,
          workingDir: activeSession.workingDir,
          projectName: activeSession.projectName,
          command: `Working in ${activeSession.projectName}`,
          startTime: activeSession.startTime,
          source: 'history',
          status: 'running',
          sessionId: activeSession.sessionId,
        });
      }
    }

    // Remove any unmatched Windows sessions that have no useful info
    // (They show up as "Claude Code (Windows)" with no project context)
    // Actually, keep them so user can see Claude is running even if we can't match to a project

    // Add recent (non-active) sessions
    for (const recentSession of recentSessions) {
      const alreadyIncluded = sessions.some(s =>
        s.sessionId === recentSession.sessionId ||
        (s.workingDir && recentSession.workingDir &&
         s.workingDir.toLowerCase() === recentSession.workingDir.toLowerCase())
      );

      if (!alreadyIncluded) {
        sessions.push({
          pid: 0,
          workingDir: recentSession.workingDir,
          projectName: recentSession.projectName,
          command: `Recent: ${recentSession.projectName}`,
          startTime: recentSession.startTime,
          source: 'history',
          status: 'recent',
          sessionId: recentSession.sessionId,
        });
      }
    }

    // Match to known projects for additional info
    const projects = getProjects();
    for (const session of sessions) {
      if (!session.projectName && session.workingDir) {
        const project = projects.find(p =>
          session.workingDir.toLowerCase().includes(p.path.toLowerCase()) ||
          p.path.toLowerCase().includes(session.workingDir.toLowerCase())
        );
        if (project) {
          session.projectName = project.name;
        } else {
          session.projectName = path.basename(session.workingDir);
        }
      }
    }
  } catch (err) {
    log.error('Error detecting Claude sessions:', err);
  }

  // Sort: running first, then by modification time
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
