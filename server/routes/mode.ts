import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { getSetting } from '../services/settings';
import { switchExecutor } from '../services/executor-impl';
import { detectModes } from '../services/mode-detection';
import { broadcast } from '../websocket';

const router: Router = Router();

// GET / - getMode
router.get('/', asyncHandler(async (req, res) => {
  const mode = getSetting('executionMode');
  res.json(mode);
}));

// PUT / - setMode
router.put('/', asyncHandler(async (req, res) => {
  const { mode } = req.body;
  await switchExecutor(mode);
  broadcast('mode-changed', mode);
  res.json({ success: true });
}));

// GET /detect - detectModes
router.get('/detect', asyncHandler(async (req, res) => {
  const modes = await detectModes();
  res.json(modes);
}));

// GET /status - getModeStatus
router.get('/status', asyncHandler(async (req, res) => {
  const status = await detectModes();
  res.json(status);
}));

export default router;
