import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  enableFile: boolean;
  maxFileSize: number;
  maxFiles: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LogConfig = {
  level: 'info',
  enableFile: false,
  maxFileSize: 5 * 1024 * 1024,
  maxFiles: 3,
};

let config: LogConfig = { ...DEFAULT_CONFIG };
let logStream: fs.WriteStream | null = null;
let currentLogFile: string = '';

export function configureLogger(newConfig: Partial<LogConfig>): void {
  config = { ...config, ...newConfig };
  if (config.enableFile && !logStream) {
    initFileLogging();
  } else if (!config.enableFile && logStream) {
    closeFileLogging();
  }
}

function getLogDirectory(): string {
  return path.join(getDataDir(), 'logs');
}

function initFileLogging(): void {
  try {
    const logDir = getLogDirectory();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    currentLogFile = path.join(logDir, `app-${Date.now()}.log`);
    logStream = fs.createWriteStream(currentLogFile, { flags: 'a' });
  } catch (err) {
    console.error('[Logger] Failed to initialize file logging:', err);
  }
}

function closeFileLogging(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

function formatDataItem(data: unknown): string {
  if (data === undefined) return '';
  if (data instanceof Error) return `${data.message}\n${data.stack}`;
  if (typeof data === 'object' && data !== null) {
    try { return JSON.stringify(data); } catch { return '[Object]'; }
  }
  return String(data);
}

function formatMessage(level: LogLevel, module: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  const moduleStr = module ? `[${module}]` : '';
  const messageContent = args.map(arg => formatDataItem(arg)).join(' ');
  return `${timestamp} ${levelStr} ${moduleStr} ${messageContent}`;
}

function writeToFile(formatted: string): void {
  if (logStream) {
    logStream.write(formatted + '\n');
    try {
      const stats = fs.statSync(currentLogFile);
      if (stats.size > config.maxFileSize) {
        closeFileLogging();
        initFileLogging();
      }
    } catch { /* ignore */ }
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

export function createLogger(module: string) {
  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) { const f = formatMessage('debug', module, ...args); console.debug(f); writeToFile(f); }
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) { const f = formatMessage('info', module, ...args); console.log(f); writeToFile(f); }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) { const f = formatMessage('warn', module, ...args); console.warn(f); writeToFile(f); }
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) { const f = formatMessage('error', module, ...args); console.error(f); writeToFile(f); }
    },
  };
}

export const logger = createLogger('App');

if (typeof process !== 'undefined') {
  process.on('exit', closeFileLogging);
}
