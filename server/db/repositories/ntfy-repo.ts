import { getDb } from '../database';

/**
 * Ntfy Repository - config get/set, pending questions CRUD
 */

export interface StatusReporterConfig {
  enabled: boolean;
  intervalMinutes: number;
  dailySummaryTime?: string;
  notifyOnTaskStart: boolean;
  notifyOnTaskComplete: boolean;
  notifyOnTaskFail: boolean;
  notifyOnApprovalNeeded: boolean;
  notifyOnTokenWarning: boolean;
}

export interface NtfyConfig {
  enabled: boolean;
  serverUrl: string;
  topic: string;
  responseTopic?: string;
  priority: 'min' | 'low' | 'default' | 'high' | 'urgent';
  authToken?: string;
  enableDesktopNotifications: boolean;
  commandsEnabled: boolean;
  allowedCommands?: string[];
  autoStartOnTask: boolean;
  statusReporter: StatusReporterConfig;
}

export interface PendingQuestion {
  id: string;
  question: string;
  options?: string[];
  freeText: boolean;
  taskId: string;
  taskTitle: string;
  status: 'pending' | 'answered' | 'expired';
  answer?: string;
  createdAt: string;
  expiresAt: string;
}

const defaultStatusReporter: StatusReporterConfig = {
  enabled: false,
  intervalMinutes: 0,
  notifyOnTaskStart: false,
  notifyOnTaskComplete: true,
  notifyOnTaskFail: true,
  notifyOnApprovalNeeded: true,
  notifyOnTokenWarning: true,
};

const defaultConfig: NtfyConfig = {
  enabled: false,
  serverUrl: 'https://ntfy.sh',
  topic: 'phat-controller',
  priority: 'default',
  enableDesktopNotifications: true,
  commandsEnabled: true,
  autoStartOnTask: false,
  statusReporter: defaultStatusReporter,
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================
// Config
// ============================================

export function getConfig(): NtfyConfig {
  const row = getDb().prepare('SELECT config FROM ntfy_config WHERE id = 1').get() as { config: string } | undefined;
  if (!row) return { ...defaultConfig };

  try {
    return JSON.parse(row.config) as NtfyConfig;
  } catch {
    return { ...defaultConfig };
  }
}

export function setConfig(config: Partial<NtfyConfig>): NtfyConfig {
  const current = getConfig();
  const updated = { ...current, ...config };

  getDb().prepare(`
    INSERT INTO ntfy_config (id, config)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET config = excluded.config
  `).run(JSON.stringify(updated));

  return updated;
}

// ============================================
// Pending Questions
// ============================================

function rowToQuestion(row: any): PendingQuestion {
  return {
    id: row.id,
    question: row.question,
    options: row.options ? JSON.parse(row.options) : undefined,
    freeText: !!row.free_text,
    taskId: row.task_id,
    taskTitle: row.task_title,
    status: row.status as PendingQuestion['status'],
    answer: row.answer || undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function getPendingQuestions(): PendingQuestion[] {
  const rows = getDb().prepare(
    "SELECT * FROM ntfy_pending_questions WHERE status = 'pending' ORDER BY created_at ASC"
  ).all();
  return rows.map(rowToQuestion);
}

export function getAllQuestions(): PendingQuestion[] {
  const rows = getDb().prepare(
    'SELECT * FROM ntfy_pending_questions ORDER BY created_at DESC'
  ).all();
  return rows.map(rowToQuestion);
}

export function getQuestion(id: string): PendingQuestion | null {
  const row = getDb().prepare('SELECT * FROM ntfy_pending_questions WHERE id = ?').get(id);
  return row ? rowToQuestion(row) : null;
}

export function addQuestion(question: PendingQuestion): void {
  getDb().prepare(`
    INSERT INTO ntfy_pending_questions (id, question, options, free_text, task_id, task_title, status, answer, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    question.id || generateId(),
    question.question,
    question.options ? JSON.stringify(question.options) : null,
    question.freeText ? 1 : 0,
    question.taskId,
    question.taskTitle,
    question.status,
    question.answer || null,
    question.createdAt,
    question.expiresAt,
  );
}

export function updateQuestion(id: string, updates: Partial<PendingQuestion>): PendingQuestion | null {
  const existing = getQuestion(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.answer !== undefined) { fields.push('answer = ?'); values.push(updates.answer); }

  if (fields.length === 0) return existing;

  values.push(id);
  getDb().prepare(`UPDATE ntfy_pending_questions SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getQuestion(id);
}

export function removeQuestion(id: string): void {
  getDb().prepare('DELETE FROM ntfy_pending_questions WHERE id = ?').run(id);
}

export function cleanupExpired(): void {
  const now = new Date().toISOString();
  getDb().prepare(
    "UPDATE ntfy_pending_questions SET status = 'expired' WHERE status = 'pending' AND expires_at < ?"
  ).run(now);
}

export function clearQuestions(): void {
  getDb().prepare('DELETE FROM ntfy_pending_questions').run();
}
