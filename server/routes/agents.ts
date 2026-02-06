import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentPlugins,
  copyAgentToWindows,
  copyAgentToWsl,
} from '../services/claude-agents';

const router: Router = Router();

// GET /plugins - getAgentPlugins (BEFORE /:id to avoid conflict)
router.get('/plugins', asyncHandler(async (req, res) => {
  const plugins = await getAgentPlugins();
  res.json(plugins);
}));

// GET / - listAgents
router.get('/', asyncHandler(async (req, res) => {
  const agents = await listAgents();
  res.json(agents);
}));

// GET /:id - getAgent
router.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const agent = await getAgent(id);
  res.json(agent);
}));

// POST / - createAgent
router.post('/', asyncHandler(async (req, res) => {
  const agent = await createAgent(req.body);
  res.json(agent);
}));

// PUT /:id - updateAgent
router.put('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const agent = await updateAgent(id, req.body);
  res.json(agent);
}));

// DELETE /:id - deleteAgent
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  await deleteAgent(id);
  res.json({ success: true });
}));

// POST /:id/copy-windows - copyAgentToWindows
router.post('/:id/copy-windows', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const agent = await copyAgentToWindows(id);
  res.json(agent);
}));

// POST /:id/copy-wsl - copyAgentToWsl
router.post('/:id/copy-wsl', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const agent = await copyAgentToWsl(id);
  res.json(agent);
}));

export default router;
