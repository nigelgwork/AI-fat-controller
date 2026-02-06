/**
 * Server-side Input Validation Utilities
 *
 * Provides Zod schemas and validation helpers for API handler inputs.
 * Standalone copy of electron/utils/ipc-validation.ts (pure Zod, no Electron deps).
 */

import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const ExecutionModeSchema = z.enum(['windows', 'wsl']);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const NonEmptyStringSchema = z.string().min(1, 'String cannot be empty');

export const FilePathSchema = z.string().min(1).refine(
  (path) => !path.includes('\0'), // Null byte check
  'Invalid file path'
);

export const CommandArgsSchema = z.array(z.string()).max(100, 'Too many arguments');

// ============================================
// Task Schemas
// ============================================

export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);

export const CreateTaskInputSchema = z.object({
  title: NonEmptyStringSchema.max(500),
  description: z.string().max(10000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
});

export const UpdateTaskInputSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(10000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
});

// ============================================
// Controller Schemas
// ============================================

export const TokenUsageUpdateSchema = z.object({
  input: z.number().nonnegative().int(),
  output: z.number().nonnegative().int(),
  contextWindow: z.number().nonnegative().int().optional(),
});

export const UsageLimitConfigSchema = z.object({
  maxTokensPerHour: z.number().positive().int().optional(),
  maxTokensPerDay: z.number().positive().int().optional(),
  pauseThreshold: z.number().min(0).max(1).optional(),
  warningThreshold: z.number().min(0).max(1).optional(),
  autoResumeOnReset: z.boolean().optional(),
});

export const ProgressUpdateSchema = z.object({
  phase: z.string().max(50),
  step: z.number().nonnegative().int(),
  totalSteps: z.number().positive().int(),
  description: z.string().max(500),
});

// ============================================
// Conversation Schemas
// ============================================

export const ConversationEntryInputSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: NonEmptyStringSchema.max(100000),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  tokens: z.object({
    input: z.number().nonnegative().int(),
    output: z.number().nonnegative().int(),
  }).optional(),
});

export const ConversationLoadOptionsSchema = z.object({
  limit: z.number().positive().int().max(1000).optional(),
  offset: z.number().nonnegative().int().optional(),
});

// ============================================
// ntfy Schemas
// ============================================

export const NtfyConfigSchema = z.object({
  enabled: z.boolean().optional(),
  serverUrl: z.string().url().optional(),
  topic: z.string().min(1).max(256).optional(),
  responseTopic: z.string().min(1).max(256).optional(),
  priority: z.enum(['min', 'low', 'default', 'high', 'urgent']).optional(),
  authToken: z.string().max(512).optional(),
  enableDesktopNotifications: z.boolean().optional(),
});

// ============================================
// Screenshot Schemas
// ============================================

export const CaptureOptionsSchema = z.object({
  display: z.number().int().nonnegative().optional(),
  region: z.object({
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).optional(),
});

// ============================================
// MCP Schemas
// ============================================

export const MCPServerConfigSchema = z.object({
  name: NonEmptyStringSchema.max(100),
  transport: z.enum(['stdio', 'websocket']),
  command: z.string().max(1000).optional(),
  args: z.array(z.string()).max(50).optional(),
  cwd: z.string().max(1000).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean(),
  autoConnect: z.boolean(),
});

// ============================================
// Validation Helpers
// ============================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validate input against a Zod schema
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  name = 'input'
): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((e) => `${String(e.path.join('.'))}: ${e.message}`).join(', ');
  return { success: false, error: `Invalid ${name}: ${errors}` };
}

/**
 * Validate and throw if invalid - for use in API handlers
 */
export function assertValid<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  name = 'input'
): T {
  const result = validateInput(schema, input, name);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data!;
}

/**
 * Validate execution mode
 */
export function isValidMode(mode: unknown): mode is ExecutionMode {
  return ExecutionModeSchema.safeParse(mode).success;
}

/**
 * Validate session/task ID format (alphanumeric + limited special chars)
 */
export function isValidId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizePath(inputPath: string, basePath?: string): string {
  // Remove null bytes
  let cleanPath = inputPath.replace(/\0/g, '');

  // If basePath provided, ensure the path stays within it
  if (basePath) {
    const path = require('path');
    const resolved = path.resolve(basePath, cleanPath);
    if (!resolved.startsWith(path.resolve(basePath))) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  return cleanPath;
}
