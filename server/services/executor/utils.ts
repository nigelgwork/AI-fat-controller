import { ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import { broadcast } from '../../websocket';
import { createLogger } from '../../utils/logger';

const log = createLogger('Executor');

// Track running processes for cancellation
export const runningProcesses = new Map<string, ChildProcess>();

export function cancelExecution(executionId: string): boolean {
  const proc = runningProcesses.get(executionId);
  if (proc) {
    log.info('Cancelling execution:', executionId);
    proc.kill('SIGTERM');
    runningProcesses.delete(executionId);
    return true;
  }
  return false;
}

export function getRunningExecutions(): string[] {
  return Array.from(runningProcesses.keys());
}

export function cancelAllExecutions(): void {
  log.info(`Cleaning up ${runningProcesses.size} running processes`);
  for (const [executionId, proc] of runningProcesses) {
    try {
      log.info(`Killing process: ${executionId}`);
      proc.kill('SIGTERM');
    } catch (err) {
      log.error(`Failed to kill process ${executionId}`, err);
    }
  }
  runningProcesses.clear();
}

export function getValidCwd(preferredPath: string): string {
  if (fs.existsSync(preferredPath)) {
    return preferredPath;
  }
  return os.homedir();
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Parse JSON stream output from Claude Code and broadcast structured events
export function parseJsonStreamLine(line: string, executionId?: string): { type: string; data?: any; finalResult?: string } | null {
  if (!line.trim()) return null;

  try {
    const json = JSON.parse(line);

    if (json.type === 'assistant' && json.message?.content) {
      for (const content of json.message.content) {
        if (content.type === 'tool_use') {
          const toolName = content.name;
          const toolInput = content.input || {};
          let description = toolInput.description || toolInput.command || toolInput.pattern || toolInput.file_path || '';
          if (description.length > 100) description = description.substring(0, 100) + '...';

          broadcast('executor-log', {
            type: 'tool-call',
            tool: toolName,
            description,
            executionId,
            timestamp: new Date().toISOString(),
          });
          return { type: 'tool-call' };
        } else if (content.type === 'text' && content.text) {
          broadcast('executor-log', {
            type: 'text',
            text: content.text.substring(0, 200),
            executionId,
            timestamp: new Date().toISOString(),
          });
          return { type: 'text' };
        }
      }
    } else if (json.type === 'user' && json.tool_use_result) {
      const result = json.tool_use_result;
      const preview = (result.stdout || result.stderr || '').substring(0, 100);
      broadcast('executor-log', {
        type: 'tool-result',
        preview: preview || '(no output)',
        isError: result.is_error || !!result.stderr,
        executionId,
        timestamp: new Date().toISOString(),
      });
      return { type: 'tool-result' };
    } else if (json.type === 'result') {
      const finalResult = json.result || '';
      broadcast('executor-log', {
        type: 'complete',
        code: json.is_error ? 1 : 0,
        duration: json.duration_ms,
        cost: json.total_cost_usd,
        numTurns: json.num_turns,
        executionId,
        timestamp: new Date().toISOString(),
      });
      return { type: 'result', finalResult };
    }
  } catch {
    // Not valid JSON - ignore
  }

  return null;
}
