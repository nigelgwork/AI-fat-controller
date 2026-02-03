import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  enableFile: boolean;
  maxFileSize: number; // bytes
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
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 3,
};

let config: LogConfig = { ...DEFAULT_CONFIG };
let logStream: fs.WriteStream | null = null;
let currentLogFile: string = '';

/**
 * Configure the logger
 */
export function configureLogger(newConfig: Partial<LogConfig>): void {
  config = { ...config, ...newConfig };

  if (config.enableFile && !logStream) {
    initFileLogging();
  } else if (!config.enableFile && logStream) {
    closeFileLogging();
  }
}

/**
 * Initialize file logging
 */
function initFileLogging(): void {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    currentLogFile = path.join(logDir, `app-${Date.now()}.log`);
    logStream = fs.createWriteStream(currentLogFile, { flags: 'a' });

    // Clean up old log files
    cleanupOldLogs(logDir);
  } catch (err) {
    console.error('[Logger] Failed to initialize file logging:', err);
  }
}

/**
 * Close file logging
 */
function closeFileLogging(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

/**
 * Clean up old log files, keeping only the most recent
 */
function cleanupOldLogs(logDir: string): void {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: path.join(logDir, f),
        mtime: fs.statSync(path.join(logDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Remove files beyond maxFiles limit
    for (let i = config.maxFiles; i < files.length; i++) {
      fs.unlinkSync(files[i].path);
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

/**
 * Format a log message
 */
function formatMessage(level: LogLevel, module: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  const moduleStr = module ? `[${module}]` : '';

  let formatted = `${timestamp} ${levelStr} ${moduleStr} ${message}`;

  if (data !== undefined) {
    if (data instanceof Error) {
      formatted += ` ${data.message}\n${data.stack}`;
    } else if (typeof data === 'object') {
      try {
        formatted += ` ${JSON.stringify(data)}`;
      } catch {
        formatted += ` [Object]`;
      }
    } else {
      formatted += ` ${data}`;
    }
  }

  return formatted;
}

/**
 * Write to log file if enabled
 */
function writeToFile(formatted: string): void {
  if (logStream) {
    logStream.write(formatted + '\n');

    // Check file size and rotate if needed
    try {
      const stats = fs.statSync(currentLogFile);
      if (stats.size > config.maxFileSize) {
        closeFileLogging();
        initFileLogging();
      }
    } catch {
      // Ignore stat errors
    }
  }
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, data?: unknown) => {
      if (shouldLog('debug')) {
        const formatted = formatMessage('debug', module, message, data);
        console.debug(formatted);
        writeToFile(formatted);
      }
    },

    info: (message: string, data?: unknown) => {
      if (shouldLog('info')) {
        const formatted = formatMessage('info', module, message, data);
        console.log(formatted);
        writeToFile(formatted);
      }
    },

    warn: (message: string, data?: unknown) => {
      if (shouldLog('warn')) {
        const formatted = formatMessage('warn', module, message, data);
        console.warn(formatted);
        writeToFile(formatted);
      }
    },

    error: (message: string, data?: unknown) => {
      if (shouldLog('error')) {
        const formatted = formatMessage('error', module, message, data);
        console.error(formatted);
        writeToFile(formatted);
      }
    },
  };
}

// Default logger for general use
export const logger = createLogger('App');

// Cleanup on exit
if (typeof process !== 'undefined') {
  process.on('exit', closeFileLogging);
}
