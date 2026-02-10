import * as fs from 'fs';
import * as path from 'path';
import { getHomeDir } from '../utils/paths';
import { createLogger } from '../utils/logger';

const log = createLogger('ClaudeSessions');
const fsPromises = fs.promises;

// Cache for expensive directory scan
let cachedSessions: ClaudeCodeSession[] | null = null;
let sessionsCacheTime = 0;
const SESSIONS_CACHE_TTL = 60000; // 1 minute

export interface ClaudeCodeSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  sessionFilePath: string;
  createdAt: string;
  lastModifiedAt: string;
  messageCount: number;
  lastMessagePreview?: string;
}

/**
 * Get the Claude Code projects directory
 */
function getClaudeProjectsDir(): string {
  const homeDir = getHomeDir();
  return path.join(homeDir, '.claude', 'projects');
}

/**
 * Extract working directory from a session file
 * Session files are JSONL with entries that may contain cwd field
 */
async function extractWorkingDir(sessionFilePath: string): Promise<string | null> {
  try {
    const content = await fsPromises.readFile(sessionFilePath, 'utf-8');
    const lines = content.split('\n').slice(0, 20); // Check first 20 lines

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.cwd) {
          return entry.cwd;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // File not readable
  }
  return null;
}

/**
 * Get message count and last message preview from a session file
 */
async function getSessionStats(sessionFilePath: string): Promise<{
  messageCount: number;
  lastMessagePreview?: string;
}> {
  try {
    const content = await fsPromises.readFile(sessionFilePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const messageCount = lines.length;

    // Get last user or assistant message for preview
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'user' || entry.type === 'assistant') {
          const content = entry.message?.content || entry.content || '';
          const preview = typeof content === 'string'
            ? content.slice(0, 100).replace(/\n/g, ' ')
            : '';
          return { messageCount, lastMessagePreview: preview };
        }
      } catch {
        continue;
      }
    }

    return { messageCount };
  } catch {
    return { messageCount: 0 };
  }
}

/**
 * Decode a project directory name to its original path
 * Claude encodes paths by replacing path separators with -
 */
function decodeProjectPath(encodedName: string): string {
  try {
    let decoded = encodedName;

    // Try URL decoding
    try {
      decoded = decodeURIComponent(encodedName);
    } catch {
      // Not URL encoded
    }

    // Windows path: starts with drive letter followed by --
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
 * List all Claude Code sessions
 */
export async function listClaudeCodeSessions(projectPath?: string): Promise<ClaudeCodeSession[]> {
  // Return cached results for unfiltered requests
  if (!projectPath && cachedSessions && (Date.now() - sessionsCacheTime) < SESSIONS_CACHE_TTL) {
    return cachedSessions;
  }

  const sessions: ClaudeCodeSession[] = [];
  const projectsDir = getClaudeProjectsDir();

  try {
    await fsPromises.access(projectsDir);
  } catch {
    // Claude projects directory doesn't exist
    return sessions;
  }

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000; // Only look at sessions from last 30 days

  try {
    const projectDirs = await fsPromises.readdir(projectsDir, { withFileTypes: true });

    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) continue;

      const projectDirPath = path.join(projectsDir, projectDir.name);

      try {
        const files = await fsPromises.readdir(projectDirPath);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

        for (const file of jsonlFiles) {
          const filePath = path.join(projectDirPath, file);

          try {
            const stats = await fsPromises.stat(filePath);

            // Skip old sessions
            if (stats.mtime.getTime() < thirtyDaysAgo) continue;

            const sessionId = path.basename(file, '.jsonl');

            // Get working directory from session file or decode from folder name
            let workingDir = await extractWorkingDir(filePath);
            if (!workingDir) {
              workingDir = decodeProjectPath(projectDir.name);
            }

            // Filter by project path if specified
            if (projectPath) {
              const normalizedProjectPath = projectPath.toLowerCase().replace(/\\/g, '/');
              const normalizedWorkingDir = workingDir.toLowerCase().replace(/\\/g, '/');
              if (!normalizedWorkingDir.includes(normalizedProjectPath) &&
                  !normalizedProjectPath.includes(normalizedWorkingDir)) {
                continue;
              }
            }

            const projectName = path.basename(workingDir);
            const { messageCount, lastMessagePreview } = await getSessionStats(filePath);

            sessions.push({
              sessionId,
              projectPath: workingDir,
              projectName,
              sessionFilePath: filePath,
              createdAt: stats.birthtime.toISOString(),
              lastModifiedAt: stats.mtime.toISOString(),
              messageCount,
              lastMessagePreview,
            });
          } catch {
            // Can't read file, skip
          }
        }
      } catch {
        // Can't read project dir, skip
      }
    }
  } catch (err) {
    log.error('Error listing Claude sessions:', err);
  }

  // Sort by last modified, newest first
  sessions.sort((a, b) =>
    new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()
  );

  // Cache unfiltered results
  if (!projectPath) {
    cachedSessions = sessions;
    sessionsCacheTime = Date.now();
  }

  return sessions;
}

/**
 * Get a specific Claude Code session by ID
 */
export async function getClaudeCodeSession(sessionId: string): Promise<ClaudeCodeSession | null> {
  const projectsDir = getClaudeProjectsDir();

  try {
    const projectDirs = await fsPromises.readdir(projectsDir, { withFileTypes: true });

    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) continue;

      const sessionFilePath = path.join(projectsDir, projectDir.name, `${sessionId}.jsonl`);

      try {
        const stats = await fsPromises.stat(sessionFilePath);

        let workingDir = await extractWorkingDir(sessionFilePath);
        if (!workingDir) {
          workingDir = decodeProjectPath(projectDir.name);
        }

        const projectName = path.basename(workingDir);
        const { messageCount, lastMessagePreview } = await getSessionStats(sessionFilePath);

        return {
          sessionId,
          projectPath: workingDir,
          projectName,
          sessionFilePath,
          createdAt: stats.birthtime.toISOString(),
          lastModifiedAt: stats.mtime.toISOString(),
          messageCount,
          lastMessagePreview,
        };
      } catch {
        // File doesn't exist in this project dir, continue searching
      }
    }
  } catch (err) {
    log.error('Error getting Claude session:', err);
  }

  return null;
}

/**
 * Check if a session can be resumed
 * A session can be resumed if its file exists and is readable
 */
export async function canResumeSession(sessionId: string): Promise<boolean> {
  const session = await getClaudeCodeSession(sessionId);
  if (!session) return false;

  try {
    await fsPromises.access(session.sessionFilePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the latest session for a project path
 */
export async function findLatestSession(projectPath: string): Promise<string | null> {
  const sessions = await listClaudeCodeSessions(projectPath);

  if (sessions.length === 0) return null;

  // Sessions are already sorted by lastModifiedAt, newest first
  return sessions[0].sessionId;
}

/**
 * Extract session ID from Claude Code CLI output
 * Claude outputs session info in the stream-json format
 */
export function extractSessionIdFromOutput(output: string): string | null {
  // Look for session_id in JSON output lines
  const lines = output.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const json = JSON.parse(line);
      // Different possible locations for session ID
      if (json.session_id) return json.session_id;
      if (json.sessionId) return json.sessionId;
      if (json.session?.id) return json.session.id;
    } catch {
      // Not JSON, continue
    }
  }

  // Also try to find it in log messages
  const sessionIdMatch = output.match(/session[_\s]?(?:id|ID)[:\s]+([a-f0-9-]{36})/i);
  if (sessionIdMatch) {
    return sessionIdMatch[1];
  }

  return null;
}

/**
 * Get recent sessions across all projects
 */
export async function getRecentSessions(limit: number = 10): Promise<ClaudeCodeSession[]> {
  const sessions = await listClaudeCodeSessions();
  return sessions.slice(0, limit);
}
