import { getDb } from '../database';

/**
 * GUI Test Repository - scenario CRUD, results CRUD
 */

export type TestActionType =
  | 'click' | 'type' | 'scroll' | 'shortcut' | 'wait'
  | 'app' | 'shell' | 'snapshot' | 'verify' | 'custom';

export interface TestStep {
  id: string;
  action: TestActionType;
  description: string;
  params: Record<string, unknown>;
  assertion?: {
    type: 'contains' | 'visible' | 'not_visible' | 'matches' | 'custom';
    target: string;
    timeout?: number;
  };
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  application?: string;
  steps: TestStep[];
  createdAt: string;
  updatedAt: string;
}

export interface StepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  screenshot?: string;
  output?: string;
  error?: string;
  assertion?: {
    expected: string;
    actual: string;
    passed: boolean;
  };
}

export interface TestResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: 'passed' | 'failed' | 'error';
  startedAt: string;
  completedAt: string;
  duration: number;
  stepResults: StepResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================
// Scenarios
// ============================================

function rowToScenario(row: any): TestScenario {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    application: row.application || undefined,
    steps: JSON.parse(row.steps),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listScenarios(): TestScenario[] {
  const rows = getDb().prepare(
    'SELECT * FROM gui_test_scenarios ORDER BY updated_at DESC'
  ).all();
  return rows.map(rowToScenario);
}

export function getScenario(id: string): TestScenario | null {
  const row = getDb().prepare('SELECT * FROM gui_test_scenarios WHERE id = ?').get(id);
  return row ? rowToScenario(row) : null;
}

export function createScenario(
  scenario: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'>
): TestScenario {
  const id = generateId();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO gui_test_scenarios (id, name, description, application, steps, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    scenario.name,
    scenario.description,
    scenario.application || null,
    JSON.stringify(scenario.steps),
    now,
    now,
  );

  return getScenario(id)!;
}

export function updateScenario(id: string, updates: Partial<TestScenario>): TestScenario | null {
  const existing = getScenario(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.application !== undefined) { fields.push('application = ?'); values.push(updates.application); }
  if (updates.steps !== undefined) { fields.push('steps = ?'); values.push(JSON.stringify(updates.steps)); }

  fields.push("updated_at = datetime('now')");

  if (fields.length === 1) return existing; // Only updated_at

  values.push(id);
  getDb().prepare(`UPDATE gui_test_scenarios SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getScenario(id);
}

export function deleteScenario(id: string): boolean {
  const result = getDb().prepare('DELETE FROM gui_test_scenarios WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================
// Results
// ============================================

function rowToResult(row: any): TestResult {
  const result = JSON.parse(row.result) as Omit<TestResult, 'id'>;
  return {
    id: row.id,
    ...result,
  };
}

export function getResults(scenarioId: string, limit?: number): TestResult[] {
  const sql = limit
    ? 'SELECT * FROM gui_test_results WHERE scenario_id = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM gui_test_results WHERE scenario_id = ? ORDER BY created_at DESC';

  const rows = limit
    ? getDb().prepare(sql).all(scenarioId, limit)
    : getDb().prepare(sql).all(scenarioId);

  return rows.map(rowToResult);
}

export function getResult(id: string): TestResult | null {
  const row = getDb().prepare('SELECT * FROM gui_test_results WHERE id = ?').get(id);
  return row ? rowToResult(row) : null;
}

export function saveResult(result: Omit<TestResult, 'id'>): TestResult {
  const id = generateId();

  getDb().prepare(`
    INSERT INTO gui_test_results (id, scenario_id, result, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    id,
    result.scenarioId,
    JSON.stringify(result),
    result.completedAt || new Date().toISOString(),
  );

  return { id, ...result };
}

export function deleteResult(id: string): boolean {
  const result = getDb().prepare('DELETE FROM gui_test_results WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteResultsByScenario(scenarioId: string): number {
  const result = getDb().prepare('DELETE FROM gui_test_results WHERE scenario_id = ?').run(scenarioId);
  return result.changes;
}
