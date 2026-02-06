import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { getSystemStatus } from '../services/projects';
import { getDebugInfo } from '../services/mode-detection';

const router: Router = Router();

// GET /status - getSystemStatus
router.get('/status', asyncHandler(async (req, res) => {
  const status = await getSystemStatus();
  res.json(status);
}));

// GET /version - getVersion from package.json
router.get('/version', asyncHandler(async (req, res) => {
  const path = require('path');
  const packagePath = path.join(process.cwd(), 'package.json');
  const { version } = require(packagePath);
  res.json({ version });
}));

// GET /debug - getDebugInfo
router.get('/debug', asyncHandler(async (req, res) => {
  const debugInfo = await getDebugInfo();
  res.json(debugInfo);
}));

export default router;
