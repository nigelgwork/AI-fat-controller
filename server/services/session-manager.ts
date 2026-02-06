/**
 * Session Manager - Adapted from electron/services/session-manager.ts
 * Tracks active Claude Code execution sessions.
 * Replaces safeBroadcast with broadcast from websocket.
 * Uses SQLite via execution-session-repo for persistence.
 */

import { broadcast } from '../websocket';
import { createLogger } from '../utils/logger';
import * as sessionRepo from '../db/repositories/execution-session-repo';

const log = createLogger('SessionManager');

// Re-export types for consumers
export type { ExecutionSession, SessionLogEntry } from '../db/repositories/execution-session-repo';
import type { ExecutionSession, SessionLogEntry } from '../db/repositories/execution-session-repo';

/**
 * Create a new execution session
 */
export function createSession(id: string, taskId: string, taskTitle: string): ExecutionSession {
  const session = sessionRepo.createSession(id, taskId, taskTitle);

  notifySessionUpdate(session);
  log.info(`[SessionManager] Created session ${id} for task "${taskTitle}"`);

  return session;
}

/**
 * Update session status
 */
export function updateSessionStatus(
  id: string,
  status: ExecutionSession['status'],
  details?: { error?: string; result?: string }
): void {
  const updated = sessionRepo.updateSessionStatus(id, status, details);
  if (updated) {
    notifySessionUpdate(updated);
    log.info(`[SessionManager] Session ${id} status: ${status}`);
  }
}

/**
 * Add a log entry to a session
 */
export function addSessionLog(
  id: string,
  type: SessionLogEntry['type'],
  content: string,
  details?: Record<string, unknown>
): void {
  const entry = sessionRepo.addLog(id, type, content, details);
  const session = sessionRepo.getSession(id);
  if (session) {
    notifySessionLogUpdate(session, entry);
  }
}

/**
 * Update session token usage
 */
export function updateSessionTokens(
  id: string,
  inputTokens: number,
  outputTokens: number,
  costUsd?: number
): void {
  const updated = sessionRepo.updateSessionTokens(id, inputTokens, outputTokens, costUsd);
  if (updated) {
    notifySessionUpdate(updated);
  }
}

/**
 * Get active sessions
 */
export function getActiveSessions(): ExecutionSession[] {
  return sessionRepo.getActive();
}

/**
 * Get a specific session
 */
export function getSession(id: string): ExecutionSession | null {
  return sessionRepo.getSession(id);
}

/**
 * Get session history
 */
export function getSessionHistory(limit = 20): ExecutionSession[] {
  return sessionRepo.getHistory(limit);
}

/**
 * Cancel a session
 */
export function cancelSession(id: string): boolean {
  return sessionRepo.cancelSession(id);
}

/**
 * Notify frontend of session update via WebSocket
 */
function notifySessionUpdate(session: ExecutionSession): void {
  broadcast('session:updated', {
    session: {
      id: session.id,
      taskId: session.taskId,
      taskTitle: session.taskTitle,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      lastActivity: session.lastActivity,
      toolCalls: session.toolCalls,
      inputTokens: session.inputTokens,
      outputTokens: session.outputTokens,
      costUsd: session.costUsd,
      error: session.error,
    },
  });
}

/**
 * Notify frontend of new log entry via WebSocket
 */
function notifySessionLogUpdate(session: ExecutionSession, entry: SessionLogEntry): void {
  broadcast('session:log', {
    sessionId: session.id,
    entry,
  });
}

/**
 * Get session logs
 */
export function getSessionLogs(id: string, limit = 50): SessionLogEntry[] {
  return sessionRepo.getLogs(id, limit);
}

/**
 * Link a Claude Code CLI session ID to an execution session
 * Note: The execution-session-repo doesn't have claude session fields,
 * so we store this linkage in the conversations-repo or settings.
 * For now, we log the linkage and broadcast the update.
 */
export function linkClaudeCodeSession(
  executionId: string,
  claudeSessionId: string,
  claudeSessionPath?: string
): void {
  // The session repo doesn't have claude session columns,
  // so we just log and broadcast for real-time tracking
  log.info(`[SessionManager] Linked Claude session ${claudeSessionId} to execution ${executionId}`);

  const session = sessionRepo.getSession(executionId);
  if (session) {
    notifySessionUpdate(session);
  }
}

/**
 * Get sessions that can be resumed (completed sessions from history)
 */
export function getResumableSessions(limit = 10): ExecutionSession[] {
  return sessionRepo.getHistory(limit);
}

/**
 * Find a session by its Claude Code session ID
 * Note: Without claude session columns in the DB, this searches all sessions
 */
export function findSessionByClaudeId(claudeSessionId: string): ExecutionSession | null {
  // Since execution-session-repo doesn't store claude session IDs directly,
  // we return null. Callers should use conversations-repo for this.
  return null;
}
