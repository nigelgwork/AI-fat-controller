import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  listTasks,
  getTaskById,
  getTasksByProject,
  getTasksStats,
  createTask,
  updateTask,
  deleteTask,
  buildTaskPrompt,
} from '../services/tasks';
import { getExecutor } from '../services/executor-impl';
import { broadcast } from '../websocket';
import { logActivity } from '../stores/activity-log';

const router: Router = Router();

// GET /stats - getTasksStats (BEFORE /:id to avoid conflict)
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = getTasksStats();
  res.json(stats);
}));

// GET /by-project/:projectId - getTasksByProject
router.get('/by-project/:projectId', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const tasks = getTasksByProject(projectId);
  res.json(tasks);
}));

// GET / - listTasks
router.get('/', asyncHandler(async (req, res) => {
  const tasks = listTasks();
  res.json(tasks);
}));

// GET /:id - getTask
router.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const task = getTaskById(id);
  res.json(task);
}));

// POST / - createTask
router.post('/', asyncHandler(async (req, res) => {
  const task = createTask(req.body);
  res.json(task);
}));

// PUT /:id - updateTask
router.put('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const task = updateTask(id, req.body);
  res.json(task);
}));

// DELETE /:id - deleteTask
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const result = deleteTask(id);
  res.json({ success: result });
}));

// POST /:id/execute - sendTaskToClaude
router.post('/:id/execute', asyncHandler(async (req, res) => {
  const id = req.params.id as string;

  const task = getTaskById(id);
  if (!task) {
    res.json({ success: false, error: 'Task not found' });
    return;
  }

  const executionId = `task-${id}-${Date.now()}`;
  const startTime = Date.now();

  // Update status BEFORE execution
  updateTask(id, { status: 'in_progress' });

  // Notify frontend of task status change
  broadcast('task:statusChanged', { id, status: 'in_progress' });

  // Log activity start
  logActivity('execution', 'Task execution started', {
    taskTitle: task.title,
    projectId: task.projectId,
  }, {
    taskId: id,
    projectId: task.projectId,
  });

  try {
    const prompt = buildTaskPrompt(task);
    const executor = await getExecutor();

    // Run Claude Code with the task as the prompt
    const result = await executor.runClaude(prompt, undefined, undefined, undefined, executionId);

    // Update status AFTER execution based on result
    const newStatus = result.success ? 'done' : 'todo';
    updateTask(id, { status: newStatus });

    // Notify frontend of task status change
    broadcast('task:statusChanged', { id, status: newStatus });

    // Log activity completion
    logActivity('execution', result.success ? 'Task execution completed' : 'Task execution failed', {
      taskTitle: task.title,
      projectId: task.projectId,
      success: result.success,
      error: result.error,
    }, {
      taskId: id,
      projectId: task.projectId,
      tokens: result.tokenUsage ? { input: result.tokenUsage.inputTokens, output: result.tokenUsage.outputTokens } : undefined,
      duration: Date.now() - startTime,
    });

    res.json(result);
  } catch (error) {
    // Revert status on error
    updateTask(id, { status: 'todo' });
    broadcast('task:statusChanged', { id, status: 'todo' });

    // Log activity error
    logActivity('error', 'Task execution error', {
      taskTitle: task.title,
      projectId: task.projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, {
      taskId: id,
      projectId: task.projectId,
      duration: Date.now() - startTime,
    });

    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}));

export default router;
