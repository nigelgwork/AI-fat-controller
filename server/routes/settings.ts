import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { getSettings, getSetting, setSetting } from '../services/settings';

const router: Router = Router();

// GET / - getAllSettings
router.get('/', asyncHandler(async (req, res) => {
  const settings = getSettings();
  res.json(settings);
}));

// GET /:key - getSetting
router.get('/:key', asyncHandler(async (req, res) => {
  const key = req.params.key as string;
  const value = getSetting(key as any);
  res.json(value);
}));

// PUT /:key - setSetting
router.put('/:key', asyncHandler(async (req, res) => {
  const key = req.params.key as string;
  const { value } = req.body;
  setSetting(key as any, value);
  res.json({ success: true });
}));

export default router;
