import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { createLogger } from '../utils/logger';

const log = createLogger('ModeDetection');
const execAsync = promisify(exec);

// Cache mode detection — environment doesn't change at runtime
let cachedModeStatus: ModeStatus | null = null;

export interface ModeStatus {
  current: 'linux' | 'wsl' | 'windows-interop';
  linux: {
    available: boolean;
    claudePath?: string;
    version?: string;
  };
  windowsInterop: {
    available: boolean;
  };
  wsl: {
    detected: boolean;
    version?: string;
  };
}

function detectWSL(): { detected: boolean; version?: string } {
  try {
    if (fs.existsSync('/proc/version')) {
      const procVersion = fs.readFileSync('/proc/version', 'utf-8');
      if (/microsoft|wsl/i.test(procVersion)) {
        const wsl2 = /WSL2/i.test(procVersion);
        return { detected: true, version: wsl2 ? 'WSL2' : 'WSL1' };
      }
    }
  } catch { /* not WSL */ }
  return { detected: false };
}

export async function detectModes(): Promise<ModeStatus> {
  // Return cached result — environment doesn't change while server is running
  if (cachedModeStatus) return cachedModeStatus;

  const wslInfo = detectWSL();

  const status: ModeStatus = {
    current: wslInfo.detected ? 'wsl' : 'linux',
    linux: { available: false },
    windowsInterop: { available: false },
    wsl: wslInfo,
  };

  // Check native Claude
  try {
    const { stdout: whichResult } = await execAsync('which claude', { timeout: 5000 });
    const claudePath = whichResult.trim();
    if (claudePath) {
      status.linux = {
        available: true,
        claudePath,
      };
      // Version check can be slow, so don't let it block detection
      try {
        const { stdout: version } = await execAsync('claude --version', { timeout: 5000 });
        status.linux.version = version.trim();
      } catch {
        log.info('Claude found but version check timed out');
      }
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

  if (wslInfo.detected) {
    log.info(`Running in ${wslInfo.version || 'WSL'}`);
  } else {
    log.info('Running in native Linux');
  }

  cachedModeStatus = status;
  return status;
}

export async function getDebugInfo() {
  let claudePath = 'Not found';

  try {
    const { stdout } = await execAsync('which claude', { timeout: 5000 });
    claudePath = stdout.trim() || 'Not found';
  } catch { /* ignore */ }

  const wslInfo = detectWSL();

  return {
    isWSL: wslInfo.detected,
    wslVersion: wslInfo.version,
    nodeVersion: process.version,
    platform: process.platform,
    claudePath,
    executionMode: wslInfo.detected ? 'wsl' as const : 'linux' as const,
  };
}
