/**
 * Projects Service - Adapted from electron/services/projects.ts
 * Replaces app.getPath with getDataDir/getHomeDir from utils/paths.
 * Replaces settings.get/set with projects-repo for project storage.
 * Keeps all git/filesystem logic intact.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { getHomeDir, getUserDataDir } from '../utils/paths';
import * as projectsRepo from '../db/repositories/projects-repo';
import { createLogger } from '../utils/logger';

const log = createLogger('Projects');
const execAsync = promisify(exec);
const fsPromises = fs.promises;

// Caches for expensive operations
let systemStatusCache: { data: any; timestamp: number } | null = null;
const SYSTEM_STATUS_CACHE_TTL = 30_000; // 30 seconds

let gitReposCache: { data: Project[]; timestamp: number } | null = null;
const GIT_REPOS_CACHE_TTL = 300_000; // 5 minutes — repos rarely change

// Re-export types
export type { Project } from '../db/repositories/projects-repo';
import type { Project } from '../db/repositories/projects-repo';

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

/**
 * Get all stored projects from the database
 */
export function getProjects(): Project[] {
  return projectsRepo.list();
}

/**
 * Add a project by path. If already exists, returns the existing project.
 */
export async function addProject(projectPath: string): Promise<Project> {
  // Check if already exists
  const existing = projectsRepo.getByPath(projectPath);
  if (existing) {
    return existing;
  }

  const scanned = await scanProject(projectPath);
  return projectsRepo.create({
    name: scanned.name,
    path: scanned.path,
    hasBeads: scanned.hasBeads,
    hasClaude: scanned.hasClaude,
    lastModified: scanned.lastModified,
    gitRemote: scanned.gitRemote,
    gitBranch: scanned.gitBranch,
  });
}

/**
 * Remove a project by ID
 */
export function removeProject(projectId: string): void {
  projectsRepo.remove(projectId);
}

/**
 * Scan a single project for details (beads, claude.md, git info)
 */
export async function scanProject(projectPath: string): Promise<Project> {
  const name = path.basename(projectPath);
  const project: Project = {
    id: '',
    name,
    path: projectPath,
    hasBeads: false,
    hasClaude: false,
    createdAt: new Date().toISOString(),
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

/**
 * Refresh all projects by re-scanning their directories
 */
export async function refreshProjects(): Promise<Project[]> {
  const projects = getProjects();
  const refreshed: Project[] = [];

  for (const project of projects) {
    try {
      const updated = await scanProject(project.path);
      const result = projectsRepo.update(project.id, {
        hasBeads: updated.hasBeads,
        hasClaude: updated.hasClaude,
        lastModified: updated.lastModified,
        gitRemote: updated.gitRemote,
        gitBranch: updated.gitBranch,
      });
      if (result) {
        refreshed.push(result);
      } else {
        refreshed.push(project);
      }
    } catch {
      // Keep the old project info if scan fails
      refreshed.push(project);
    }
  }

  return refreshed;
}

/**
 * Decode project path from ~/.claude/projects/ directory name
 */
function decodeProjectPath(encodedName: string): string {
  try {
    let decoded = encodedName;

    // First try URL decoding
    try {
      decoded = decodeURIComponent(encodedName);
    } catch {
      // Not URL encoded, use as-is
    }

    // Check for Windows path: starts with drive letter followed by --
    const windowsMatch = decoded.match(/^([A-Za-z])--(.*)$/);
    if (windowsMatch) {
      const driveLetter = windowsMatch[1];
      const rest = windowsMatch[2];
      return `${driveLetter}:/${rest.replace(/-/g, '/')}`;
    }

    // Unix path: starts with -
    if (decoded.startsWith('-')) {
      return '/' + decoded.substring(1).replace(/-/g, '/');
    }

    return decoded;
  } catch {
    return encodedName;
  }
}

/**
 * Scan ~/.claude/projects/ for session files.
 * Returns sessions with isActive flag based on recent modification.
 */
async function getSessionsFromHistory(activeThresholdMs: number = 2 * 60 * 1000): Promise<ClaudeSession[]> {
  const sessions: ClaudeSession[] = [];
  const homeDir = getHomeDir();
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
            let workingDir = '';
            try {
              const content = await fsPromises.readFile(filePath, 'utf-8');
              const lines = content.split('\n').slice(0, 10); // Check first 10 lines
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.cwd) {
                    workingDir = parsed.cwd;
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

/**
 * Auto-discover git repos in common locations
 * Auto-discover git repos in common locations
 */
export async function discoverGitRepos(): Promise<Project[]> {
  // Return cached results if fresh
  if (gitReposCache && (Date.now() - gitReposCache.timestamp) < GIT_REPOS_CACHE_TTL) {
    return gitReposCache.data;
  }

  const discovered: Project[] = [];
  const homeDir = getHomeDir();

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
    // Common mount points
    '/git',
    '/workspace',
    '/app',
    '/projects',
  ];

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

  gitReposCache = { data: discovered, timestamp: Date.now() };
  return discovered;
}

/**
 * Detect running Claude Code sessions.
 * Detect running Claude Code sessions.
 */
export async function detectClaudeSessions(): Promise<ClaudeSession[]> {
  const sessions: ClaudeSession[] = [];

  try {
    // PRIMARY SOURCE: Session history files in ~/.claude/projects/
    const allHistorySessions = await getSessionsFromHistory(2 * 60 * 1000);
    const activeSessions = allHistorySessions.filter(s => s.status === 'running');
    const recentSessions = allHistorySessions.filter(s => s.status === 'recent').slice(0, 10);

    // Linux: Detect Claude Code CLI processes using pgrep and /proc
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
          source: 'history',
          status: 'running',
        });
      }
    } catch {
      // pgrep failed
    }

    // Merge active history sessions
    for (const activeSession of activeSessions) {
      const alreadyIncluded = sessions.some(s =>
        s.workingDir && activeSession.workingDir &&
        s.workingDir.toLowerCase() === activeSession.workingDir.toLowerCase()
      );

      if (!alreadyIncluded) {
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

/**
 * Get combined system status
 */
export async function getSystemStatus(): Promise<{
  projects: Project[];
  sessions: ClaudeSession[];
  discovered: Project[];
}> {
  // Return cached results if fresh
  if (systemStatusCache && (Date.now() - systemStatusCache.timestamp) < SYSTEM_STATUS_CACHE_TTL) {
    return systemStatusCache.data;
  }

  const [projects, sessions, discovered] = await Promise.all([
    refreshProjects(),
    detectClaudeSessions(),
    discoverGitRepos(),
  ]);

  // Filter out already-added projects from discovered
  const existingPaths = new Set(projects.map(p => p.path));
  const newDiscovered = discovered.filter(d => !existingPaths.has(d.path));

  const result = {
    projects,
    sessions,
    discovered: newDiscovered,
  };

  systemStatusCache = { data: result, timestamp: Date.now() };
  return result;
}
