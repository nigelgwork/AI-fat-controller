import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { ChildProcess } from 'child_process';
import { runningProcesses, TokenUsageData } from './types';
import { createLogger } from '../../utils/logger';

const log = createLogger('Executor');

/**
 * Cancel a specific execution by ID
 */
export function cancelExecution(executionId: string): boolean {
  const process = runningProcesses.get(executionId);
  if (process) {
    log.info('[Executor] Cancelling execution:', executionId);
    process.kill('SIGTERM');
    runningProcesses.delete(executionId);
    return true;
  }
  return false;
}

/**
 * Get list of running execution IDs
 */
export function getRunningExecutions(): string[] {
  return Array.from(runningProcesses.keys());
}

/**
 * Cancel all running executions (cleanup on app quit)
 */
export function cancelAllExecutions(): void {
  log.info(`[Executor] Cleaning up ${runningProcesses.size} running processes`);
  for (const [executionId, process] of runningProcesses) {
    try {
      log.info(`[Executor] Killing process: ${executionId}`);
      process.kill('SIGTERM');
    } catch (err) {
      log.error(`[Executor] Failed to kill process ${executionId}:`, err);
    }
  }
  runningProcesses.clear();
}

/**
 * Ensure a directory exists
 */
export function ensureDir(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    log.error(`Failed to create directory ${dirPath}:`, err);
  }
}

/**
 * Get a valid working directory, falling back to user home if preferred path doesn't exist
 */
export function getValidCwd(preferredPath: string): string {
  if (preferredPath && fs.existsSync(preferredPath)) {
    return preferredPath;
  }
  return app.getPath('home');
}

/**
 * Parse token usage data from Claude's JSON response
 */
export function parseTokenUsage(json: Record<string, unknown>): TokenUsageData {
  const usage = json.usage || {};
  const modelUsage = json.modelUsage || {};
  const modelKeys = Object.keys(modelUsage);
  const modelData = modelKeys.length > 0 ? modelUsage[modelKeys[0]] : {};

  return {
    inputTokens: usage.input_tokens || modelData.inputTokens || 0,
    outputTokens: usage.output_tokens || modelData.outputTokens || 0,
    cacheReadInputTokens: usage.cache_read_input_tokens || modelData.cacheReadInputTokens || 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens || modelData.cacheCreationInputTokens || 0,
    contextWindow: modelData.contextWindow || 200000,
    maxOutputTokens: modelData.maxOutputTokens || 64000,
  };
}

/**
 * Get the Gas Town workspace path
 */
export function getGastownPath(): string {
  return process.env.GASTOWN_PATH || path.join(app.getPath('home'), 'gt');
}

/**
 * Get path to bundled binary (gt or bd)
 */
export function getBinaryPath(binaryName: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', `${binaryName}.exe`);
  }
  return path.join(app.getAppPath(), 'resources', 'bin', `${binaryName}.exe`);
}

/**
 * Get path to Claude CLI
 */
export function getClaudePath(): string {
  // Claude is installed globally via npm, use the .cmd on Windows
  return 'claude.cmd';
}
