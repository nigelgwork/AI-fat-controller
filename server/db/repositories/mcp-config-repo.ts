import { getDb } from '../database';

/**
 * MCP Config Repository - config CRUD for MCP server configurations
 */

export interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'websocket';
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  autoConnect: boolean;
}

export function list(): MCPServerConfig[] {
  const rows = getDb().prepare('SELECT name, config FROM mcp_configs ORDER BY name ASC').all() as Array<{ name: string; config: string }>;

  return rows.map(row => {
    try {
      return JSON.parse(row.config) as MCPServerConfig;
    } catch {
      return null;
    }
  }).filter((c): c is MCPServerConfig => c !== null);
}

export function get(name: string): MCPServerConfig | null {
  const row = getDb().prepare('SELECT config FROM mcp_configs WHERE name = ?').get(name) as { config: string } | undefined;
  if (!row) return null;

  try {
    return JSON.parse(row.config) as MCPServerConfig;
  } catch {
    return null;
  }
}

export function save(config: MCPServerConfig): void {
  getDb().prepare(`
    INSERT INTO mcp_configs (name, config)
    VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET config = excluded.config
  `).run(config.name, JSON.stringify(config));
}

export function remove(name: string): boolean {
  const result = getDb().prepare('DELETE FROM mcp_configs WHERE name = ?').run(name);
  return result.changes > 0;
}

export function getEnabled(): MCPServerConfig[] {
  return list().filter(c => c.enabled);
}

export function getAutoConnect(): MCPServerConfig[] {
  return list().filter(c => c.enabled && c.autoConnect);
}

/**
 * Bulk save configs (replaces all)
 */
export function saveAll(configs: MCPServerConfig[]): void {
  const db = getDb();
  const deleteAll = db.prepare('DELETE FROM mcp_configs');
  const insert = db.prepare('INSERT INTO mcp_configs (name, config) VALUES (?, ?)');

  const transaction = db.transaction(() => {
    deleteAll.run();
    for (const config of configs) {
      insert.run(config.name, JSON.stringify(config));
    }
  });

  transaction();
}
