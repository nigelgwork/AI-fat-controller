import { getDb } from '../database';

/**
 * Conversations Repository - Session CRUD, entry CRUD, search, stats, claude session linking
 */

export interface ConversationEntry {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  projectId?: string;
  taskId?: string;
  tokens?: { input: number; output: number };
}

export interface ConversationSession {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  lastActivityAt: string;
  entryCount: number;
  totalTokens: { input: number; output: number };
  summary?: string;
  claudeCodeSessionId?: string;
  claudeCodeSessionPath?: string;
  isResumable: boolean;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function rowToSession(row: any): ConversationSession {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    entryCount: row.entry_count,
    totalTokens: {
      input: row.total_tokens_input,
      output: row.total_tokens_output,
    },
    summary: row.summary || undefined,
    claudeCodeSessionId: row.claude_session_id || undefined,
    claudeCodeSessionPath: row.claude_session_path || undefined,
    isResumable: !!row.is_resumable,
  };
}

function rowToEntry(row: any): ConversationEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    role: row.role as ConversationEntry['role'],
    content: row.content,
    projectId: row.project_id || undefined,
    taskId: row.task_id || undefined,
    tokens: (row.tokens_input != null || row.tokens_output != null)
      ? { input: row.tokens_input || 0, output: row.tokens_output || 0 }
      : undefined,
  };
}

// ============================================
// Session CRUD
// ============================================

export function createSession(projectId: string, projectName: string): ConversationSession {
  const id = generateId();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO conversation_sessions (id, project_id, project_name, started_at, last_activity_at, entry_count, total_tokens_input, total_tokens_output, is_resumable)
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0)
  `).run(id, projectId, projectName, now, now);

  return getSession(id)!;
}

export function getSession(sessionId: string): ConversationSession | null {
  const row = getDb().prepare('SELECT * FROM conversation_sessions WHERE id = ?').get(sessionId);
  return row ? rowToSession(row) : null;
}

export function listSessions(projectId?: string): ConversationSession[] {
  const sql = projectId
    ? 'SELECT * FROM conversation_sessions WHERE project_id = ? ORDER BY last_activity_at DESC'
    : 'SELECT * FROM conversation_sessions ORDER BY last_activity_at DESC';

  const rows = projectId
    ? getDb().prepare(sql).all(projectId)
    : getDb().prepare(sql).all();

  return rows.map(rowToSession);
}

export function updateSession(
  sessionId: string,
  updates: Partial<Pick<ConversationSession, 'summary' | 'projectName'>>
): ConversationSession | null {
  const existing = getSession(sessionId);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.summary !== undefined) { fields.push('summary = ?'); values.push(updates.summary); }
  if (updates.projectName !== undefined) { fields.push('project_name = ?'); values.push(updates.projectName); }

  if (fields.length === 0) return existing;

  values.push(sessionId);
  getDb().prepare(`UPDATE conversation_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getSession(sessionId);
}

export function deleteSession(sessionId: string): boolean {
  const result = getDb().prepare('DELETE FROM conversation_sessions WHERE id = ?').run(sessionId);
  return result.changes > 0;
}

export function getRecentSessions(limit: number = 10): ConversationSession[] {
  const rows = getDb().prepare(
    'SELECT * FROM conversation_sessions ORDER BY last_activity_at DESC LIMIT ?'
  ).all(limit);
  return rows.map(rowToSession);
}

// ============================================
// Entry CRUD
// ============================================

export function appendEntry(
  sessionId: string,
  entry: Omit<ConversationEntry, 'id' | 'timestamp'>
): ConversationEntry {
  const id = generateId();
  const now = new Date().toISOString();

  const tokensInput = entry.tokens?.input || null;
  const tokensOutput = entry.tokens?.output || null;

  getDb().prepare(`
    INSERT INTO conversation_entries (id, session_id, timestamp, role, content, project_id, task_id, tokens_input, tokens_output)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, now, entry.role, entry.content, entry.projectId || null, entry.taskId || null, tokensInput, tokensOutput);

  // Update session metadata
  const updateFields: string[] = [
    'last_activity_at = ?',
    'entry_count = entry_count + 1',
  ];
  const updateValues: any[] = [now];

  if (tokensInput != null) {
    updateFields.push('total_tokens_input = total_tokens_input + ?');
    updateValues.push(tokensInput);
  }
  if (tokensOutput != null) {
    updateFields.push('total_tokens_output = total_tokens_output + ?');
    updateValues.push(tokensOutput);
  }

  updateValues.push(sessionId);
  getDb().prepare(
    `UPDATE conversation_sessions SET ${updateFields.join(', ')} WHERE id = ?`
  ).run(...updateValues);

  return {
    id,
    timestamp: now,
    ...entry,
  };
}

export function loadEntries(
  sessionId: string,
  options?: { limit?: number; offset?: number }
): ConversationEntry[] {
  let sql = 'SELECT * FROM conversation_entries WHERE session_id = ? ORDER BY timestamp ASC';
  const params: any[] = [sessionId];

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const rows = getDb().prepare(sql).all(...params);
  return rows.map(rowToEntry);
}

// ============================================
// Search
// ============================================

export function searchConversations(
  query: string,
  options?: { projectId?: string; limit?: number }
): Array<{ session: ConversationSession; entry: ConversationEntry; match: string }> {
  const limit = options?.limit || 50;
  const queryLower = query.toLowerCase();

  let sql = `
    SELECT ce.*, cs.project_id as session_project_id, cs.project_name as session_project_name
    FROM conversation_entries ce
    JOIN conversation_sessions cs ON ce.session_id = cs.id
    WHERE ce.content LIKE ?
  `;
  const params: any[] = [`%${query}%`];

  if (options?.projectId) {
    sql += ' AND cs.project_id = ?';
    params.push(options.projectId);
  }

  sql += ' ORDER BY ce.timestamp DESC LIMIT ?';
  params.push(limit);

  const rows = getDb().prepare(sql).all(...params) as any[];

  return rows.map(row => {
    const entry = rowToEntry(row);
    const session = getSession(row.session_id)!;

    // Extract snippet around match
    const contentLower = entry.content.toLowerCase();
    const matchIndex = contentLower.indexOf(queryLower);
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(entry.content.length, matchIndex + query.length + 50);
    const match = entry.content.substring(start, end);

    return { session, entry, match };
  });
}

// ============================================
// Stats
// ============================================

export function getStats(): {
  totalSessions: number;
  totalEntries: number;
  totalTokens: { input: number; output: number };
  sessionsByProject: Record<string, number>;
} {
  const sessionStats = getDb().prepare(`
    SELECT
      COUNT(*) as total_sessions,
      COALESCE(SUM(entry_count), 0) as total_entries,
      COALESCE(SUM(total_tokens_input), 0) as total_input,
      COALESCE(SUM(total_tokens_output), 0) as total_output
    FROM conversation_sessions
  `).get() as any;

  const projectRows = getDb().prepare(`
    SELECT COALESCE(project_name, project_id) as project_key, COUNT(*) as count
    FROM conversation_sessions
    GROUP BY project_key
  `).all() as Array<{ project_key: string; count: number }>;

  const sessionsByProject: Record<string, number> = {};
  for (const row of projectRows) {
    sessionsByProject[row.project_key] = row.count;
  }

  return {
    totalSessions: sessionStats.total_sessions,
    totalEntries: sessionStats.total_entries,
    totalTokens: {
      input: sessionStats.total_input,
      output: sessionStats.total_output,
    },
    sessionsByProject,
  };
}

// ============================================
// Claude Code Session Linking
// ============================================

export function linkClaudeCodeSession(
  appSessionId: string,
  claudeSessionId: string,
  claudeSessionPath?: string
): ConversationSession | null {
  const session = getSession(appSessionId);
  if (!session) return null;

  const fields: string[] = ['claude_session_id = ?', 'is_resumable = 1'];
  const values: any[] = [claudeSessionId];

  if (claudeSessionPath) {
    fields.push('claude_session_path = ?');
    values.push(claudeSessionPath);
  }

  values.push(appSessionId);
  getDb().prepare(
    `UPDATE conversation_sessions SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  return getSession(appSessionId);
}

export function unlinkClaudeCodeSession(appSessionId: string): ConversationSession | null {
  const session = getSession(appSessionId);
  if (!session) return null;

  getDb().prepare(`
    UPDATE conversation_sessions
    SET claude_session_id = NULL, claude_session_path = NULL, is_resumable = 0
    WHERE id = ?
  `).run(appSessionId);

  return getSession(appSessionId);
}

export function getResumableSessions(projectId?: string): ConversationSession[] {
  const sql = projectId
    ? 'SELECT * FROM conversation_sessions WHERE is_resumable = 1 AND claude_session_id IS NOT NULL AND project_id = ? ORDER BY last_activity_at DESC'
    : 'SELECT * FROM conversation_sessions WHERE is_resumable = 1 AND claude_session_id IS NOT NULL ORDER BY last_activity_at DESC';

  const rows = projectId
    ? getDb().prepare(sql).all(projectId)
    : getDb().prepare(sql).all();

  return rows.map(rowToSession);
}

export function findSessionByClaudeId(claudeSessionId: string): ConversationSession | null {
  const row = getDb().prepare(
    'SELECT * FROM conversation_sessions WHERE claude_session_id = ?'
  ).get(claudeSessionId);
  return row ? rowToSession(row) : null;
}
