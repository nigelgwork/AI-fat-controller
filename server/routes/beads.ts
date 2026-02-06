import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { readBeadsFile, getBeadsStats, getBeadsEvents } from '../services/beads';
import { getSetting } from '../services/settings';

const router: Router = Router();

// GET /stats - getBeadsStats (BEFORE / to avoid conflict)
router.get('/stats', asyncHandler(async (req, res) => {
  const gastownPath = getSetting('gastownPath');
  const stats = getBeadsStats(gastownPath);
  res.json(stats);
}));

// GET /events - getBeadsEvents
router.get('/events', asyncHandler(async (req, res) => {
  const gastownPath = getSetting('gastownPath');
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const events = getBeadsEvents(gastownPath, limit);
  res.json(events);
}));

// GET / - listBeads
router.get('/', asyncHandler(async (req, res) => {
  const gastownPath = getSetting('gastownPath');
  const beads = readBeadsFile(gastownPath);
  res.json(beads);
}));

export default router;
