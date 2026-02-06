import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  listClaudeCodeSessions,
  getClaudeCodeSession,
  canResumeSession,
  findLatestSession,
  getRecentSessions,
} from '../services/claude-sessions';

const router: Router = Router();

// GET /recent - getRecentClaudeSessions (BEFORE /:id)
router.get('/recent', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const sessions = await getRecentSessions(limit);
  res.json(sessions);
}));

// GET /latest/:projectPath - findLatestClaudeSession (use query param for path)
router.get('/latest/:projectPath', asyncHandler(async (req, res) => {
  const projectPath = req.params.projectPath as string;
  const sessionId = await findLatestSession(projectPath);
  res.json(sessionId);
}));

// GET / - listClaudeCodeSessions
router.get('/', asyncHandler(async (req, res) => {
  const projectPath = req.query.projectPath as string | undefined;
  const sessions = await listClaudeCodeSessions(projectPath);
  res.json(sessions);
}));

// GET /:id - getClaudeCodeSession
router.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const session = await getClaudeCodeSession(id);
  res.json(session);
}));

// GET /:id/can-resume - canResumeClaudeSession
router.get('/:id/can-resume', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const canResume = await canResumeSession(id);
  res.json(canResume);
}));

export default router;
