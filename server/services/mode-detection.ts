import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { createLogger } from '../utils/logger';

const log = createLogger('ModeDetection');
const execAsync = promisify(exec);

export interface ModeStatus {
  current: 'linux' | 'windows-interop';
  linux: {
    available: boolean;
    claudePath?: string;
    version?: string;
  };
  windowsInterop: {
    available: boolean;
  };
}

export async function detectModes(): Promise<ModeStatus> {
  const status: ModeStatus = {
    current: 'linux',
    linux: { available: false },
    windowsInterop: { available: false },
  };

  // Check native Claude
  try {
    const { stdout: whichResult } = await execAsync('which claude', { timeout: 5000 });
    if (whichResult.trim()) {
      const { stdout: version } = await execAsync('claude --version', { timeout: 10000 });
      status.linux = {
        available: true,
        claudePath: whichResult.trim(),
        version: version.trim(),
      };
    }
  } catch {
    log.info('Claude not found in PATH');
  }

  // Check Windows interop (running inside WSL)
  try {
    if (fs.existsSync('/mnt/c/Windows/System32/cmd.exe')) {
      status.windowsInterop = { available: true };
    }
  } catch {
    // Not in WSL
  }

  return status;
}

export async function getDebugInfo() {
  const gastownPath = process.env.GASTOWN_PATH || '';
  let claudePath = 'Not found';

  try {
    const { stdout } = await execAsync('which claude', { timeout: 5000 });
    claudePath = stdout.trim() || 'Not found';
  } catch { /* ignore */ }

  return {
    isPackaged: process.env.NODE_ENV === 'production',
    resourcesPath: '',
    gtPath: '',
    gtExists: false,
    bdPath: '',
    bdExists: false,
    claudePath,
    gastownPath,
    gastownExists: fs.existsSync(gastownPath),
    executionMode: 'linux' as const,
  };
}
