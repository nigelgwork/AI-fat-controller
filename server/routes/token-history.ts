import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  getTokenHistory,
  getTotalUsageForPeriod,
  getAverageDailyUsage,
  clearTokenHistory,
} from '../stores/token-history';

const router: Router = Router();

// GET /total - getTokenHistoryTotal (BEFORE / to avoid conflict)
router.get('/total', asyncHandler(async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 7;
  const total = getTotalUsageForPeriod(days);
  res.json(total);
}));

// GET /average - getTokenHistoryAverage
router.get('/average', asyncHandler(async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 7;
  const average = getAverageDailyUsage(days);
  res.json(average);
}));

// GET / - getTokenHistory (with ?days query)
router.get('/', asyncHandler(async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 7;
  const history = getTokenHistory(days);
  res.json(history);
}));

// DELETE / - clearTokenHistory
router.delete('/', asyncHandler(async (req, res) => {
  clearTokenHistory();
  res.json({ success: true });
}));

export default router;
