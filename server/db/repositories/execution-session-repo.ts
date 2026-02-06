import { getDb } from '../database';

/**
 * Execution Session Repository - session CRUD, log CRUD, getActive, getHistory
 */

export interface ExecutionSession {
  id: string;
  taskId: string;
  taskTitle: string;
  status: 'starting' | 'running' | 'waiting_input' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  lastActivity: string;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  error?: string;
  result?: string;
}

export interface SessionLogEntry {
  id?: number;
  sessionId: string;
  timestamp: string;
  type: 'text' | 'tool-call' | 'tool-result' | 'error' | 'info' | 'complete';
  content: string;
  details?: Record<string, unknown>;
}

function rowToSession(row: any): ExecutionSession {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    status: row.status as ExecutionSession['status'],
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    lastActivity: row.last_activity,
    toolCalls: row.tool_calls,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costUsd: row.cost_usd ?? undefined,
    error: row.error || undefined,
    result: row.result || undefined,
  };
}

function rowToLogEntry(row: any): SessionLogEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    type: row.type as SessionLogEntry['type'],
    content: row.content,
    details: row.details ? JSON.parse(row.details) : undefined,
  };
}

// ============================================
// Session CRUD
// ============================================

export function createSession(id: string, taskId: string, taskTitle: string): ExecutionSession {
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO execution_sessions (id, task_id, task_title, status, started_at, last_activity, tool_calls, input_tokens, output_tokens)
    VALUES (?, ?, ?, 'starting', ?, ?, 0, 0, 0)
  `).run(id, taskId, taskTitle, now, now);

  return getSession(id)!;
}

export function getSession(id: string): ExecutionSession | null {
  const row = getDb().prepare('SELECT * FROM execution_sessions WHERE id = ?').get(id);
  return row ? rowToSession(row) : null;
}

export function updateSessionStatus(
  id: string,
  status: ExecutionSession['status'],
  details?: { error?: string; result?: string }
): ExecutionSession | null {
  const existing = getSession(id);
  if (!existing) return null;

  const fields: string[] = ['status = ?', "last_activity = datetime('now')"];
  const values: any[] = [status];

  if (details?.error !== undefined) { fields.push('error = ?'); values.push(details.error); }
  if (details?.result !== undefined) { fields.push('result = ?'); values.push(details.result); }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    fields.push("ended_at = datetime('now')");
  }

  values.push(id);
  getDb().prepare(`UPDATE execution_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getSession(id);
}

export function updateSessionTokens(
  id: string,
  inputTokens: number,
  outputTokens: number,
  costUsd?: number
): ExecutionSession | null {
  const existing = getSession(id);
  if (!existing) return null;

  const fields: string[] = ['input_tokens = ?', 'output_tokens = ?'];
  const values: any[] = [inputTokens, outputTokens];

  if (costUsd !== undefined) {
    fields.push('cost_usd = ?');
    values.push(costUsd);
  }

  values.push(id);
  getDb().prepare(`UPDATE execution_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getSession(id);
}

export function incrementToolCalls(id: string): void {
  getDb().prepare(`
    UPDATE execution_sessions
    SET tool_calls = tool_calls + 1, last_activity = datetime('now')
    WHERE id = ?
  `).run(id);
}

export function getActive(): ExecutionSession[] {
  const rows = getDb().prepare(
    "SELECT * FROM execution_sessions WHERE status IN ('starting', 'running', 'waiting_input') ORDER BY started_at DESC"
  ).all();
  return rows.map(rowToSession);
}

export function getHistory(limit: number = 20): ExecutionSession[] {
  const rows = getDb().prepare(
    "SELECT * FROM execution_sessions WHERE status IN ('completed', 'failed', 'cancelled') ORDER BY started_at DESC LIMIT ?"
  ).all(limit);
  return rows.map(rowToSession);
}

export function getAllSessions(limit: number = 50): ExecutionSession[] {
  const rows = getDb().prepare(
    'SELECT * FROM execution_sessions ORDER BY started_at DESC LIMIT ?'
  ).all(limit);
  return rows.map(rowToSession);
}

export function cancelSession(id: string): boolean {
  const session = getSession(id);
  if (!session) return false;

  updateSessionStatus(id, 'cancelled');
  return true;
}

export function deleteSession(id: string): boolean {
  const result = getDb().prepare('DELETE FROM execution_sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================
// Session Logs
// ============================================

export function addLog(
  sessionId: string,
  type: SessionLogEntry['type'],
  content: string,
  details?: Record<string, unknown>
): SessionLogEntry {
  const now = new Date().toISOString();

  const result = getDb().prepare(`
    INSERT INTO execution_session_logs (session_id, timestamp, type, content, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    sessionId,
    now,
    type,
    content,
    details ? JSON.stringify(details) : null,
  );

  // Update session last_activity
  getDb().prepare("UPDATE execution_sessions SET last_activity = ? WHERE id = ?").run(now, sessionId);

  // Increment tool calls if applicable
  if (type === 'tool-call') {
    incrementToolCalls(sessionId);
  }

  return {
    id: Number(result.lastInsertRowid),
    sessionId,
    timestamp: now,
    type,
    content,
    details,
  };
}

export function getLogs(sessionId: string, limit: number = 50): SessionLogEntry[] {
  const rows = getDb().prepare(
    'SELECT * FROM execution_session_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?'
  ).all(sessionId, limit);
  return rows.map(rowToLogEntry).reverse();
}

export function getRecentLogs(sessionId: string, limit: number = 20): SessionLogEntry[] {
  const rows = getDb().prepare(
    'SELECT * FROM execution_session_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?'
  ).all(sessionId, limit);
  return rows.map(rowToLogEntry).reverse();
}

export function clearLogs(sessionId: string): void {
  getDb().prepare('DELETE FROM execution_session_logs WHERE session_id = ?').run(sessionId);
}

/**
 * Clean up old sessions and their logs
 */
export function cleanup(maxSessions: number = 50): void {
  // Keep only the most recent sessions
  getDb().prepare(`
    DELETE FROM execution_sessions WHERE id NOT IN (
      SELECT id FROM execution_sessions ORDER BY started_at DESC LIMIT ?
    )
  `).run(maxSessions);
}
