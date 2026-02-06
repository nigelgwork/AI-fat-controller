import { getDb } from '../database';

/**
 * Token History Repository - record hourly usage, get history, totals, averages, clear
 */

export interface HourlyUsage {
  hour: number;
  input: number;
  output: number;
}

export interface DailyTokenUsage {
  date: string;
  hourlyUsage: HourlyUsage[];
  dailyTotal: {
    input: number;
    output: number;
  };
}

export function recordHourly(inputTokens: number, outputTokens: number): void {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const hour = now.getHours();

  getDb().prepare(`
    INSERT INTO token_history (date, hour, input_tokens, output_tokens)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date, hour) DO UPDATE SET
      input_tokens = input_tokens + excluded.input_tokens,
      output_tokens = output_tokens + excluded.output_tokens
  `).run(date, hour, inputTokens, outputTokens);
}

export function getHistory(days: number = 7): DailyTokenUsage[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const rows = getDb().prepare(`
    SELECT date, hour, input_tokens, output_tokens
    FROM token_history
    WHERE date >= ?
    ORDER BY date ASC, hour ASC
  `).all(cutoffStr) as Array<{ date: string; hour: number; input_tokens: number; output_tokens: number }>;

  // Group by date
  const byDate = new Map<string, HourlyUsage[]>();

  for (const row of rows) {
    if (!byDate.has(row.date)) {
      byDate.set(row.date, []);
    }
    byDate.get(row.date)!.push({
      hour: row.hour,
      input: row.input_tokens,
      output: row.output_tokens,
    });
  }

  const result: DailyTokenUsage[] = [];

  for (const [date, hourlyUsage] of byDate) {
    const dailyTotal = hourlyUsage.reduce(
      (acc, h) => ({
        input: acc.input + h.input,
        output: acc.output + h.output,
      }),
      { input: 0, output: 0 }
    );

    result.push({ date, hourlyUsage, dailyTotal });
  }

  return result;
}

export function getTotals(days: number): { input: number; output: number } {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const row = getDb().prepare(`
    SELECT
      COALESCE(SUM(input_tokens), 0) as total_input,
      COALESCE(SUM(output_tokens), 0) as total_output
    FROM token_history
    WHERE date >= ?
  `).get(cutoffStr) as { total_input: number; total_output: number };

  return {
    input: row.total_input,
    output: row.total_output,
  };
}

export function getAverages(days: number = 7): { input: number; output: number } {
  const history = getHistory(days);
  if (history.length === 0) return { input: 0, output: 0 };

  const totals = history.reduce(
    (acc, day) => ({
      input: acc.input + day.dailyTotal.input,
      output: acc.output + day.dailyTotal.output,
    }),
    { input: 0, output: 0 }
  );

  return {
    input: Math.round(totals.input / history.length),
    output: Math.round(totals.output / history.length),
  };
}

export function clear(): void {
  getDb().prepare('DELETE FROM token_history').run();
}

/**
 * Clean up entries older than maxDays
 */
export function cleanup(maxDays: number = 30): void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  getDb().prepare('DELETE FROM token_history WHERE date < ?').run(cutoffStr);
}
