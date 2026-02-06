import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  captureScreen,
  captureActiveWindow,
  analyzeScreenshot,
  verifyUIElement,
  listScreenshots,
  deleteScreenshot,
  getLatestScreenshot,
} from '../services/screenshot';

const router: Router = Router();

// POST /capture - captureScreen
router.post('/capture', asyncHandler(async (req, res) => {
  const options = req.body;
  const result = await captureScreen(options);
  res.json(result);
}));

// POST /capture-active - captureActiveWindow
router.post('/capture-active', asyncHandler(async (req, res) => {
  const result = await captureActiveWindow();
  res.json(result);
}));

// POST /analyze - analyzeScreenshot
router.post('/analyze', asyncHandler(async (req, res) => {
  const { screenshotPath, prompt } = req.body;
  const result = await analyzeScreenshot(screenshotPath, prompt);
  res.json(result);
}));

// POST /verify - verifyUIElement
router.post('/verify', asyncHandler(async (req, res) => {
  const { description, screenshotPath } = req.body;
  const result = await verifyUIElement(description, screenshotPath);
  res.json(result);
}));

// GET /latest - getLatestScreenshot (BEFORE /:filePath)
router.get('/latest', asyncHandler(async (req, res) => {
  const result = getLatestScreenshot();
  res.json(result);
}));

// GET / - listScreenshots
router.get('/', asyncHandler(async (req, res) => {
  const result = listScreenshots();
  res.json(result);
}));

// DELETE / - deleteScreenshot (use query param or body for filePath)
router.delete('/', asyncHandler(async (req, res) => {
  const filePath = (req.query.filePath as string) || req.body?.filePath;
  const result = deleteScreenshot(filePath);
  res.json({ success: result });
}));

export default router;
