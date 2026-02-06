import { spawn, ChildProcess } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { broadcast } from '../websocket';
import { createLogger } from '../utils/logger';
import { getGastownPath } from '../utils/paths';
import {
  IExecutor,
  ExecuteResult,
  ExecuteResultWithSession,
  SessionOptions,
  ModeStatus,
} from './executor/types';
import {
  runningProcesses,
  getValidCwd,
  ensureDir,
  parseJsonStreamLine,
} from './executor/utils';

const log = createLogger('Executor');
const execAsync = promisify(exec);

/**
 * LinuxExecutor - Claude Code installed natively in Linux/WSL
 * Default executor for Docker environments
 */
class LinuxExecutor implements IExecutor {
  private claudePath: string = '';
  private gastownPath: string = '';

  async initialize(): Promise<void> {
    this.claudePath = await this.findClaude();
    this.gastownPath = getGastownPath();
    ensureDir(this.gastownPath);

    log.info('Initialized LinuxExecutor');
    log.info('Claude path:', this.claudePath);
    log.info('Gastown path:', this.gastownPath);
  }

  private async findClaude(): Promise<string> {
    try {
      const { stdout } = await execAsync('which claude', { timeout: 5000 });
      return stdout.trim();
    } catch {
      return 'claude'; // Fall back to PATH
    }
  }

  async runClaude(
    message: string,
    systemPrompt?: string,
    projectPath?: string,
    imagePaths?: string[],
    executionId?: string,
    sessionOptions?: SessionOptions
  ): Promise<ExecuteResultWithSession> {
    const start = Date.now();

    if (!this.claudePath) {
      return {
        success: false,
        error: 'Claude Code not found. Please install Claude Code CLI.',
        duration: Date.now() - start,
      };
    }

    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    if (sessionOptions?.resumeSessionId) {
      args.push('--resume', sessionOptions.resumeSessionId);
    } else if (sessionOptions?.continueSession) {
      args.push('--continue');
    }

    // Write system prompt to temp file
    let systemPromptFile: string | null = null;
    if (systemPrompt) {
      try {
        const tempDir = os.tmpdir();
        systemPromptFile = path.join(tempDir, `claude-system-prompt-${Date.now()}.txt`);
        fs.writeFileSync(systemPromptFile, systemPrompt, 'utf-8');
        args.push('--append-system-prompt', systemPromptFile);
      } catch (err) {
        log.error('Failed to write system prompt file:', err);
        args.push('--system-prompt', systemPrompt);
      }
    }

    if (imagePaths && imagePaths.length > 0) {
      for (const imagePath of imagePaths) {
        args.push('--add', imagePath);
      }
    }

    args.push('--', message);

    const cwd = projectPath || this.gastownPath;
    const result = await this.spawnWithJsonParsing(this.claudePath, args, cwd, start, 120000, executionId);

    if (systemPromptFile) {
      try { fs.unlinkSync(systemPromptFile); } catch { /* ignore */ }
    }

    return result;
  }

  private spawnWithJsonParsing(
    cmd: string,
    args: string[],
    cwd: string,
    start: number,
    idleTimeout = 120000,
    executionId?: string
  ): Promise<ExecuteResultWithSession> {
    return new Promise((resolve) => {
      const validCwd = getValidCwd(cwd);

      log.info('Running Claude with JSON streaming in:', validCwd);
      if (executionId) log.info('Execution ID:', executionId);

      broadcast('executor-log', {
        type: 'spawn-command',
        cmd,
        argsCount: args.length,
        cwd: validCwd,
        idleTimeout,
        executionId,
        timestamp: new Date().toISOString(),
      });

      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GASTOWN_PATH: this.gastownPath },
        cwd: validCwd,
      });

      if (executionId) {
        runningProcesses.set(executionId, child);
      }

      let fullOutput = '';
      let finalResult = '';
      let stderr = '';
      let wasCancelled = false;
      let lastActivity = Date.now();

      const resetIdleTimer = () => { lastActivity = Date.now(); };

      const idleChecker = setInterval(() => {
        if (Date.now() - lastActivity >= idleTimeout && !wasCancelled) {
          wasCancelled = true;
          clearInterval(idleChecker);
          child.kill();
          if (executionId) runningProcesses.delete(executionId);
          resolve({
            success: false,
            error: `Idle timeout - no activity for ${idleTimeout / 1000} seconds`,
            duration: Date.now() - start,
          });
        }
      }, 5000);

      let lineBuffer = '';
      child.stdout?.on('data', (data: Buffer) => {
        fullOutput += data;
        resetIdleTimer();

        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const parsed = parseJsonStreamLine(line, executionId);
          if (parsed?.type === 'result' && parsed.finalResult) {
            finalResult = parsed.finalResult;
          }
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data;
        resetIdleTimer();
        broadcast('executor-log', {
          type: 'stderr',
          chunk: data.toString().substring(0, 200),
          executionId,
          timestamp: new Date().toISOString(),
        });
      });

      child.on('close', (code, signal) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        const duration = Date.now() - start;

        if (signal === 'SIGTERM' || signal === 'SIGKILL') wasCancelled = true;

        if (wasCancelled) {
          resolve({ success: false, error: 'Execution cancelled', duration });
        } else if (code === 0 || finalResult) {
          resolve({ success: true, response: finalResult || fullOutput, duration });
        } else {
          resolve({ success: false, error: stderr.trim() || `Exit code ${code}`, duration });
        }
      });

      child.on('error', (err) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        resolve({ success: false, error: err.message, duration: Date.now() - start });
      });
    });
  }

  async runGt(args: string[]): Promise<ExecuteResult> {
    return this.runCommand('gt', args);
  }

  async runBd(args: string[]): Promise<ExecuteResult> {
    return this.runCommand('bd', args);
  }

  private runCommand(cmd: string, args: string[]): Promise<ExecuteResult> {
    const start = Date.now();
    return new Promise((resolve) => {
      const cwd = getValidCwd(this.gastownPath);

      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GASTOWN_PATH: this.gastownPath },
        cwd,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => { stdout += data; });
      child.stderr?.on('data', (data: Buffer) => { stderr += data; });

      const timer = setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'Timeout after 120 seconds', duration: Date.now() - start });
      }, 120000);

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - start;
        if (code === 0 || stdout.trim()) {
          resolve({ success: true, response: stdout.trim() || stderr.trim(), duration });
        } else {
          resolve({ success: false, error: stderr.trim() || `Exit code ${code}`, duration });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ success: false, error: err.message, duration: Date.now() - start });
      });
    });
  }
}

// Executor factory
let currentExecutor: IExecutor | null = null;

export async function getExecutor(): Promise<IExecutor> {
  if (!currentExecutor) {
    currentExecutor = new LinuxExecutor();
    await currentExecutor.initialize();
  }
  return currentExecutor;
}

export async function switchExecutor(mode: string): Promise<void> {
  const { cancelAllExecutions } = await import('./executor/utils');
  if (runningProcesses.size > 0) {
    cancelAllExecutions();
  }
  currentExecutor = new LinuxExecutor();
  await currentExecutor.initialize();
}

export { cancelExecution, getRunningExecutions, cancelAllExecutions } from './executor/utils';
