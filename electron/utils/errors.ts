/**
 * Custom error classes for the AI Controller application
 *
 * These provide:
 * - Typed errors for different failure scenarios
 * - User-friendly error messages
 * - Error codes for programmatic handling
 */

export enum ErrorCode {
  // Executor errors (1xx)
  EXECUTOR_NOT_INITIALIZED = 100,
  EXECUTOR_TIMEOUT = 101,
  EXECUTOR_CANCELLED = 102,
  EXECUTOR_PROCESS_FAILED = 103,

  // Claude errors (2xx)
  CLAUDE_NOT_FOUND = 200,
  CLAUDE_AUTHENTICATION_FAILED = 201,
  CLAUDE_RATE_LIMITED = 202,
  CLAUDE_RESPONSE_PARSE_ERROR = 203,
  CLAUDE_CONTEXT_EXCEEDED = 204,

  // File system errors (3xx)
  FILE_NOT_FOUND = 300,
  FILE_READ_ERROR = 301,
  FILE_WRITE_ERROR = 302,
  DIRECTORY_NOT_FOUND = 303,

  // Configuration errors (4xx)
  CONFIG_INVALID = 400,
  CONFIG_MISSING = 401,

  // WSL errors (5xx)
  WSL_NOT_AVAILABLE = 500,
  WSL_DISTRO_NOT_FOUND = 501,
  WSL_PATH_CONVERSION_FAILED = 502,

  // Network errors (6xx)
  NETWORK_UNAVAILABLE = 600,
  NETWORK_TIMEOUT = 601,

  // Unknown
  UNKNOWN = 999,
}

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage || message;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when executor operations fail
 */
export class ExecutorError extends AppError {
  constructor(code: ErrorCode, message: string, userMessage?: string, details?: unknown) {
    super(code, message, userMessage, details);
    this.name = 'ExecutorError';
  }
}

/**
 * Error thrown when Claude CLI operations fail
 */
export class ClaudeError extends AppError {
  constructor(code: ErrorCode, message: string, userMessage?: string, details?: unknown) {
    super(code, message, userMessage, details);
    this.name = 'ClaudeError';
  }
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends AppError {
  public readonly path?: string;

  constructor(code: ErrorCode, message: string, filePath?: string, details?: unknown) {
    super(
      code,
      message,
      filePath ? `File operation failed: ${filePath}` : message,
      details
    );
    this.name = 'FileSystemError';
    this.path = filePath;
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends AppError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, 'Configuration error. Please check your settings.', details);
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown when WSL operations fail
 */
export class WslError extends AppError {
  constructor(code: ErrorCode, message: string, userMessage?: string, details?: unknown) {
    super(code, message, userMessage || 'WSL operation failed. Ensure WSL is properly configured.', details);
    this.name = 'WslError';
  }
}

/**
 * Helper to wrap unknown errors into AppError
 */
export function wrapError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      ErrorCode.UNKNOWN,
      error.message,
      'An unexpected error occurred.',
      { originalError: error.name, stack: error.stack }
    );
  }

  return new AppError(
    ErrorCode.UNKNOWN,
    String(error),
    'An unexpected error occurred.',
    { originalValue: error }
  );
}

/**
 * Check if an error is a specific type
 */
export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof AppError && error.code === code;
}

/**
 * Get user-friendly message from any error
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
