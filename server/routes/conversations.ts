import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  listConversationSessions,
  getConversationSession,
  createConversationSession,
  appendConversationEntry,
  loadConversation,
  updateConversationSession,
  deleteConversationSession,
  getRecentConversations,
  searchConversations,
  getConversationStats,
  linkClaudeCodeSession,
  getResumableSessions,
  unlinkClaudeCodeSession,
  findSessionByClaudeId,
} from '../services/conversations';

const router: Router = Router();

// GET /recent - getRecentConversations (BEFORE /:id)
router.get('/recent', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const conversations = getRecentConversations(limit);
  res.json(conversations);
}));

// GET /stats - getConversationStats (BEFORE /:id)
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = getConversationStats();
  res.json(stats);
}));

// GET /search - searchConversations (BEFORE /:id)
router.get('/search', asyncHandler(async (req, res) => {
  const query = req.query.query as string;
  const projectId = req.query.projectId as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const results = searchConversations(query, { projectId, limit });
  res.json(results);
}));

// GET /resumable - getResumableSessions (BEFORE /:id)
router.get('/resumable', asyncHandler(async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const sessions = getResumableSessions(projectId);
  res.json(sessions);
}));

// GET /by-claude-id/:claudeId - findSessionByClaudeId (BEFORE /:id)
router.get('/by-claude-id/:claudeId', asyncHandler(async (req, res) => {
  const claudeId = req.params.claudeId as string;
  const session = findSessionByClaudeId(claudeId);
  res.json(session);
}));

// POST / - createConversationSession
router.post('/', asyncHandler(async (req, res) => {
  const { projectId, projectName } = req.body;
  const session = createConversationSession(projectId, projectName);
  res.json(session);
}));

// GET / - listConversationSessions (with optional ?projectId query)
router.get('/', asyncHandler(async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const sessions = listConversationSessions(projectId);
  res.json(sessions);
}));

// GET /:id - getConversationSession
router.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const session = getConversationSession(id);
  res.json(session);
}));

// PUT /:id - updateConversationSession
router.put('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const updated = updateConversationSession(id, req.body);
  res.json(updated);
}));

// DELETE /:id - deleteConversationSession
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const result = deleteConversationSession(id);
  res.json({ success: result });
}));

// POST /:id/entries - appendConversationEntry
router.post('/:id/entries', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const entry = appendConversationEntry(id, req.body);
  res.json(entry);
}));

// GET /:id/entries - loadConversation
router.get('/:id/entries', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  const entries = loadConversation(id, { limit, offset });
  res.json(entries);
}));

// POST /:id/link-claude - linkClaudeSession
router.post('/:id/link-claude', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { claudeSessionId, claudeSessionPath } = req.body;
  const result = linkClaudeCodeSession(id, claudeSessionId, claudeSessionPath);
  res.json(result);
}));

// DELETE /:id/link-claude - unlinkClaudeSession
router.delete('/:id/link-claude', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const result = unlinkClaudeCodeSession(id);
  res.json(result);
}));

export default router;
