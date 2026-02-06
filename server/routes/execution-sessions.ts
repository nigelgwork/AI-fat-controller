import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  getActiveSessions,
  getSessionHistory,
  getSession,
  getSessionLogs,
  cancelSession,
} from '../services/session-manager';
import { cancelExecution } from '../services/executor/utils';

const router: Router = Router();

// GET /active - getActiveSessions (BEFORE /:id)
router.get('/active', asyncHandler(async (req, res) => {
  const sessions = getActiveSessions();
  res.json(sessions);
}));

// GET /history - getSessionHistory
router.get('/history', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const history = getSessionHistory(limit);
  res.json(history);
}));

// GET /:id - getSession
router.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const session = getSession(id);
  res.json(session);
}));

// GET /:id/logs - getSessionLogs
router.get('/:id/logs', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const logs = getSessionLogs(id, limit);
  res.json(logs);
}));

// POST /:id/cancel - cancelSession
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  // Cancel both the execution process and the session record
  cancelExecution(id);
  const result = cancelSession(id);
  res.json(result);
}));

export default router;
