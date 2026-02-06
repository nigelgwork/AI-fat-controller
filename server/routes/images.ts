import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../middleware/error-handler';
import { getDataDir } from '../utils/paths';

const router: Router = Router();

// POST /save-temp - save base64 image to temp directory
router.post('/save-temp', asyncHandler(async (req, res) => {
  try {
    const { base64Data, filename } = req.body;

    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');

    // Create temp directory in data dir
    const tempDir = path.join(getDataDir(), 'temp-images');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueName = `${Date.now()}-${filename}`;
    const filePath = path.join(tempDir, uniqueName);

    // Write the file
    fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'));

    res.json({ success: true, path: filePath });
  } catch (error) {
    res.json({ success: false, error: (error as Error).message });
  }
}));

// POST /cleanup - clean up old temp images
router.post('/cleanup', asyncHandler(async (req, res) => {
  try {
    const tempDir = path.join(getDataDir(), 'temp-images');
    if (fs.existsSync(tempDir)) {
      // Delete files older than 1 hour
      const files = fs.readdirSync(tempDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
        }
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: (error as Error).message });
  }
}));

export default router;
