import os from 'os';
import path from 'path';
import fs from 'fs';

export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

export function getHomeDir(): string {
  return os.homedir();
}

export function getTempDir(): string {
  return os.tmpdir();
}

export function getUserDataDir(): string {
  return getDataDir();
}

export function getLogDirectory(): string {
  const logDir = path.join(getDataDir(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
