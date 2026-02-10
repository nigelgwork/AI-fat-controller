/**
 * Zod schemas for runtime validation of external data
 *
 * These schemas validate:
 * - Claude API responses
 * - Settings/configuration
 * - File data formats
 */

import { z } from 'zod';

// ============================================
// Claude Response Schemas
// ============================================

/**
 * Token usage from Claude API
 */
export const TokenUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
});

/**
 * Model usage details from Claude API
 */
export const ModelUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  cacheReadInputTokens: z.number().optional(),
  cacheCreationInputTokens: z.number().optional(),
  contextWindow: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  costUSD: z.number().optional(),
});

/**
 * Claude JSON stream message types
 */
export const ClaudeMessageSchema = z.object({
  type: z.enum(['assistant', 'user', 'result', 'error', 'system']),
  message: z.object({
    content: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
      name: z.string().optional(),
      input: z.unknown().optional(),
    })).optional(),
  }).optional(),
  result: z.string().optional(),
  is_error: z.boolean().optional(),
  duration_ms: z.number().optional(),
  total_cost_usd: z.number().optional(),
  num_turns: z.number().optional(),
  usage: TokenUsageSchema.optional(),
  modelUsage: z.record(z.string(), ModelUsageSchema).optional(),
  tool_use_result: z.object({
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    is_error: z.boolean().optional(),
  }).optional(),
});

export type ClaudeMessage = z.infer<typeof ClaudeMessageSchema>;

// ============================================
// Settings Schemas
// ============================================

/**
 * Execution mode setting
 */
export const ExecutionModeSchema = z.enum(['windows', 'wsl']);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

/**
 * Window bounds for persistence
 */
export const WindowBoundsSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(400).default(1400),
  height: z.number().min(300).default(900),
  isMaximized: z.boolean().default(false),
});

export type WindowBounds = z.infer<typeof WindowBoundsSchema>;

/**
 * WSL configuration
 */
export const WslConfigSchema = z.object({
  distro: z.string().min(1).default('Ubuntu'),
  claudePath: z.string().optional(),
});

export type WslConfig = z.infer<typeof WslConfigSchema>;

/**
 * Windows configuration
 */
export const WindowsConfigSchema = z.object({
  claudePath: z.string().optional(),
});

export type WindowsConfig = z.infer<typeof WindowsConfigSchema>;

/**
 * Application settings
 */
export const AppSettingsSchema = z.object({
  executionMode: ExecutionModeSchema.default('windows'),
  windowBounds: WindowBoundsSchema.optional(),
  minimizeToTray: z.boolean().default(false),
  startMinimized: z.boolean().default(false),
  hasCompletedSetup: z.boolean().default(false),
  wsl: WslConfigSchema.optional(),
  windows: WindowsConfigSchema.optional(),
  lastUpdateCheck: z.string().optional(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ============================================
// Validation Helpers
// ============================================

/**
 * Safely parse Claude JSON message
 */
export function parseClaudeMessage(data: unknown): ClaudeMessage | null {
  const result = ClaudeMessageSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.warn('[Schema] Failed to parse Claude message:', result.error.message);
  return null;
}

/**
 * Safely parse and validate settings
 */
export function parseSettings(data: unknown): AppSettings {
  const result = AppSettingsSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.warn('[Schema] Invalid settings, using defaults:', result.error.message);
  return AppSettingsSchema.parse({});
}

/**
 * Validate execution mode
 */
export function isValidExecutionMode(mode: unknown): mode is ExecutionMode {
  return ExecutionModeSchema.safeParse(mode).success;
}

/**
 * Validate and coerce window bounds
 */
export function validateWindowBounds(bounds: unknown): WindowBounds {
  const result = WindowBoundsSchema.safeParse(bounds);
  if (result.success) {
    return result.data;
  }
  return WindowBoundsSchema.parse({});
}
