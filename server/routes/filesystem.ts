import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { asyncHandler } from '../middleware/error-handler';
import { detectModes } from '../services/mode-detection';
import type { FolderEntry, FolderRoot, FolderListResult } from '@shared/types';

const router: Router = Router();

const BLOCKED_PATHS = new Set(['/proc', '/sys', '/dev', '/run', '/snap', '/boot']);
const HIDDEN_DIRS = new Set(['node_modules', '__pycache__', 'dist', 'build', '.git', '.next', '.cache']);
const MAX_ENTRIES = 200;

function isBlockedPath(p: string): boolean {
  const normalized = path.resolve(p);
  for (const blocked of BLOCKED_PATHS) {
    if (normalized === blocked || normalized.startsWith(blocked + '/')) {
      return true;
    }
  }
  return false;
}

async function detectRoots(): Promise<FolderRoot[]> {
  const roots: FolderRoot[] = [];
  const home = os.homedir();

  roots.push({ label: 'Home', path: home, type: 'home' });

  // Check for /git directory (common project root)
  try {
    if (fs.existsSync('/git') && fs.statSync('/git').isDirectory()) {
      roots.push({ label: '/git', path: '/git', type: 'project' });
    }
  } catch { /* ignore */ }

  // WSL drive detection
  const modes = await detectModes();
  if (modes.wsl.detected) {
    try {
      const mntEntries = fs.readdirSync('/mnt');
      for (const entry of mntEntries) {
        if (/^[a-z]$/i.test(entry)) {
          const drivePath = `/mnt/${entry}`;
          try {
            if (fs.statSync(drivePath).isDirectory()) {
              roots.push({ label: `${entry.toUpperCase()}:`, path: drivePath, type: 'drive' });
            }
          } catch { /* inaccessible drive */ }
        }
      }
    } catch { /* /mnt not readable */ }
  }

  return roots;
}

// GET /api/filesystem/browse?path=...
router.get('/browse', asyncHandler(async (req, res) => {
  const requestedPath = (req.query.path as string) || os.homedir();
  const targetPath = path.resolve(requestedPath);

  if (isBlockedPath(targetPath)) {
    res.status(403).json({ error: 'Access to this path is blocked' });
    return;
  }

  // Verify path exists and is a directory
  let stat;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    res.status(404).json({ error: 'Path not found' });
    return;
  }

  if (!stat.isDirectory()) {
    res.status(400).json({ error: 'Path is not a directory' });
    return;
  }

  // Read directory entries
  let dirEntries: fs.Dirent[];
  try {
    dirEntries = fs.readdirSync(targetPath, { withFileTypes: true });
  } catch {
    res.status(403).json({ error: 'Cannot read directory' });
    return;
  }

  const entries: FolderEntry[] = [];
  for (const dirent of dirEntries) {
    if (entries.length >= MAX_ENTRIES) break;
    // Skip hidden (dotfiles) and filtered directories
    if (dirent.name.startsWith('.') || HIDDEN_DIRS.has(dirent.name)) continue;
    // Only include directories
    if (!dirent.isDirectory()) continue;

    const fullPath = path.join(targetPath, dirent.name);
    if (isBlockedPath(fullPath)) continue;

    entries.push({ name: dirent.name, path: fullPath });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  const parentPath = targetPath === '/' ? null : path.dirname(targetPath);
  const roots = await detectRoots();

  const result: FolderListResult = {
    currentPath: targetPath,
    parentPath,
    entries,
    roots,
  };

  res.json(result);
}));

export default router;
