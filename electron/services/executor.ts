/**
 * Executor module - handles running Claude Code and other commands
 *
 * This file re-exports from the implementation for backwards compatibility.
 * The actual implementation is in executor-impl.ts
 *
 * Structure:
 * - executor/types.ts - Type definitions
 * - executor/utils.ts - Shared utilities
 * - executor-impl.ts - Main executor implementations (WindowsExecutor, WslExecutor)
 * - executor.ts - Re-exports (this file)
 */

// Re-export everything from the implementation
export {
  // Types
  TokenUsageData,
  ExecuteResult,
  ModeStatus,
  DebugInfo,

  // Process management
  cancelExecution,
  getRunningExecutions,
  cancelAllExecutions,

  // Factory and mode functions
  getExecutor,
  switchExecutor,
  getDebugInfo,
  detectModes,
} from './executor-impl';
