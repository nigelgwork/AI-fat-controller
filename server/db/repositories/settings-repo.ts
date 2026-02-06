import { getDb } from '../database';

/**
 * Settings Repository - Key/value store for application settings
 */

export function get(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function getTyped<T>(key: string): T | null {
  const value = get(key);
  if (value === null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

export function set(key: string, value: string | number | boolean | object): void {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  getDb().prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, serialized);
}

export function getAll(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function remove(key: string): boolean {
  const result = getDb().prepare('DELETE FROM settings WHERE key = ?').run(key);
  return result.changes > 0;
}

export function has(key: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
  return !!row;
}

export function clear(): void {
  getDb().prepare('DELETE FROM settings').run();
}
