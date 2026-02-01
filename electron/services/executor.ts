import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { settings } from './settings';

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

export interface ExecuteResult {
  success: boolean;
  response?: string;
  error?: string;
  duration: number;
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
      '--output-format', 'text',
      '--dangerously-skip-permissions',  // Required for non-interactive use
    ];

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    // Add image files if provided
    if (imagePaths && imagePaths.length > 0) {
      for (const imagePath of imagePaths) {
        args.push('--add', imagePath);
      }
    }

    // Use project path if provided, otherwise use gastown path
    const cwd = projectPath || this.gastownPath;

    // Pass message via stdin to avoid shell escaping issues
    return this.spawnWithStdin(this.claudePath, args, message, cwd, start, 120000, executionId);
  }

  private spawnWithStdin(
    cmd: string,
    args: string[],
    stdinData: string,
    cwd: string,
    start: number,
    timeout = 120000,
    executionId?: string
  ): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      const validCwd = getValidCwd(cwd);

      console.log('[Executor] Running Claude with stdin in:', validCwd);
      console.log('[Executor] Args:', args);
      if (executionId) console.log('[Executor] Execution ID:', executionId);

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

      child.stdout?.on('data', (data) => { stdout += data; });
      child.stderr?.on('data', (data) => { stderr += data; });

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
      '--output-format', 'text',
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

    // Convert project path to WSL path if provided
    const wslCwd = projectPath ? this.toWslPath(projectPath) : this.wslGastownPath;

    return this.wslExecWithStdin('claude', args, message, start, 120000, wslCwd, executionId);
  }

  private wslExecWithStdin(cmd: string, args: string[], stdinData: string, start: number, timeout = 120000, wslCwd?: string, executionId?: string): Promise<ExecuteResult> {
    return new Promise((resolve) => {
      // Build argument list without the message (message goes to stdin)
      const argsStr = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');

      // If cwd is specified, wrap command with cd
      const fullCmd = wslCwd
        ? `cd "${wslCwd}" && ${cmd} ${argsStr}`
        : `${cmd} ${argsStr}`;

      const wslArgs = this.distro
        ? ['-d', this.distro, 'bash', '-c', fullCmd]
        : ['bash', '-c', fullCmd];

      console.log('[Executor] WSL running:', fullCmd);
      if (executionId) console.log('[Executor] Execution ID:', executionId);

      const child = spawn('wsl.exe', wslArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
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

      child.stdout?.on('data', (data) => { stdout += data; });
      child.stderr?.on('data', (data) => { stderr += data; });

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

        console.log('[Executor] WSL Claude exit code:', code, 'signal:', signal);
        if (stderr) console.log('[Executor] WSL Claude stderr:', stderr);

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
