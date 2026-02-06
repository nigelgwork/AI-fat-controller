import { getDb } from '../database';

/**
 * Controller Repository - Controller state, approval queue, action logs, auto-approval rules
 */

// Types matching the electron controller service
export type ControllerStatus = 'idle' | 'running' | 'paused' | 'waiting_approval' | 'waiting_input' | 'winding_down';
export type ApprovalActionType = 'planning' | 'architecture' | 'git_push' | 'large_edit';
export type ControllerPhase = 'planning' | 'executing' | 'reviewing' | 'idle';
export type UsageLimitStatus = 'ok' | 'warning' | 'approaching_limit' | 'at_limit';

export interface ProgressState {
  phase: ControllerPhase;
  step: number;
  totalSteps: number;
  stepDescription: string;
  startedAt: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  limit: number;
  resetAt: string;
}

export interface UsageLimitConfig {
  maxTokensPerHour: number;
  maxTokensPerDay: number;
  pauseThreshold: number;
  warningThreshold: number;
  autoResumeOnReset: boolean;
}

export interface ControllerState {
  status: ControllerStatus;
  currentTaskId: string | null;
  currentAction: string | null;
  startedAt: string | null;
  processedCount: number;
  approvedCount: number;
  rejectedCount: number;
  errorCount: number;
  currentProgress: ProgressState | null;
  conversationSessionId: string | null;
  tokenUsage: TokenUsage;
  usageLimitConfig: UsageLimitConfig;
  dailyTokenUsage: { input: number; output: number; date: string };
  usageLimitStatus: UsageLimitStatus;
  pausedDueToLimit: boolean;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  taskTitle: string;
  actionType: ApprovalActionType;
  description: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected' | 'timed_out';
  createdAt: string;
  expiresAt?: string;
}

export interface ActionLog {
  id: string;
  taskId: string;
  taskTitle: string;
  actionType: string;
  description: string;
  autoApproved: boolean;
  result: 'success' | 'failure' | 'skipped';
  output?: string;
  duration: number;
  timestamp: string;
}

export interface AutoApprovalRules {
  enabled: boolean;
  allowedActionTypes: ApprovalActionType[];
  maxPendingTimeMinutes: number;
  requireConfirmationForGitPush: boolean;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================
// Controller State
// ============================================

export function getState(): ControllerState {
  const row = getDb().prepare('SELECT * FROM controller_state WHERE id = 1').get() as any;

  if (!row) {
    // Return default state if no row exists
    return {
      status: 'idle',
      currentTaskId: null,
      currentAction: null,
      startedAt: null,
      processedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      errorCount: 0,
      currentProgress: null,
      conversationSessionId: null,
      tokenUsage: { inputTokens: 0, outputTokens: 0, limit: 200000, resetAt: new Date(Date.now() + 3600000).toISOString() },
      usageLimitConfig: { maxTokensPerHour: 200000, maxTokensPerDay: 1000000, pauseThreshold: 0.8, warningThreshold: 0.6, autoResumeOnReset: true },
      dailyTokenUsage: { input: 0, output: 0, date: new Date().toISOString().split('T')[0] },
      usageLimitStatus: 'ok',
      pausedDueToLimit: false,
    };
  }

  return {
    status: row.status as ControllerStatus,
    currentTaskId: row.current_task_id || null,
    currentAction: row.current_action || null,
    startedAt: row.started_at || null,
    processedCount: row.processed_count,
    approvedCount: row.approved_count,
    rejectedCount: row.rejected_count,
    errorCount: row.error_count,
    currentProgress: row.current_progress ? JSON.parse(row.current_progress) : null,
    conversationSessionId: row.conversation_session_id || null,
    tokenUsage: row.token_usage ? JSON.parse(row.token_usage) : { inputTokens: 0, outputTokens: 0, limit: 200000, resetAt: new Date(Date.now() + 3600000).toISOString() },
    usageLimitConfig: row.usage_limit_config ? JSON.parse(row.usage_limit_config) : { maxTokensPerHour: 200000, maxTokensPerDay: 1000000, pauseThreshold: 0.8, warningThreshold: 0.6, autoResumeOnReset: true },
    dailyTokenUsage: row.daily_token_usage ? JSON.parse(row.daily_token_usage) : { input: 0, output: 0, date: new Date().toISOString().split('T')[0] },
    usageLimitStatus: row.usage_limit_status as UsageLimitStatus,
    pausedDueToLimit: !!row.paused_due_to_limit,
  };
}

export function updateState(updates: Partial<ControllerState>): ControllerState {
  const current = getState();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.currentTaskId !== undefined) { fields.push('current_task_id = ?'); values.push(updates.currentTaskId); }
  if (updates.currentAction !== undefined) { fields.push('current_action = ?'); values.push(updates.currentAction); }
  if (updates.startedAt !== undefined) { fields.push('started_at = ?'); values.push(updates.startedAt); }
  if (updates.processedCount !== undefined) { fields.push('processed_count = ?'); values.push(updates.processedCount); }
  if (updates.approvedCount !== undefined) { fields.push('approved_count = ?'); values.push(updates.approvedCount); }
  if (updates.rejectedCount !== undefined) { fields.push('rejected_count = ?'); values.push(updates.rejectedCount); }
  if (updates.errorCount !== undefined) { fields.push('error_count = ?'); values.push(updates.errorCount); }
  if (updates.currentProgress !== undefined) { fields.push('current_progress = ?'); values.push(updates.currentProgress ? JSON.stringify(updates.currentProgress) : null); }
  if (updates.conversationSessionId !== undefined) { fields.push('conversation_session_id = ?'); values.push(updates.conversationSessionId); }
  if (updates.tokenUsage !== undefined) { fields.push('token_usage = ?'); values.push(JSON.stringify(updates.tokenUsage)); }
  if (updates.usageLimitConfig !== undefined) { fields.push('usage_limit_config = ?'); values.push(JSON.stringify(updates.usageLimitConfig)); }
  if (updates.dailyTokenUsage !== undefined) { fields.push('daily_token_usage = ?'); values.push(JSON.stringify(updates.dailyTokenUsage)); }
  if (updates.usageLimitStatus !== undefined) { fields.push('usage_limit_status = ?'); values.push(updates.usageLimitStatus); }
  if (updates.pausedDueToLimit !== undefined) { fields.push('paused_due_to_limit = ?'); values.push(updates.pausedDueToLimit ? 1 : 0); }

  if (fields.length === 0) return current;

  values.push(1);
  getDb().prepare(`UPDATE controller_state SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getState();
}

export function resetState(): void {
  getDb().prepare(`
    UPDATE controller_state SET
      status = 'idle',
      current_task_id = NULL,
      current_action = NULL,
      started_at = NULL,
      processed_count = 0,
      approved_count = 0,
      rejected_count = 0,
      error_count = 0,
      current_progress = NULL,
      conversation_session_id = NULL,
      usage_limit_status = 'ok',
      paused_due_to_limit = 0
    WHERE id = 1
  `).run();
}

// ============================================
// Approval Queue
// ============================================

export function getApprovalQueue(): ApprovalRequest[] {
  const rows = getDb().prepare(
    "SELECT * FROM approval_requests WHERE status = 'pending' ORDER BY created_at ASC"
  ).all() as any[];

  return rows.map(row => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    actionType: row.action_type as ApprovalActionType,
    description: row.description,
    details: row.details,
    status: row.status as ApprovalRequest['status'],
    createdAt: row.created_at,
    expiresAt: row.expires_at || undefined,
  }));
}

export function getApprovalRequest(id: string): ApprovalRequest | null {
  const row = getDb().prepare('SELECT * FROM approval_requests WHERE id = ?').get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    actionType: row.action_type as ApprovalActionType,
    description: row.description,
    details: row.details,
    status: row.status as ApprovalRequest['status'],
    createdAt: row.created_at,
    expiresAt: row.expires_at || undefined,
  };
}

export function addApprovalRequest(request: ApprovalRequest): void {
  getDb().prepare(`
    INSERT INTO approval_requests (id, task_id, task_title, action_type, description, details, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    request.id,
    request.taskId,
    request.taskTitle,
    request.actionType,
    request.description,
    request.details,
    request.status,
    request.createdAt,
    request.expiresAt || null,
  );
}

export function updateApprovalRequest(id: string, updates: Partial<ApprovalRequest>): ApprovalRequest | null {
  const existing = getApprovalRequest(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.expiresAt !== undefined) { fields.push('expires_at = ?'); values.push(updates.expiresAt); }

  if (fields.length === 0) return existing;

  values.push(id);
  getDb().prepare(`UPDATE approval_requests SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getApprovalRequest(id);
}

export function removeApprovalRequest(id: string): void {
  getDb().prepare('DELETE FROM approval_requests WHERE id = ?').run(id);
}

export function clearApprovalQueue(): void {
  getDb().prepare('DELETE FROM approval_requests').run();
}

// ============================================
// Action Logs
// ============================================

export function getActionLogs(limit?: number): ActionLog[] {
  const sql = limit
    ? 'SELECT * FROM action_logs ORDER BY timestamp DESC LIMIT ?'
    : 'SELECT * FROM action_logs ORDER BY timestamp DESC';

  const rows = (limit
    ? getDb().prepare(sql).all(limit)
    : getDb().prepare(sql).all()
  ) as any[];

  return rows.map(row => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    actionType: row.action_type,
    description: row.description,
    autoApproved: !!row.auto_approved,
    result: row.result as ActionLog['result'],
    output: row.output || undefined,
    duration: row.duration,
    timestamp: row.timestamp,
  }));
}

export function addActionLog(log: ActionLog): void {
  getDb().prepare(`
    INSERT INTO action_logs (id, task_id, task_title, action_type, description, auto_approved, result, output, duration, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.id || generateId(),
    log.taskId,
    log.taskTitle,
    log.actionType,
    log.description,
    log.autoApproved ? 1 : 0,
    log.result,
    log.output || null,
    log.duration,
    log.timestamp,
  );

  // Keep only last 1000 logs
  getDb().prepare(`
    DELETE FROM action_logs WHERE id NOT IN (
      SELECT id FROM action_logs ORDER BY timestamp DESC LIMIT 1000
    )
  `).run();
}

export function clearActionLogs(): void {
  getDb().prepare('DELETE FROM action_logs').run();
}

// ============================================
// Auto-Approval Rules
// ============================================

const defaultAutoApprovalRules: AutoApprovalRules = {
  enabled: false,
  allowedActionTypes: ['planning'],
  maxPendingTimeMinutes: 0,
  requireConfirmationForGitPush: true,
};

export function getAutoApprovalRules(): AutoApprovalRules {
  const row = getDb().prepare('SELECT config FROM auto_approval_rules WHERE id = 1').get() as { config: string } | undefined;
  if (!row) return { ...defaultAutoApprovalRules };

  try {
    return JSON.parse(row.config) as AutoApprovalRules;
  } catch {
    return { ...defaultAutoApprovalRules };
  }
}

export function updateAutoApprovalRules(updates: Partial<AutoApprovalRules>): AutoApprovalRules {
  const current = getAutoApprovalRules();
  const updated = { ...current, ...updates };

  getDb().prepare(`
    INSERT INTO auto_approval_rules (id, config)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET config = excluded.config
  `).run(JSON.stringify(updated));

  return updated;
}
