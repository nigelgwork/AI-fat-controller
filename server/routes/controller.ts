import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  getControllerState,
  activateController,
  deactivateController,
  pauseController,
  resumeController,
  getApprovalQueue,
  approveRequest,
  rejectRequest,
  getActionLogs,
  setProgress,
  clearProgress,
  updateTokenUsage,
  resetTokenUsage,
  setConversationSession,
  getUsageLimitConfig,
  updateUsageLimitConfig,
  getUsagePercentages,
} from '../services/controller';
import { logActivity } from '../stores/activity-log';

const router: Router = Router();

// GET /state - getControllerState
router.get('/state', asyncHandler(async (req, res) => {
  const state = getControllerState();
  res.json(state);
}));

// POST /activate - activateController
router.post('/activate', asyncHandler(async (req, res) => {
  logActivity('system', 'Controller activated', {});
  await activateController();
  res.json({ success: true });
}));

// POST /deactivate - deactivateController
router.post('/deactivate', asyncHandler(async (req, res) => {
  logActivity('system', 'Controller deactivated', {});
  await deactivateController();
  res.json({ success: true });
}));

// POST /pause - pauseController
router.post('/pause', asyncHandler(async (req, res) => {
  logActivity('system', 'Controller paused', {});
  await pauseController();
  res.json({ success: true });
}));

// POST /resume - resumeController
router.post('/resume', asyncHandler(async (req, res) => {
  logActivity('system', 'Controller resumed', {});
  await resumeController();
  res.json({ success: true });
}));

// GET /approvals - getApprovalQueue
router.get('/approvals', asyncHandler(async (req, res) => {
  const queue = getApprovalQueue();
  res.json(queue);
}));

// POST /approvals/:id/approve - approveRequest
router.post('/approvals/:id/approve', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  logActivity('user_action', 'Approval request approved', { requestId: id });
  await approveRequest(id);
  res.json({ success: true });
}));

// POST /approvals/:id/reject - rejectRequest
router.post('/approvals/:id/reject', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { reason } = req.body;
  logActivity('user_action', 'Approval request rejected', { requestId: id, reason });
  await rejectRequest(id, reason);
  res.json({ success: true });
}));

// GET /logs - getActionLogs
router.get('/logs', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const logs = getActionLogs(limit);
  res.json(logs);
}));

// POST /progress - setControllerProgress
router.post('/progress', asyncHandler(async (req, res) => {
  const { phase, step, totalSteps, description } = req.body;
  setProgress(phase, step, totalSteps, description);
  res.json({ success: true });
}));

// DELETE /progress - clearControllerProgress
router.delete('/progress', asyncHandler(async (req, res) => {
  clearProgress();
  res.json({ success: true });
}));

// POST /token-usage - updateTokenUsage
router.post('/token-usage', asyncHandler(async (req, res) => {
  const { input, output } = req.body;
  updateTokenUsage(input, output);
  res.json({ success: true });
}));

// DELETE /token-usage - resetTokenUsage
router.delete('/token-usage', asyncHandler(async (req, res) => {
  resetTokenUsage();
  res.json({ success: true });
}));

// POST /conversation-session - setConversationSession
router.post('/conversation-session', asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  setConversationSession(sessionId);
  res.json({ success: true });
}));

// GET /usage-limits - getUsageLimitConfig
router.get('/usage-limits', asyncHandler(async (req, res) => {
  const config = getUsageLimitConfig();
  res.json(config);
}));

// PUT /usage-limits - updateUsageLimitConfig
router.put('/usage-limits', asyncHandler(async (req, res) => {
  updateUsageLimitConfig(req.body);
  res.json({ success: true });
}));

// GET /usage-percentages - getUsagePercentages
router.get('/usage-percentages', asyncHandler(async (req, res) => {
  const percentages = getUsagePercentages();
  res.json(percentages);
}));

export default router;
