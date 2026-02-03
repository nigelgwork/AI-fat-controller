import { spawn, ChildProcess } from 'child_process';
import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { settings } from './settings';
import { safeBroadcast } from '../utils/safe-ipc';

const execAsync = promisify(exec);

// Track running processes for cancellation
const runningProcesses = new Map<string, ChildProcess>();

export function cancelExecution(executionId: string): boolean {
  const process = runningProcesses.get(executionId);
  if (process) {
    console.log('[Executor] Cancelling execution:', executionId);
    process.kill('SIGTERM');
    runningProcesses.delete(executionId);
    return true;
  }
  return false;
}

export function getRunningExecutions(): string[] {
  return Array.from(runningProcesses.keys());
}

/**
 * Cancel all running executions (cleanup on app quit)
 */
export function cancelAllExecutions(): void {
  console.log(`[Executor] Cleaning up ${runningProcesses.size} running processes`);
  for (const [executionId, process] of runningProcesses) {
    try {
      console.log(`[Executor] Killing process: ${executionId}`);
      process.kill('SIGTERM');
    } catch (err) {
      console.error(`[Executor] Failed to kill process ${executionId}:`, err);
    }
  }
  runningProcesses.clear();
}

// Ensure a directory exists
function ensureDir(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.error(`Failed to create directory ${dirPath}:`, err);
  }
}

// Get a valid working directory
function getValidCwd(preferredPath: string): string {
  if (fs.existsSync(preferredPath)) {
    return preferredPath;
  }
  // Fall back to user's home directory
  return app.getPath('home');
}

export interface TokenUsageData {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface ExecuteResult {
  success: boolean;
  response?: string;
  error?: string;
  duration: number;
  tokenUsage?: TokenUsageData;
  costUsd?: number;
}

export interface ModeStatus {
  current: 'windows' | 'wsl';
  windows: {
    available: boolean;
    claudePath?: string;
    version?: string;
  };
  wsl: {
    available: boolean;
    distro?: string;
    version?: string;
  };
}

// Abstract executor interface
interface IExecutor {
  initialize(): Promise<void>;
  runClaude(message: string, systemPrompt?: string, projectPath?: string, imagePaths?: string[], executionId?: string): Promise<ExecuteResult>;
  runGt(args: string[]): Promise<ExecuteResult>;
  runBd(args: string[]): Promise<ExecuteResult>;
}

// Windows executor - uses native Windows Claude and bundled gt/bd
class WindowsExecutor implements IExecutor {
  private claudePath: string = '';
  private gtPath: string = '';
  private bdPath: string = '';
  private gastownPath: string = '';

  async initialize(): Promise<void> {
    // Find Claude Code on Windows
    this.claudePath = settings.get('windows.claudePath') as string || await this.findWindowsClaude();

    // Bundled gt/bd paths
    const resourcesPath = app.isPackaged
      ? path.join(process.resourcesPath, 'bin')
      : path.join(__dirname, '../../resources/bin');

    this.gtPath = path.join(resourcesPath, 'gt.exe');
    this.bdPath = path.join(resourcesPath, 'bd.exe');

    console.log('[Executor] Initialized WindowsExecutor');
    console.log('[Executor] Claude path:', this.claudePath);
    console.log('[Executor] gt path:', this.gtPath, '- exists:', fs.existsSync(this.gtPath));
    console.log('[Executor] bd path:', this.bdPath, '- exists:', fs.existsSync(this.bdPath));

    // Gas Town workspace - ensure it exists
    this.gastownPath = settings.get('gastownPath') as string ||
      path.join(app.getPath('home'), 'gt');
    ensureDir(this.gastownPath);
    console.log('[Executor] Gastown path:', this.gastownPath);
  }

  private async findWindowsClaude(): Promise<string> {
    try {
      const { stdout } = await execAsync('where claude.cmd 2>nul || where claude 2>nul', {
        timeout: 5000,
      });
      return stdout.trim().split('\n')[0];
    } catch {
      return 'claude';  // Fall back to PATH
    }
  }

  // Convert WSL path to Windows-accessible path
  private toWindowsPath(inputPath: string): string {
    if (!inputPath) return inputPath;

    // Already a Windows path (has drive letter or UNC)
    if (/^[A-Za-z]:/.test(inputPath) || inputPath.startsWith('\\\\')) {
      return inputPath;
    }

    // WSL absolute path (starts with /) - convert to UNC path
    if (inputPath.startsWith('/')) {
      // Use wsl.localhost which is more reliable than wsl$
      const distro = settings.get('wsl.distro') as string || 'Ubuntu';
      return `\\\\wsl.localhost\\${distro}${inputPath.replace(/\//g, '\\')}`;
    }

    // Relative or unknown path - return as-is
    return inputPath;
  }

  async runClaude(message: string, systemPrompt?: string, projectPath?: string, imagePaths?: string[], executionId?: string): Promise<ExecuteResult> {
    const start = Date.now();

    if (!this.claudePath) {
      return {
        success: false,
        error: 'Claude Code not found. Please install Claude Code CLI and ensure it is in your PATH.',
        duration: Date.now() - start,
      };
    }

    const args = [
      '--print',
      '--output-format', 'stream-json',  // Stream JSON for real-time tool visibility
      '--verbose',  // Required for stream-json
      '--dangerously-skip-permissions',  // Required for non-interactive use
    ];

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    // Add image files if provided
    if (imagePaths && imagePaths.length > 0) {
      for (const imagePath of imagePaths) {
        args.push('--add', this.toWindowsPath(imagePath));
      }
    }

    // Add the prompt as positional argument (Claude Code expects this, not stdin)
    args.push('--', message);

    // Convert project path to Windows-accessible path
    const cwd = this.toWindowsPath(projectPath || this.gastownPath);
    console.log('[Executor] Windows cwd:', cwd, '(from:', projectPath, ')');

    // Use spawn without stdin since prompt is passed as argument
    return this.spawnCommandWithJsonParsing(this.claudePath, args, cwd, start, 120000, executionId);  // 2 min idle timeout
  }

  private spawnWithStdin(
    cmd: string,
    args: string[],
    stdinData: string,
    cwd: string,
    start: number,
    timeout = 300000,  // Increased to 5 minutes for complex analysis tasks
    executionId?: string
  ): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      const validCwd = getValidCwd(cwd);

      console.log('[Executor] Running Claude with stdin in:', validCwd);
      console.log('[Executor] Command:', cmd);
      console.log('[Executor] Args:', args);
      console.log('[Executor] Stdin length:', stdinData.length);
      if (executionId) console.log('[Executor] Execution ID:', executionId);

      // Send to renderer via BrowserWindow for debugging
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
        win.webContents.send('executor-log', {
          type: 'spawn',
          cmd,
          args,
          cwd: validCwd,
          stdinLength: stdinData.length,
          executionId,
          timestamp: new Date().toISOString(),
        });
      });

      const child = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, GASTOWN_PATH: this.gastownPath },
        cwd: validCwd,
        windowsHide: true,
        shell: true,  // Needed on Windows to find .cmd files
      });

      // Track the process for cancellation
      if (executionId) {
        runningProcesses.set(executionId, child);
      }

      let stdout = '';
      let stderr = '';
      let wasCancelled = false;

      child.stdout?.on('data', (data) => {
        stdout += data;
        console.log('[Executor] stdout chunk:', data.toString().substring(0, 200));
      });
      child.stderr?.on('data', (data) => {
        stderr += data;
        console.log('[Executor] stderr chunk:', data.toString().substring(0, 200));
      });

      // Write message to stdin and close it
      if (child.stdin) {
        child.stdin.write(stdinData);
        child.stdin.end();
      }

      const timer = setTimeout(() => {
        child.kill();
        if (executionId) runningProcesses.delete(executionId);
        resolve({
          success: false,
          error: `Timeout after ${timeout / 1000} seconds`,
          duration: Date.now() - start,
        });
      }, timeout);

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        if (executionId) runningProcesses.delete(executionId);
        const duration = Date.now() - start;

        // Check if killed by signal (cancelled)
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          wasCancelled = true;
        }

        console.log('[Executor] Claude exit code:', code, 'signal:', signal);
        console.log('[Executor] Claude stdout length:', stdout.length);
        if (stderr) console.log('[Executor] Claude stderr:', stderr);

        if (wasCancelled) {
          resolve({
            success: false,
            error: 'Execution cancelled',
            duration,
          });
        } else if (code === 0 || stdout.trim()) {
          resolve({
            success: true,
            response: stdout.trim() || stderr.trim(),
            duration,
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Exit code ${code}`,
            duration,
          });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        if (executionId) runningProcesses.delete(executionId);
        console.log('[Executor] Claude spawn error:', err);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - start,
        });
      });
    });
  }

  // Parse JSON stream output from Claude Code and send structured events to frontend
  private spawnCommandWithJsonParsing(
    cmd: string,
    args: string[],
    cwd: string,
    start: number,
    idleTimeout = 120000,
    executionId?: string
  ): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      const validCwd = getValidCwd(cwd);

      console.log('[Executor] Running Claude with JSON streaming in:', validCwd);
      console.log('[Executor] Idle timeout:', idleTimeout / 1000, 'seconds');
      if (executionId) console.log('[Executor] Execution ID:', executionId);

      const { BrowserWindow } = require('electron');

      // Send init event
      BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
        win.webContents.send('executor-log', {
          type: 'spawn-command',
          cmd,
          argsCount: args.length,
          cwd: validCwd,
          idleTimeout,
          executionId,
          timestamp: new Date().toISOString(),
        });
      });

      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GASTOWN_PATH: this.gastownPath },
        cwd: validCwd,
        windowsHide: true,
        shell: true,
      });

      if (executionId) {
        runningProcesses.set(executionId, child);
      }

      let fullOutput = '';
      let finalResult = '';
      let stderr = '';
      let wasCancelled = false;
      let lastActivity = Date.now();

      const resetIdleTimer = () => {
        lastActivity = Date.now();
      };

      const idleChecker = setInterval(() => {
        const idleTime = Date.now() - lastActivity;
        if (idleTime >= idleTimeout && !wasCancelled) {
          wasCancelled = true; // Prevent close handler from also resolving
          clearInterval(idleChecker);
          child.kill();
          if (executionId) runningProcesses.delete(executionId);
          console.log('[Executor] IDLE TIMEOUT');
          resolve({
            success: false,
            error: `Idle timeout - no activity for ${idleTimeout / 1000} seconds`,
            duration: Date.now() - start,
          });
        }
      }, 5000);

      // Parse JSON lines from stdout
      let lineBuffer = '';
      child.stdout?.on('data', (data) => {
        fullOutput += data;
        resetIdleTimer();

        // Process complete JSON lines
        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';  // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const json = JSON.parse(line);

            // Send structured events based on JSON type
            if (json.type === 'assistant' && json.message?.content) {
              for (const content of json.message.content) {
                if (content.type === 'tool_use') {
                  // Tool being called
                  const toolName = content.name;
                  const toolInput = content.input || {};
                  let description = toolInput.description || toolInput.command || toolInput.pattern || toolInput.file_path || '';
                  if (description.length > 100) description = description.substring(0, 100) + '...';

                  BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
                    win.webContents.send('executor-log', {
                      type: 'tool-call',
                      tool: toolName,
                      description,
                      executionId,
                      timestamp: new Date().toISOString(),
                    });
                  });
                } else if (content.type === 'text' && content.text) {
                  // Text response
                  const text = content.text.substring(0, 200);
                  BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
                    win.webContents.send('executor-log', {
                      type: 'text',
                      text,
                      executionId,
                      timestamp: new Date().toISOString(),
                    });
                  });
                }
              }
            } else if (json.type === 'user' && json.tool_use_result) {
              // Tool result
              const result = json.tool_use_result;
              const preview = (result.stdout || result.stderr || '').substring(0, 100);
              BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
                win.webContents.send('executor-log', {
                  type: 'tool-result',
                  preview: preview || '(no output)',
                  isError: result.is_error || !!result.stderr,
                  executionId,
                  timestamp: new Date().toISOString(),
                });
              });
            } else if (json.type === 'result') {
              // Final result
              finalResult = json.result || '';
              const duration = json.duration_ms || (Date.now() - start);
              const cost = json.total_cost_usd;
              BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
                win.webContents.send('executor-log', {
                  type: 'complete',
                  code: json.is_error ? 1 : 0,
                  duration,
                  cost,
                  numTurns: json.num_turns,
                  executionId,
                  timestamp: new Date().toISOString(),
                });
              });
            }
          } catch (e) {
            // Not valid JSON, might be stderr or other output
            console.log('[Executor] Non-JSON line:', line.substring(0, 100));
          }
        }
      });

      child.stderr?.on('data', (data) => {
        stderr += data;
        resetIdleTimer();
        const chunk = data.toString().substring(0, 200);
        console.log('[Executor] stderr:', chunk);
        BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
          win.webContents.send('executor-log', {
            type: 'stderr',
            chunk,
            executionId,
            timestamp: new Date().toISOString(),
          });
        });
      });

      child.on('close', (code, signal) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        const duration = Date.now() - start;

        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          wasCancelled = true;
        }

        console.log('[Executor] Exit code:', code, 'signal:', signal, 'duration:', duration);

        if (wasCancelled) {
          resolve({
            success: false,
            error: 'Execution cancelled',
            duration,
          });
        } else if (code === 0 || finalResult) {
          resolve({
            success: true,
            response: finalResult || fullOutput,
            duration,
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Exit code ${code}`,
            duration,
          });
        }
      });

      child.on('error', (err) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - start,
        });
      });
    });
  }

  private spawnCommand(
    cmd: string,
    args: string[],
    cwd: string,
    start: number,
    idleTimeout = 120000,  // Idle timeout - resets on activity
    executionId?: string
  ): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      const validCwd = getValidCwd(cwd);

      console.log('[Executor] Running command in:', validCwd);
      console.log('[Executor] Command:', cmd);
      console.log('[Executor] Args count:', args.length);
      console.log('[Executor] First few args:', args.slice(0, 5));
      console.log('[Executor] Idle timeout:', idleTimeout / 1000, 'seconds');
      if (executionId) console.log('[Executor] Execution ID:', executionId);

      // Send to renderer via BrowserWindow for debugging
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
        win.webContents.send('executor-log', {
          type: 'spawn-command',
          cmd,
          argsCount: args.length,
          cwd: validCwd,
          idleTimeout,
          executionId,
          timestamp: new Date().toISOString(),
        });
      });

      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GASTOWN_PATH: this.gastownPath },
        cwd: validCwd,
        windowsHide: true,
        shell: true,  // Needed on Windows to find .cmd files
      });

      // Track the process for cancellation
      if (executionId) {
        runningProcesses.set(executionId, child);
      }

      let stdout = '';
      let stderr = '';
      let wasCancelled = false;
      let lastActivity = Date.now();

      // Idle timeout - resets whenever there's output activity
      const resetIdleTimer = () => {
        lastActivity = Date.now();
      };

      const idleChecker = setInterval(() => {
        const idleTime = Date.now() - lastActivity;
        if (idleTime >= idleTimeout && !wasCancelled) {
          wasCancelled = true; // Prevent close handler from also resolving
          clearInterval(idleChecker);
          child.kill();
          if (executionId) runningProcesses.delete(executionId);
          console.log('[Executor] IDLE TIMEOUT - no activity for', idleTimeout / 1000, 'seconds');
          safeBroadcast('executor-log', {
            type: 'idle-timeout',
            idleTime,
            stdoutLength: stdout.length,
            executionId,
            timestamp: new Date().toISOString(),
          });
          resolve({
            success: false,
            error: `Idle timeout - no activity for ${idleTimeout / 1000} seconds`,
            duration: Date.now() - start,
          });
        }
      }, 5000);  // Check every 5 seconds

      child.stdout?.on('data', (data) => {
        stdout += data;
        resetIdleTimer();
        const chunk = data.toString().substring(0, 200);
        console.log('[Executor] stdout chunk:', chunk);
        BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
          win.webContents.send('executor-log', {
            type: 'stdout',
            chunk,
            totalLength: stdout.length,
            executionId,
            timestamp: new Date().toISOString(),
          });
        });
      });
      child.stderr?.on('data', (data) => {
        stderr += data;
        resetIdleTimer();
        const chunk = data.toString().substring(0, 200);
        console.log('[Executor] stderr chunk:', chunk);
        BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
          win.webContents.send('executor-log', {
            type: 'stderr',
            chunk,
            totalLength: stderr.length,
            executionId,
            timestamp: new Date().toISOString(),
          });
        });
      });

      child.on('close', (code, signal) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        const duration = Date.now() - start;

        // Check if killed by signal (cancelled)
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          wasCancelled = true;
        }

        console.log('[Executor] Exit code:', code, 'signal:', signal, 'duration:', duration);
        console.log('[Executor] stdout length:', stdout.length);
        if (stderr) console.log('[Executor] stderr:', stderr.substring(0, 500));

        // Send result to renderer
        BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
          win.webContents.send('executor-log', {
            type: 'complete',
            code,
            signal,
            duration,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
            executionId,
            timestamp: new Date().toISOString(),
          });
        });

        if (wasCancelled) {
          resolve({
            success: false,
            error: 'Execution cancelled',
            duration,
          });
        } else if (code === 0 || stdout.trim()) {
          resolve({
            success: true,
            response: stdout.trim() || stderr.trim(),
            duration,
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Exit code ${code}`,
            duration,
          });
        }
      });

      child.on('error', (err) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        console.log('[Executor] Spawn error:', err);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - start,
        });
      });
    });
  }

  private spawnWithCwd(
    cmd: string,
    args: string[],
    cwd: string,
    opts: { shell?: boolean } = {},
    start: number,
    timeout = 120000
  ): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      const validCwd = getValidCwd(cwd);

      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GASTOWN_PATH: this.gastownPath },
        cwd: validCwd,
        windowsHide: true,
        ...opts,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => { stdout += data; });
      child.stderr?.on('data', (data) => { stderr += data; });

      const timer = setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          error: `Timeout after ${timeout / 1000} seconds`,
          duration: Date.now() - start,
        });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - start;

        if (code === 0 || stdout.trim()) {
          resolve({
            success: true,
            response: stdout.trim() || stderr.trim(),
            duration,
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Exit code ${code}`,
            duration,
          });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - start,
        });
      });
    });
  }

  async runGt(args: string[]): Promise<ExecuteResult> {
    const start = Date.now();

    if (!fs.existsSync(this.gtPath)) {
      return {
        success: false,
        error: `Gas Town CLI not found at ${this.gtPath}. The gt tool may not be bundled correctly.`,
        duration: Date.now() - start,
      };
    }

    return this.spawn(this.gtPath, args, {}, start);
  }

  async runBd(args: string[]): Promise<ExecuteResult> {
    const start = Date.now();

    if (!fs.existsSync(this.bdPath)) {
      return {
        success: false,
        error: `Beads CLI not found at ${this.bdPath}. The bd tool may not be bundled correctly.`,
        duration: Date.now() - start,
      };
    }

    return this.spawn(this.bdPath, args, {}, start);
  }

  private spawn(
    cmd: string,
    args: string[],
    opts: { shell?: boolean } = {},
    start: number,
    timeout = 120000
  ): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      const cwd = getValidCwd(this.gastownPath);

      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GASTOWN_PATH: this.gastownPath },
        cwd,
        windowsHide: true,
        ...opts,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => { stdout += data; });
      child.stderr?.on('data', (data) => { stderr += data; });

      const timer = setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          error: `Timeout after ${timeout / 1000} seconds`,
          duration: Date.now() - start,
        });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - start;

        if (code === 0 || stdout.trim()) {
          resolve({
            success: true,
            response: stdout.trim() || stderr.trim(),
            duration,
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Exit code ${code}`,
            duration,
          });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - start,
        });
      });
    });
  }
}

// WSL executor - uses Claude/gt/bd installed in WSL
class WslExecutor implements IExecutor {
  private distro: string | undefined;
  private gastownPath: string = '';
  private wslGastownPath: string = '';

  async initialize(): Promise<void> {
    this.distro = settings.get('wsl.distro') as string || undefined;

    // Gas Town workspace (Windows path)
    this.gastownPath = settings.get('gastownPath') as string ||
      path.join(app.getPath('home'), 'gt');

    // Convert to WSL path
    this.wslGastownPath = this.toWslPath(this.gastownPath);
  }

  private toWslPath(windowsPath: string): string {
    // C:\Users\nigel\gt → /mnt/c/Users/nigel/gt
    return windowsPath
      .replace(/^([A-Z]):/i, (_, drive) => `/mnt/${drive.toLowerCase()}`)
      .replace(/\\/g, '/');
  }

  async runClaude(message: string, systemPrompt?: string, projectPath?: string, imagePaths?: string[], executionId?: string): Promise<ExecuteResult> {
    const start = Date.now();
    const args = [
      '--print',
      '--output-format', 'stream-json',  // Stream JSON for real-time tool visibility
      '--verbose',  // Required for stream-json
      '--dangerously-skip-permissions',  // Required for non-interactive use
    ];

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    // Add image files if provided (convert to WSL paths)
    if (imagePaths && imagePaths.length > 0) {
      for (const imagePath of imagePaths) {
        args.push('--add', this.toWslPath(imagePath));
      }
    }

    // Add the prompt as positional argument (Claude Code expects this, not stdin)
    args.push('--', message);

    // Convert project path to WSL path if provided
    const wslCwd = projectPath ? this.toWslPath(projectPath) : this.wslGastownPath;

    return this.wslExecCommandWithJsonParsing('claude', args, start, 120000, wslCwd, executionId);  // 2 min idle timeout
  }

  // Parse JSON stream output from Claude Code in WSL
  private wslExecCommandWithJsonParsing(cmd: string, args: string[], start: number, idleTimeout = 120000, wslCwd?: string, executionId?: string): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      const argsStr = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
      const fullCmd = wslCwd ? `cd '${wslCwd}' && ${cmd} ${argsStr}` : `${cmd} ${argsStr}`;
      const wslArgs = this.distro
        ? ['-d', this.distro, 'bash', '-c', fullCmd]
        : ['bash', '-c', fullCmd];

      console.log('[Executor] WSL running Claude with JSON streaming');
      if (executionId) console.log('[Executor] Execution ID:', executionId);

      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
        win.webContents.send('executor-log', {
          type: 'wsl-spawn',
          cmd,
          argsCount: args.length,
          cwd: wslCwd,
          idleTimeout,
          executionId,
          timestamp: new Date().toISOString(),
        });
      });

      const child = spawn('wsl.exe', wslArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, WSLENV: 'GASTOWN_PATH/p', GASTOWN_PATH: this.gastownPath },
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
        if (Date.now() - lastActivity >= idleTimeout) {
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
      child.stdout?.on('data', (data) => {
        fullOutput += data;
        resetIdleTimer();

        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.type === 'assistant' && json.message?.content) {
              for (const content of json.message.content) {
                if (content.type === 'tool_use') {
                  const toolName = content.name;
                  const toolInput = content.input || {};
                  let description = toolInput.description || toolInput.command || toolInput.pattern || toolInput.file_path || '';
                  if (description.length > 100) description = description.substring(0, 100) + '...';
                  BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
                    win.webContents.send('executor-log', { type: 'tool-call', tool: toolName, description, executionId, timestamp: new Date().toISOString() });
                  });
                } else if (content.type === 'text' && content.text) {
                  BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
                    win.webContents.send('executor-log', { type: 'text', text: content.text.substring(0, 200), executionId, timestamp: new Date().toISOString() });
                  });
                }
              }
            } else if (json.type === 'user' && json.tool_use_result) {
              const result = json.tool_use_result;
              const preview = (result.stdout || result.stderr || '').substring(0, 100);
              BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
                win.webContents.send('executor-log', { type: 'tool-result', preview: preview || '(no output)', isError: result.is_error || !!result.stderr, executionId, timestamp: new Date().toISOString() });
              });
            } else if (json.type === 'result') {
              finalResult = json.result || '';
              BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
                win.webContents.send('executor-log', { type: 'complete', code: json.is_error ? 1 : 0, duration: json.duration_ms, cost: json.total_cost_usd, numTurns: json.num_turns, executionId, timestamp: new Date().toISOString() });
              });
            }
          } catch (e) {
            // Not valid JSON
          }
        }
      });

      child.stderr?.on('data', (data) => {
        stderr += data;
        resetIdleTimer();
        BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
          win.webContents.send('executor-log', { type: 'stderr', chunk: data.toString().substring(0, 200), executionId, timestamp: new Date().toISOString() });
        });
      });

      child.on('close', (code, signal) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        if (signal === 'SIGTERM' || signal === 'SIGKILL') wasCancelled = true;

        if (wasCancelled) {
          resolve({ success: false, error: 'Execution cancelled', duration: Date.now() - start });
        } else if (code === 0 || finalResult) {
          resolve({ success: true, response: finalResult || fullOutput, duration: Date.now() - start });
        } else {
          resolve({ success: false, error: stderr.trim() || `Exit code ${code}`, duration: Date.now() - start });
        }
      });

      child.on('error', (err) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        resolve({ success: false, error: err.message, duration: Date.now() - start });
      });
    });
  }

  private wslExecCommand(cmd: string, args: string[], start: number, idleTimeout = 120000, wslCwd?: string, executionId?: string): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      // Build argument list - escape arguments properly for bash
      const argsStr = args.map(a => {
        // Use single quotes and escape any single quotes in the string
        return `'${a.replace(/'/g, "'\\''")}'`;
      }).join(' ');

      // If cwd is specified, wrap command with cd
      const fullCmd = wslCwd
        ? `cd '${wslCwd}' && ${cmd} ${argsStr}`
        : `${cmd} ${argsStr}`;

      const wslArgs = this.distro
        ? ['-d', this.distro, 'bash', '-c', fullCmd]
        : ['bash', '-c', fullCmd];

      console.log('[Executor] WSL running command');
      console.log('[Executor] Args count:', args.length);
      console.log('[Executor] Idle timeout:', idleTimeout / 1000, 'seconds');
      if (executionId) console.log('[Executor] Execution ID:', executionId);

      // Send to renderer via BrowserWindow for debugging
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
        win.webContents.send('executor-log', {
          type: 'wsl-spawn',
          cmd,
          argsCount: args.length,
          cwd: wslCwd,
          idleTimeout,
          executionId,
          timestamp: new Date().toISOString(),
        });
      });

      const child = spawn('wsl.exe', wslArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          WSLENV: 'GASTOWN_PATH/p',
          GASTOWN_PATH: this.gastownPath,
        },
      });

      // Track the process for cancellation
      if (executionId) {
        runningProcesses.set(executionId, child);
      }

      let stdout = '';
      let stderr = '';
      let wasCancelled = false;
      let lastActivity = Date.now();

      // Idle timeout - resets whenever there's output activity
      const resetIdleTimer = () => {
        lastActivity = Date.now();
      };

      const idleChecker = setInterval(() => {
        const idleTime = Date.now() - lastActivity;
        if (idleTime >= idleTimeout && !wasCancelled) {
          wasCancelled = true; // Prevent close handler from also resolving
          clearInterval(idleChecker);
          child.kill();
          if (executionId) runningProcesses.delete(executionId);
          console.log('[Executor] WSL IDLE TIMEOUT - no activity for', idleTimeout / 1000, 'seconds');
          safeBroadcast('executor-log', {
            type: 'wsl-idle-timeout',
            idleTime,
            stdoutLength: stdout.length,
            executionId,
            timestamp: new Date().toISOString(),
          });
          resolve({
            success: false,
            error: `Idle timeout - no activity for ${idleTimeout / 1000} seconds`,
            duration: Date.now() - start,
          });
        }
      }, 5000);  // Check every 5 seconds

      child.stdout?.on('data', (data) => {
        stdout += data;
        resetIdleTimer();
        const chunk = data.toString().substring(0, 200);
        console.log('[Executor] WSL stdout chunk:', chunk);
        BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
          win.webContents.send('executor-log', {
            type: 'wsl-stdout',
            chunk,
            totalLength: stdout.length,
            executionId,
            timestamp: new Date().toISOString(),
          });
        });
      });
      child.stderr?.on('data', (data) => {
        stderr += data;
        resetIdleTimer();
        const chunk = data.toString().substring(0, 200);
        console.log('[Executor] WSL stderr chunk:', chunk);
        BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
          win.webContents.send('executor-log', {
            type: 'wsl-stderr',
            chunk,
            totalLength: stderr.length,
            executionId,
            timestamp: new Date().toISOString(),
          });
        });
      });

      child.on('close', (code, signal) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        const duration = Date.now() - start;

        // Check if killed by signal (cancelled)
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          wasCancelled = true;
        }

        console.log('[Executor] WSL exit code:', code, 'signal:', signal, 'duration:', duration);
        console.log('[Executor] WSL stdout length:', stdout.length);
        if (stderr) console.log('[Executor] WSL stderr:', stderr.substring(0, 500));

        // Send result to renderer
        BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
          win.webContents.send('executor-log', {
            type: 'wsl-complete',
            code,
            signal,
            duration,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
            executionId,
            timestamp: new Date().toISOString(),
          });
        });

        if (wasCancelled) {
          resolve({
            success: false,
            error: 'Execution cancelled',
            duration,
          });
        } else if (code === 0 || stdout.trim()) {
          resolve({
            success: true,
            response: stdout.trim() || stderr.trim(),
            duration,
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Exit code ${code}`,
            duration,
          });
        }
      });

      child.on('error', (err) => {
        clearInterval(idleChecker);
        if (executionId) runningProcesses.delete(executionId);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - start,
        });
      });
    });
  }

  async runGt(args: string[]): Promise<ExecuteResult> {
    const start = Date.now();
    return this.wslExec('gt', args, start);
  }

  async runBd(args: string[]): Promise<ExecuteResult> {
    const start = Date.now();
    return this.wslExec('bd', args, start);
  }

  private wslExec(cmd: string, args: string[], start: number, timeout = 120000, wslCwd?: string): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      // If cwd is specified, wrap command with cd
      const fullCmd = wslCwd
        ? `cd "${wslCwd}" && ${cmd} ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`
        : `${cmd} ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;

      const wslArgs = this.distro
        ? ['-d', this.distro, 'bash', '-c', fullCmd]
        : ['bash', '-c', fullCmd];

      const child = spawn('wsl.exe', wslArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          WSLENV: 'GASTOWN_PATH/p',
          GASTOWN_PATH: this.gastownPath,
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => { stdout += data; });
      child.stderr?.on('data', (data) => { stderr += data; });

      const timer = setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          error: `Timeout after ${timeout / 1000} seconds`,
          duration: Date.now() - start,
        });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - start;

        if (code === 0 || stdout.trim()) {
          resolve({
            success: true,
            response: stdout.trim() || stderr.trim(),
            duration,
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Exit code ${code}`,
            duration,
          });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - start,
        });
      });
    });
  }
}

// Executor factory
let currentExecutor: IExecutor | null = null;

export async function getExecutor(): Promise<IExecutor> {
  const mode = settings.get('executionMode') as 'windows' | 'wsl';

  if (!currentExecutor) {
    currentExecutor = mode === 'wsl' ? new WslExecutor() : new WindowsExecutor();
    await currentExecutor.initialize();
  }

  return currentExecutor;
}

export async function switchExecutor(mode: 'windows' | 'wsl'): Promise<void> {
  // Cancel any running processes before switching modes
  if (runningProcesses.size > 0) {
    console.log(`[Executor] Cancelling ${runningProcesses.size} running processes before mode switch`);
    cancelAllExecutions();
  }

  settings.set('executionMode', mode);
  currentExecutor = mode === 'wsl' ? new WslExecutor() : new WindowsExecutor();
  await currentExecutor.initialize();
}

// Debug info
export interface DebugInfo {
  isPackaged: boolean;
  resourcesPath: string;
  gtPath: string;
  gtExists: boolean;
  bdPath: string;
  bdExists: boolean;
  claudePath: string;
  gastownPath: string;
  gastownExists: boolean;
  executionMode: 'windows' | 'wsl';
}

export async function getDebugInfo(): Promise<DebugInfo> {
  const mode = settings.get('executionMode') as 'windows' | 'wsl';
  const resourcesPath = app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(__dirname, '../../resources/bin');

  const gtPath = path.join(resourcesPath, 'gt.exe');
  const bdPath = path.join(resourcesPath, 'bd.exe');
  const gastownPath = settings.get('gastownPath') as string || path.join(app.getPath('home'), 'gt');

  let claudePath = '';
  try {
    const { stdout } = await execAsync('where claude.cmd 2>nul || where claude 2>nul', { timeout: 5000 });
    claudePath = stdout.trim().split('\n')[0] || 'Not found';
  } catch {
    claudePath = 'Not found in PATH';
  }

  return {
    isPackaged: app.isPackaged,
    resourcesPath,
    gtPath,
    gtExists: fs.existsSync(gtPath),
    bdPath,
    bdExists: fs.existsSync(bdPath),
    claudePath,
    gastownPath,
    gastownExists: fs.existsSync(gastownPath),
    executionMode: mode,
  };
}

// Detection utilities
export async function detectModes(): Promise<ModeStatus> {
  const status: ModeStatus = {
    current: settings.get('executionMode') as 'windows' | 'wsl',
    windows: { available: false },
    wsl: { available: false },
  };

  // Check Windows Claude
  try {
    const { stdout } = await execAsync('where claude.cmd 2>nul || where claude 2>nul', { timeout: 5000 });
    const claudePath = stdout.trim().split('\n')[0];
    if (claudePath) {
      const { stdout: version } = await execAsync(`"${claudePath}" --version`, { timeout: 10000 });
      status.windows = {
        available: true,
        claudePath,
        version: version.trim(),
      };
    }
  } catch {
    // Windows Claude not available
  }

  // Check WSL Claude
  try {
    // Use wsl.exe -l -q with encoding fix (Windows returns UTF-16 LE)
    const { stdout: wslList } = await execAsync('wsl.exe -l -q', { timeout: 5000, encoding: 'utf16le' });
    // Filter out null bytes and empty lines
    const distros = wslList
      .replace(/\0/g, '')
      .trim()
      .split('\n')
      .map(d => d.trim())
      .filter(d => d && d.length > 0);

    for (const distro of distros) {
      try {
        const { stdout: which } = await execAsync(`wsl.exe -d ${distro.trim()} -e which claude`, { timeout: 5000 });
        if (which.trim()) {
          const { stdout: version } = await execAsync(`wsl.exe -d ${distro.trim()} -e claude --version`, { timeout: 10000 });
          status.wsl = {
            available: true,
            distro: distro.trim(),
            version: version.trim(),
          };
          break;
        }
      } catch {
        // Claude not in this distro
      }
    }
  } catch {
    // WSL not available
  }

  return status;
}
