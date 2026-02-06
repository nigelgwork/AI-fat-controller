import { getDb } from '../database';

/**
 * Activity Log Repository - log, query, search, export, summary, clear
 */

export type ActivityCategory = 'execution' | 'user_action' | 'system' | 'error' | 'project';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  category: ActivityCategory;
  action: string;
  details: Record<string, unknown>;
  taskId?: string;
  projectId?: string;
  tokens?: { input: number; output: number };
  costUsd?: number;
  duration?: number;
}

export interface ActivityLogQueryOptions {
  category?: ActivityCategory;
  taskId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ActivitySummary {
  totalEntries: number;
  totalCostUsd: number;
  totalTokens: { input: number; output: number };
  byCategory: Record<ActivityCategory, number>;
  averageDuration: number;
}

export interface ActivityLogExportData {
  exportedAt: string;
  totalEntries: number;
  entries: ActivityLogEntry[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function rowToEntry(row: any): ActivityLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    category: row.category as ActivityCategory,
    action: row.action,
    details: row.details ? JSON.parse(row.details) : {},
    taskId: row.task_id || undefined,
    projectId: row.project_id || undefined,
    tokens: (row.tokens_input != null || row.tokens_output != null)
      ? { input: row.tokens_input || 0, output: row.tokens_output || 0 }
      : undefined,
    costUsd: row.cost_usd ?? undefined,
    duration: row.duration ?? undefined,
  };
}

export function log(
  category: ActivityCategory,
  action: string,
  details: Record<string, unknown> = {},
  options?: {
    taskId?: string;
    projectId?: string;
    tokens?: { input: number; output: number };
    costUsd?: number;
    duration?: number;
  }
): ActivityLogEntry {
  const id = generateId();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO activity_logs (id, timestamp, category, action, details, task_id, project_id, tokens_input, tokens_output, cost_usd, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    now,
    category,
    action,
    JSON.stringify(details),
    options?.taskId || null,
    options?.projectId || null,
    options?.tokens?.input ?? null,
    options?.tokens?.output ?? null,
    options?.costUsd ?? null,
    options?.duration ?? null,
  );

  // Trim old entries (keep last 10000)
  getDb().prepare(`
    DELETE FROM activity_logs WHERE id NOT IN (
      SELECT id FROM activity_logs ORDER BY timestamp DESC LIMIT 10000
    )
  `).run();

  return {
    id,
    timestamp: now,
    category,
    action,
    details,
    taskId: options?.taskId,
    projectId: options?.projectId,
    tokens: options?.tokens,
    costUsd: options?.costUsd,
    duration: options?.duration,
  };
}

export function query(options: ActivityLogQueryOptions = {}): ActivityLogEntry[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.category) {
    conditions.push('category = ?');
    params.push(options.category);
  }
  if (options.taskId) {
    conditions.push('task_id = ?');
    params.push(options.taskId);
  }
  if (options.projectId) {
    conditions.push('project_id = ?');
    params.push(options.projectId);
  }
  if (options.startDate) {
    conditions.push('timestamp >= ?');
    params.push(options.startDate);
  }
  if (options.endDate) {
    conditions.push('timestamp <= ?');
    params.push(options.endDate);
  }

  let sql = 'SELECT * FROM activity_logs';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY timestamp DESC';

  const limit = options.limit || 100;
  const offset = options.offset || 0;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = getDb().prepare(sql).all(...params);
  return rows.map(rowToEntry);
}

export function search(
  queryStr: string,
  filters: ActivityLogQueryOptions = {}
): ActivityLogEntry[] {
  const lowerQuery = queryStr.toLowerCase();

  // Get all matching the filters first (without limit for search)
  const entries = query({ ...filters, limit: undefined });

  // Filter by search term in action and details
  const matched = entries.filter(entry => {
    if (entry.action.toLowerCase().includes(lowerQuery)) return true;
    const detailsStr = JSON.stringify(entry.details).toLowerCase();
    if (detailsStr.includes(lowerQuery)) return true;
    return false;
  });

  return filters.limit ? matched.slice(0, filters.limit) : matched;
}

export function exportLogs(
  format: 'json' | 'csv',
  dateRange?: { start?: string; end?: string }
): string {
  const entries = query({
    startDate: dateRange?.start,
    endDate: dateRange?.end,
    limit: undefined,
  });

  const exportData: ActivityLogExportData = {
    exportedAt: new Date().toISOString(),
    totalEntries: entries.length,
    entries,
  };

  if (format === 'json') {
    return JSON.stringify(exportData, null, 2);
  }

  // CSV format
  const headers = [
    'ID', 'Timestamp', 'Category', 'Action', 'Task ID', 'Project ID',
    'Input Tokens', 'Output Tokens', 'Cost (USD)', 'Duration (ms)', 'Details',
  ];

  const rows = entries.map(entry => [
    entry.id,
    entry.timestamp,
    entry.category,
    entry.action,
    entry.taskId || '',
    entry.projectId || '',
    entry.tokens?.input?.toString() || '',
    entry.tokens?.output?.toString() || '',
    entry.costUsd?.toFixed(6) || '',
    entry.duration?.toString() || '',
    JSON.stringify(entry.details).replace(/"/g, '""'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => (cell.includes(',') || cell.includes('"') ? `"${cell}"` : cell)).join(',')
    ),
  ].join('\n');

  return csvContent;
}

export function getSummary(dateRange?: { start?: string; end?: string }): ActivitySummary {
  const conditions: string[] = [];
  const params: any[] = [];

  if (dateRange?.start) {
    conditions.push('timestamp >= ?');
    params.push(dateRange.start);
  }
  if (dateRange?.end) {
    conditions.push('timestamp <= ?');
    params.push(dateRange.end);
  }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const stats = getDb().prepare(`
    SELECT
      COUNT(*) as total_entries,
      COALESCE(SUM(cost_usd), 0) as total_cost,
      COALESCE(SUM(tokens_input), 0) as total_input,
      COALESCE(SUM(tokens_output), 0) as total_output,
      COALESCE(AVG(CASE WHEN duration IS NOT NULL THEN duration END), 0) as avg_duration
    FROM activity_logs${whereClause}
  `).get(...params) as any;

  const categoryRows = getDb().prepare(`
    SELECT category, COUNT(*) as count FROM activity_logs${whereClause} GROUP BY category
  `).all(...params) as Array<{ category: string; count: number }>;

  const byCategory: Record<ActivityCategory, number> = {
    execution: 0,
    user_action: 0,
    system: 0,
    error: 0,
    project: 0,
  };

  for (const row of categoryRows) {
    byCategory[row.category as ActivityCategory] = row.count;
  }

  return {
    totalEntries: stats.total_entries,
    totalCostUsd: stats.total_cost,
    totalTokens: {
      input: stats.total_input,
      output: stats.total_output,
    },
    byCategory,
    averageDuration: stats.avg_duration,
  };
}

export function clear(): void {
  getDb().prepare('DELETE FROM activity_logs').run();
}
