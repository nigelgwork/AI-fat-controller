import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  getActivityLogs,
  searchActivityLogs,
  exportActivityLogs,
  getActivitySummary,
  clearActivityLogs,
  logActivity,
} from '../stores/activity-log';
import type { ActivityCategory } from '../stores/activity-log';

const router: Router = Router();

// GET /search - searchActivityLogs (BEFORE / to avoid conflict)
router.get('/search', asyncHandler(async (req, res) => {
  const { query, category, projectId, limit, offset } = req.query;
  const filters = {
    category: category as ActivityCategory | undefined,
    projectId: projectId as string | undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  };
  const results = searchActivityLogs(query as string, filters);
  res.json(results);
}));

// GET /export - exportActivityLogs
router.get('/export', asyncHandler(async (req, res) => {
  const { format, start, end } = req.query;
  const dateRange = (start || end) ? {
    start: start as string | undefined,
    end: end as string | undefined,
  } : undefined;
  const exported = exportActivityLogs((format as 'json' | 'csv') || 'json', dateRange);
  res.json(exported);
}));

// GET /summary - getActivitySummary
router.get('/summary', asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  const dateRange = (start || end) ? {
    start: start as string | undefined,
    end: end as string | undefined,
  } : undefined;
  const summary = getActivitySummary(dateRange);
  res.json(summary);
}));

// GET / - getActivityLogs
router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, category, projectId } = req.query;
  const options = {
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
    category: category as ActivityCategory | undefined,
    projectId: projectId as string | undefined,
  };
  const logs = getActivityLogs(options);
  res.json(logs);
}));

// POST / - logActivity
router.post('/', asyncHandler(async (req, res) => {
  const { category, action, details, options } = req.body;
  const entry = logActivity(category, action, details || {}, options);
  res.json(entry);
}));

// DELETE / - clearActivityLogs
router.delete('/', asyncHandler(async (req, res) => {
  clearActivityLogs();
  res.json({ success: true });
}));

export default router;
