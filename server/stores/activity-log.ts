/**
 * Activity Log Store - Server adapter
 * Delegates to SQLite repository instead of electron-store
 */

import * as activityLogRepo from '../db/repositories/activity-log-repo';
import { calculateCost } from '../services/cost-calculator';

// Re-export types from the repository
export type { ActivityCategory, ActivityLogEntry, ActivityLogQueryOptions, ActivitySummary, ActivityLogExportData } from '../db/repositories/activity-log-repo';
export type { ActivityCategory as ActivityCategoryType } from '../db/repositories/activity-log-repo';

import type { ActivityCategory, ActivityLogEntry, ActivityLogQueryOptions, ActivitySummary } from '../db/repositories/activity-log-repo';

export function logActivity(
  category: ActivityCategory,
  action: string,
  details: Record<string, unknown> = {},
  options?: {
    taskId?: string;
    projectId?: string;
    tokens?: { input: number; output: number };
    duration?: number;
  }
): ActivityLogEntry {
  // Calculate cost if tokens provided
  let costUsd: number | undefined;
  if (options?.tokens) {
    costUsd = calculateCost(options.tokens.input, options.tokens.output);
  }

  return activityLogRepo.log(category, action, details, {
    taskId: options?.taskId,
    projectId: options?.projectId,
    tokens: options?.tokens,
    costUsd,
    duration: options?.duration,
  });
}

export function getActivityLogs(options: ActivityLogQueryOptions = {}): ActivityLogEntry[] {
  return activityLogRepo.query({
    category: options.category,
    taskId: options.taskId,
    projectId: options.projectId,
    startDate: options.startDate,
    endDate: options.endDate,
    limit: options.limit,
    offset: options.offset,
  });
}

export function searchActivityLogs(
  query: string,
  filters: ActivityLogQueryOptions = {}
): ActivityLogEntry[] {
  return activityLogRepo.search(query, {
    category: filters.category,
    taskId: filters.taskId,
    projectId: filters.projectId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    limit: filters.limit,
    offset: filters.offset,
  });
}

export function exportActivityLogs(
  format: 'json' | 'csv',
  dateRange?: { start?: string; end?: string }
): string {
  return activityLogRepo.exportLogs(format, dateRange);
}

export function getActivitySummary(dateRange?: { start?: string; end?: string }): ActivitySummary {
  return activityLogRepo.getSummary(dateRange);
}

export function clearActivityLogs(): void {
  activityLogRepo.clear();
}
