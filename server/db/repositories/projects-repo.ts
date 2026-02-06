import { getDb } from '../database';

/**
 * Projects Repository - CRUD operations for the projects table
 */

export interface Project {
  id: string;
  name: string;
  path: string;
  hasBeads: boolean;
  hasClaude: boolean;
  lastModified?: string;
  gitRemote?: string;
  gitBranch?: string;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  path: string;
  hasBeads?: boolean;
  hasClaude?: boolean;
  lastModified?: string;
  gitRemote?: string;
  gitBranch?: string;
}

export interface UpdateProjectInput {
  name?: string;
  path?: string;
  hasBeads?: boolean;
  hasClaude?: boolean;
  lastModified?: string;
  gitRemote?: string;
  gitBranch?: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function rowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    hasBeads: !!row.has_beads,
    hasClaude: !!row.has_claude,
    lastModified: row.last_modified || undefined,
    gitRemote: row.git_remote || undefined,
    gitBranch: row.git_branch || undefined,
    createdAt: row.created_at,
  };
}

export function list(): Project[] {
  const rows = getDb().prepare('SELECT * FROM projects ORDER BY name ASC').all();
  return rows.map(rowToProject);
}

export function getById(id: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return row ? rowToProject(row) : null;
}

export function getByPath(projectPath: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE path = ?').get(projectPath);
  return row ? rowToProject(row) : null;
}

export function create(input: CreateProjectInput): Project {
  const id = generateId();

  getDb().prepare(`
    INSERT INTO projects (id, name, path, has_beads, has_claude, last_modified, git_remote, git_branch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.path,
    input.hasBeads ? 1 : 0,
    input.hasClaude ? 1 : 0,
    input.lastModified || null,
    input.gitRemote || null,
    input.gitBranch || null,
  );

  return getById(id)!;
}

export function update(id: string, updates: UpdateProjectInput): Project | null {
  const existing = getById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.path !== undefined) { fields.push('path = ?'); values.push(updates.path); }
  if (updates.hasBeads !== undefined) { fields.push('has_beads = ?'); values.push(updates.hasBeads ? 1 : 0); }
  if (updates.hasClaude !== undefined) { fields.push('has_claude = ?'); values.push(updates.hasClaude ? 1 : 0); }
  if (updates.lastModified !== undefined) { fields.push('last_modified = ?'); values.push(updates.lastModified); }
  if (updates.gitRemote !== undefined) { fields.push('git_remote = ?'); values.push(updates.gitRemote); }
  if (updates.gitBranch !== undefined) { fields.push('git_branch = ?'); values.push(updates.gitBranch); }

  if (fields.length === 0) return existing;

  values.push(id);
  getDb().prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getById(id);
}

export function remove(id: string): boolean {
  const result = getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

export function upsertByPath(input: CreateProjectInput): Project {
  const existing = getByPath(input.path);
  if (existing) {
    return update(existing.id, input)!;
  }
  return create(input);
}
