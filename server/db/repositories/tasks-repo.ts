import { getDb } from '../database';

/**
 * Tasks Repository - CRUD operations for the tasks table
 */

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'failed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: string;
  projectName?: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  blockedBy?: string[];
  scheduledAt?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  projectName?: string;
  maxRetries?: number;
  blockedBy?: string[];
  scheduledAt?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  projectName?: string;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  blockedBy?: string[];
  scheduledAt?: string;
}

export interface TasksStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  failed: number;
  blocked: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    projectId: row.project_id || undefined,
    projectName: row.project_name || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    lastError: row.last_error || undefined,
    lastAttemptAt: row.last_attempt_at || undefined,
    nextRetryAt: row.next_retry_at || undefined,
    blockedBy: row.blocked_by ? JSON.parse(row.blocked_by) : undefined,
    scheduledAt: row.scheduled_at || undefined,
  };
}

export function listTasks(): Task[] {
  const rows = getDb().prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  return rows.map(rowToTask);
}

export function getById(id: string): Task | null {
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return row ? rowToTask(row) : null;
}

export function getByProject(projectId: string): Task[] {
  const rows = getDb().prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  return rows.map(rowToTask);
}

export function getByStatus(status: TaskStatus): Task[] {
  const rows = getDb().prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC').all(status);
  return rows.map(rowToTask);
}

export function create(input: CreateTaskInput): Task {
  const id = generateId();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO tasks (id, title, description, status, priority, project_id, project_name,
                       created_at, updated_at, retry_count, max_retries, blocked_by, scheduled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id,
    input.title,
    input.description || null,
    input.status || 'todo',
    input.priority || 'medium',
    input.projectId || null,
    input.projectName || null,
    now,
    now,
    input.maxRetries ?? 3,
    input.blockedBy ? JSON.stringify(input.blockedBy) : null,
    input.scheduledAt || null,
  );

  return getById(id)!;
}

export function update(id: string, updates: UpdateTaskInput): Task | null {
  const existing = getById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
  if (updates.projectId !== undefined) { fields.push('project_id = ?'); values.push(updates.projectId); }
  if (updates.projectName !== undefined) { fields.push('project_name = ?'); values.push(updates.projectName); }
  if (updates.retryCount !== undefined) { fields.push('retry_count = ?'); values.push(updates.retryCount); }
  if (updates.maxRetries !== undefined) { fields.push('max_retries = ?'); values.push(updates.maxRetries); }
  if (updates.lastError !== undefined) { fields.push('last_error = ?'); values.push(updates.lastError); }
  if (updates.lastAttemptAt !== undefined) { fields.push('last_attempt_at = ?'); values.push(updates.lastAttemptAt); }
  if (updates.nextRetryAt !== undefined) { fields.push('next_retry_at = ?'); values.push(updates.nextRetryAt); }
  if (updates.blockedBy !== undefined) { fields.push('blocked_by = ?'); values.push(JSON.stringify(updates.blockedBy)); }
  if (updates.scheduledAt !== undefined) { fields.push('scheduled_at = ?'); values.push(updates.scheduledAt); }

  fields.push("updated_at = datetime('now')");

  if (fields.length === 1) return existing; // Only updated_at

  values.push(id);
  getDb().prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getById(id);
}

export function remove(id: string): boolean {
  const result = getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getStats(): TasksStats {
  const stats: TasksStats = {
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    failed: 0,
    blocked: 0,
    byPriority: { low: 0, medium: 0, high: 0 },
  };

  const statusRows = getDb().prepare(
    'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
  ).all() as Array<{ status: string; count: number }>;

  for (const row of statusRows) {
    stats.total += row.count;
    switch (row.status) {
      case 'todo': stats.todo = row.count; break;
      case 'in_progress': stats.inProgress = row.count; break;
      case 'done': stats.done = row.count; break;
      case 'failed': stats.failed = row.count; break;
      case 'blocked': stats.blocked = row.count; break;
    }
  }

  const priorityRows = getDb().prepare(
    'SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority'
  ).all() as Array<{ priority: string; count: number }>;

  for (const row of priorityRows) {
    if (row.priority === 'low') stats.byPriority.low = row.count;
    else if (row.priority === 'medium') stats.byPriority.medium = row.count;
    else if (row.priority === 'high') stats.byPriority.high = row.count;
  }

  return stats;
}

/**
 * Get the next task to execute based on smart selection criteria:
 * 1. Filter to status === 'todo'
 * 2. Exclude tasks with unfinished blockedBy dependencies
 * 3. Exclude tasks in retry backoff (nextRetryAt > now)
 * 4. Exclude scheduled tasks (scheduledAt > now)
 * 5. Sort by priority (high -> medium -> low), then by creation date
 */
export function getNextExecutable(): Task | null {
  const tasks = listTasks();
  const now = new Date();
  const completedIds = new Set(
    tasks.filter(t => t.status === 'done').map(t => t.id)
  );

  const executable = tasks.filter(task => {
    if (task.status !== 'todo') return false;

    // Check dependencies
    if (task.blockedBy && task.blockedBy.length > 0) {
      const hasUnfinishedDeps = task.blockedBy.some(depId => !completedIds.has(depId));
      if (hasUnfinishedDeps) return false;
    }

    // Check retry backoff
    if (task.nextRetryAt && new Date(task.nextRetryAt) > now) return false;

    // Check scheduled time
    if (task.scheduledAt && new Date(task.scheduledAt) > now) return false;

    return true;
  });

  if (executable.length === 0) return null;

  const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

  executable.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return executable[0];
}

/**
 * Update tasks blocked/unblocked status based on dependency completion
 */
export function updateBlockedStatus(): void {
  const tasks = listTasks();
  const completedIds = new Set(
    tasks.filter(t => t.status === 'done').map(t => t.id)
  );

  for (const task of tasks) {
    if (task.status === 'done' || task.status === 'in_progress') continue;

    if (task.blockedBy && task.blockedBy.length > 0) {
      const hasUnfinishedDeps = task.blockedBy.some(depId => !completedIds.has(depId));
      if (hasUnfinishedDeps && task.status !== 'blocked') {
        update(task.id, { status: 'blocked' });
      } else if (!hasUnfinishedDeps && task.status === 'blocked') {
        update(task.id, { status: 'todo' });
      }
    }
  }
}
