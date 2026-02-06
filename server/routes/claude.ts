import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { getExecutor } from '../services/executor';
import { detectClaudeSessions } from '../services/projects';

const router: Router = Router();

// POST /execute - executeClaudeCode
router.post('/execute', asyncHandler(async (req, res) => {
  const { message, systemPrompt, projectPath, imagePaths } = req.body;
  const executor = await getExecutor();
  const result = await executor.runClaude(message, systemPrompt, projectPath, imagePaths);
  res.json(result);
}));

// POST /resume - resumeClaudeSession
router.post('/resume', asyncHandler(async (req, res) => {
  const { message, sessionId, systemPrompt, projectPath } = req.body;
  const executor = await getExecutor();
  const result = await executor.runClaude(message, systemPrompt, projectPath, undefined, undefined, { resumeSessionId: sessionId });
  res.json(result);
}));

// POST /continue - continueClaudeSession
router.post('/continue', asyncHandler(async (req, res) => {
  const { message, systemPrompt, projectPath } = req.body;
  const executor = await getExecutor();
  const result = await executor.runClaude(message, systemPrompt, projectPath, undefined, undefined, { continueSession: true });
  res.json(result);
}));

// GET /sessions - getClaudeSessions
router.get('/sessions', asyncHandler(async (req, res) => {
  const sessions = await detectClaudeSessions();
  res.json(sessions);
}));

export default router;
