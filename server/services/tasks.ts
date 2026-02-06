/**
 * Tasks Service - Adapted from electron/services/tasks.ts
 * Replaces electron-store with SQLite via tasks-repo
 * Keeps all task scheduling logic, dependency tracking, retry/backoff logic
 */

import * as tasksRepo from '../db/repositories/tasks-repo';

// Re-export types from the repo so consumers can import from this service
export type { Task, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput, TasksStats } from '../db/repositories/tasks-repo';
import type { Task, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput, TasksStats } from '../db/repositories/tasks-repo';

/**
 * Initialize the tasks store. No-op for SQLite (tables created at DB init).
 */
export function initTasksStore(): void {
  // No-op - SQLite tables are created during database initialization
}

/**
 * List all tasks
 */
export function listTasks(): Task[] {
  return tasksRepo.listTasks();
}

/**
 * Get a task by ID
 */
export function getTaskById(id: string): Task | null {
  return tasksRepo.getById(id);
}

/**
 * Get tasks by project ID
 */
export function getTasksByProject(projectId: string): Task[] {
  return tasksRepo.getByProject(projectId);
}

/**
 * Get tasks by status
 */
export function getTasksByStatus(status: TaskStatus): Task[] {
  return tasksRepo.getByStatus(status);
}

/**
 * Create a new task
 */
export function createTask(input: CreateTaskInput): Task {
  return tasksRepo.create(input);
}

/**
 * Update an existing task
 */
export function updateTask(id: string, updates: UpdateTaskInput): Task | null {
  return tasksRepo.update(id, updates);
}

/**
 * Delete a task
 */
export function deleteTask(id: string): boolean {
  return tasksRepo.remove(id);
}

/**
 * Get task statistics
 */
export function getTasksStats(): TasksStats {
  return tasksRepo.getStats();
}

/**
 * Build a prompt from a task for execution
 */
export function buildTaskPrompt(task: Task): string {
  let prompt = `Task: ${task.title}`;

  if (task.description) {
    prompt += `\n\n${task.description}`;
  }

  if (task.projectName) {
    prompt += `\n\nProject: ${task.projectName}`;
  }

  return prompt;
}

/**
 * Calculate exponential backoff delay for retry
 * Returns delay in milliseconds: 1min, 2min, 4min, 8min, 16min max
 */
export function calculateRetryDelay(retryCount: number): number {
  const baseDelay = 60 * 1000; // 1 minute
  const maxDelay = 16 * 60 * 1000; // 16 minutes
  return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
}

/**
 * Schedule a retry for a failed task with exponential backoff
 */
export function scheduleRetry(id: string, error: string): Task | null {
  const task = getTaskById(id);
  if (!task) return null;

  const newRetryCount = task.retryCount + 1;

  if (newRetryCount >= task.maxRetries) {
    // Max retries exceeded - mark as failed
    return updateTask(id, {
      status: 'failed',
      retryCount: newRetryCount,
      lastError: error,
      lastAttemptAt: new Date().toISOString(),
    });
  }

  // Schedule retry with exponential backoff
  const delay = calculateRetryDelay(newRetryCount);
  const nextRetryAt = new Date(Date.now() + delay).toISOString();

  return updateTask(id, {
    status: 'todo', // Back to todo for retry
    retryCount: newRetryCount,
    lastError: error,
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt,
  });
}

/**
 * Get tasks that are not blocked by uncompleted dependencies
 */
export function getUnblockedTasks(): Task[] {
  const tasks = listTasks();
  const completedIds = new Set(
    tasks.filter(t => t.status === 'done').map(t => t.id)
  );

  return tasks.filter(task => {
    if (!task.blockedBy || task.blockedBy.length === 0) {
      return true;
    }
    // Task is unblocked if all dependencies are completed
    return task.blockedBy.every(depId => completedIds.has(depId));
  });
}

/**
 * Update task status to 'blocked' if it has unfinished dependencies
 */
export function updateBlockedStatus(): void {
  tasksRepo.updateBlockedStatus();
}

/**
 * Get the next task to execute based on smart selection criteria:
 * 1. Filter to status === 'todo'
 * 2. Exclude tasks with unfinished blockedBy dependencies
 * 3. Exclude tasks in retry backoff (nextRetryAt > now)
 * 4. Exclude scheduled tasks (scheduledAt > now)
 * 5. Sort by priority (high -> medium -> low), then by creation date
 */
export function getNextExecutableTask(): Task | null {
  return tasksRepo.getNextExecutable();
}

/**
 * Get time until the next task becomes executable (for scheduling)
 * Returns null if there are tasks ready now, or no tasks to wait for
 */
export function getNextExecutableTime(): Date | null {
  const tasks = listTasks();
  const now = new Date();
  const completedIds = new Set(
    tasks.filter(t => t.status === 'done').map(t => t.id)
  );

  let nextTime: Date | null = null;

  for (const task of tasks) {
    if (task.status !== 'todo') continue;

    // Check dependencies
    if (task.blockedBy && task.blockedBy.length > 0) {
      const hasUnfinishedDeps = task.blockedBy.some(depId => !completedIds.has(depId));
      if (hasUnfinishedDeps) continue; // Can't predict when deps will complete
    }

    // Check retry backoff
    if (task.nextRetryAt) {
      const retryTime = new Date(task.nextRetryAt);
      if (retryTime > now) {
        if (!nextTime || retryTime < nextTime) {
          nextTime = retryTime;
        }
        continue;
      }
    }

    // Check scheduled time
    if (task.scheduledAt) {
      const scheduledTime = new Date(task.scheduledAt);
      if (scheduledTime > now) {
        if (!nextTime || scheduledTime < nextTime) {
          nextTime = scheduledTime;
        }
        continue;
      }
    }

    // This task is ready now
    return null;
  }

  return nextTime;
}
