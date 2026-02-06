import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  generateProjectBrief,
  getProjectBrief,
  deleteProjectBrief,
  listProjectBriefs,
  generateDeepDivePlan,
  getDeepDivePlan,
  updateDeepDivePlan,
  deleteDeepDivePlan,
  executeDeepDiveTask,
  convertDeepDiveToTasks,
  convertSingleTaskToProjectTask,
} from '../services/project-briefs';
import { cancelExecution } from '../services/executor/utils';

const router: Router = Router();

// POST /generate - generateProjectBrief
router.post('/generate', asyncHandler(async (req, res) => {
  const { projectId, projectPath, projectName } = req.body;
  const result = await generateProjectBrief(projectId, projectPath, projectName);
  res.json(result);
}));

// POST /deep-dive/generate - generateDeepDivePlan (BEFORE /:projectId)
router.post('/deep-dive/generate', asyncHandler(async (req, res) => {
  const { projectId, projectPath, projectName, focus } = req.body;
  const result = await generateDeepDivePlan(projectId, projectPath, projectName, focus);
  res.json(result);
}));

// GET /deep-dive/:projectId - getDeepDivePlan
router.get('/deep-dive/:projectId', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const result = getDeepDivePlan(projectId);
  res.json(result);
}));

// PUT /deep-dive/:projectId - updateDeepDivePlan
router.put('/deep-dive/:projectId', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const updates = req.body;
  const result = updateDeepDivePlan(projectId, updates);
  res.json(result);
}));

// DELETE /deep-dive/:projectId - deleteDeepDivePlan
router.delete('/deep-dive/:projectId', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const result = deleteDeepDivePlan(projectId);
  res.json({ success: result });
}));

// POST /deep-dive/:projectId/tasks/:taskId/execute - executeDeepDiveTask
router.post('/deep-dive/:projectId/tasks/:taskId/execute', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;
  const result = await executeDeepDiveTask(projectId, taskId);
  res.json(result);
}));

// POST /deep-dive/:projectId/tasks/:taskId/cancel - cancelDeepDiveTask
router.post('/deep-dive/:projectId/tasks/:taskId/cancel', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;
  const executionId = `deepdive-${projectId}-${taskId}`;
  const cancelled = cancelExecution(executionId);
  if (cancelled) {
    updateDeepDivePlan(projectId, {
      taskUpdates: [{
        taskId,
        status: 'pending',
      }],
    });
  }
  res.json({ cancelled });
}));

// POST /deep-dive/:projectId/convert - convertDeepDiveToTasks
router.post('/deep-dive/:projectId/convert', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const options = req.body;
  const result = convertDeepDiveToTasks(projectId, options);
  res.json(result);
}));

// POST /deep-dive/:projectId/tasks/:taskId/convert - convertSingleTaskToProjectTask
router.post('/deep-dive/:projectId/tasks/:taskId/convert', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;
  const result = convertSingleTaskToProjectTask(projectId, taskId);
  res.json(result);
}));

// GET / - listProjectBriefs
router.get('/', asyncHandler(async (req, res) => {
  const result = listProjectBriefs();
  res.json(result);
}));

// GET /:projectId - getProjectBrief
router.get('/:projectId', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const result = getProjectBrief(projectId);
  res.json(result);
}));

// DELETE /:projectId - deleteProjectBrief
router.delete('/:projectId', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const result = deleteProjectBrief(projectId);
  res.json({ success: result });
}));

export default router;
