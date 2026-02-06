/**
 * Token History Store - Server adapter
 * Delegates to SQLite repository instead of electron-store
 */

import * as tokenHistoryRepo from '../db/repositories/token-history-repo';

// Re-export types from the repository
export type { HourlyUsage, DailyTokenUsage } from '../db/repositories/token-history-repo';

export function recordHourlyUsage(input: number, output: number): void {
  tokenHistoryRepo.recordHourly(input, output);
}

export function getTokenHistory(days: number = 7): tokenHistoryRepo.DailyTokenUsage[] {
  return tokenHistoryRepo.getHistory(days);
}

export function getTotalUsageForPeriod(days: number): { input: number; output: number } {
  return tokenHistoryRepo.getTotals(days);
}

export function getAverageDailyUsage(days: number = 7): { input: number; output: number } {
  return tokenHistoryRepo.getAverages(days);
}

export function setMaxDaysToKeep(days: number): void {
  tokenHistoryRepo.cleanup(days);
}

export function clearTokenHistory(): void {
  tokenHistoryRepo.clear();
}
