import { getDb } from '../database';

/**
 * Project Briefs Repository - brief CRUD, deep dive plan CRUD
 */

export interface ProjectBrief {
  id: string;
  projectId: string;
  projectPath: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  techStack: string[];
  keyFiles: Array<{ path: string; purpose: string }>;
  architecture: string;
  recentChanges: Array<{ date: string; summary: string; hash: string }>;
  activeWork: string[];
  suggestedTasks: Array<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }>;
  codeMetrics?: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };
}

export interface DeepDiveTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  estimatedComplexity: 'low' | 'medium' | 'high';
  executionOutput?: string;
  executionError?: string;
  executedAt?: string;
}

export interface DeepDivePlan {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  status: 'draft' | 'approved' | 'in_progress' | 'completed';
  phases: Array<{
    id: string;
    name: string;
    description: string;
    tasks: DeepDiveTask[];
  }>;
  totalTasks: number;
  completedTasks: number;
}

// ============================================
// Project Briefs
// ============================================

export function getBrief(projectId: string): ProjectBrief | null {
  const row = getDb().prepare('SELECT * FROM project_briefs WHERE project_id = ?').get(projectId) as any;
  if (!row) return null;

  try {
    return JSON.parse(row.brief) as ProjectBrief;
  } catch {
    return null;
  }
}

export function saveBrief(brief: ProjectBrief): void {
  getDb().prepare(`
    INSERT INTO project_briefs (project_id, brief, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET brief = excluded.brief, updated_at = excluded.updated_at
  `).run(
    brief.projectId,
    JSON.stringify(brief),
    brief.createdAt || new Date().toISOString(),
    new Date().toISOString(),
  );
}

export function deleteBrief(projectId: string): boolean {
  const result = getDb().prepare('DELETE FROM project_briefs WHERE project_id = ?').run(projectId);
  return result.changes > 0;
}

export function listBriefs(): ProjectBrief[] {
  const rows = getDb().prepare('SELECT brief FROM project_briefs ORDER BY updated_at DESC').all() as Array<{ brief: string }>;

  return rows.map(row => {
    try {
      return JSON.parse(row.brief) as ProjectBrief;
    } catch {
      return null;
    }
  }).filter((b): b is ProjectBrief => b !== null);
}

// ============================================
// Deep Dive Plans
// ============================================

export function getPlan(projectId: string): DeepDivePlan | null {
  const row = getDb().prepare('SELECT * FROM deep_dive_plans WHERE project_id = ?').get(projectId) as any;
  if (!row) return null;

  try {
    return JSON.parse(row.plan) as DeepDivePlan;
  } catch {
    return null;
  }
}

export function savePlan(plan: DeepDivePlan): void {
  getDb().prepare(`
    INSERT INTO deep_dive_plans (project_id, plan, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET plan = excluded.plan, updated_at = excluded.updated_at
  `).run(
    plan.projectId,
    JSON.stringify(plan),
    plan.createdAt || new Date().toISOString(),
    new Date().toISOString(),
  );
}

export function updatePlan(
  projectId: string,
  updates: Partial<Pick<DeepDivePlan, 'status'>> & {
    taskUpdates?: Array<{
      taskId: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      executionOutput?: string;
      executionError?: string;
      executedAt?: string;
    }>;
  }
): DeepDivePlan | null {
  const plan = getPlan(projectId);
  if (!plan) return null;

  if (updates.status) {
    plan.status = updates.status;
  }

  if (updates.taskUpdates) {
    for (const taskUpdate of updates.taskUpdates) {
      for (const phase of plan.phases) {
        const task = phase.tasks.find(t => t.id === taskUpdate.taskId);
        if (task) {
          task.status = taskUpdate.status;
          if (taskUpdate.executionOutput !== undefined) task.executionOutput = taskUpdate.executionOutput;
          if (taskUpdate.executionError !== undefined) task.executionError = taskUpdate.executionError;
          if (taskUpdate.executedAt !== undefined) task.executedAt = taskUpdate.executedAt;
          break;
        }
      }
    }

    // Recalculate completed tasks
    plan.completedTasks = plan.phases.reduce(
      (sum, phase) => sum + phase.tasks.filter(t => t.status === 'completed').length,
      0
    );
  }

  savePlan(plan);
  return plan;
}

export function deletePlan(projectId: string): boolean {
  const result = getDb().prepare('DELETE FROM deep_dive_plans WHERE project_id = ?').run(projectId);
  return result.changes > 0;
}

export function listPlans(): DeepDivePlan[] {
  const rows = getDb().prepare('SELECT plan FROM deep_dive_plans ORDER BY updated_at DESC').all() as Array<{ plan: string }>;

  return rows.map(row => {
    try {
      return JSON.parse(row.plan) as DeepDivePlan;
    } catch {
      return null;
    }
  }).filter((p): p is DeepDivePlan => p !== null);
}
