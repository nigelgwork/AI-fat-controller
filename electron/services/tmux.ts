import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import Store from 'electron-store';
import { createLogger } from '../utils/logger';

const log = createLogger('Tmux');
const execAsync = promisify(exec);

// Check if running on Windows
const isWindows = process.platform === 'win32';

/**
 * Wrap a command for execution via WSL on Windows
 */
function wslWrap(command: string): string {
  if (isWindows) {
    // Escape double quotes and wrap for WSL
    const escaped = command.replace(/"/g, '\\"');
    return `wsl.exe -e bash -c "${escaped}"`;
  }
  return command;
}

// Store for tmux session metadata
interface TmuxSessionMeta {
  projectId?: string;
  notes?: string;
  createdAt: string;
}

interface TmuxStore {
  sessionMeta: Record<string, TmuxSessionMeta>;
}

const tmuxStore = new Store<TmuxStore>({
  name: 'tmux-sessions',
  defaults: {
    sessionMeta: {},
  },
});

export interface TmuxSession {
  id: string;
  name: string;
  windows: number;
  created: Date;
  attached: boolean;
  projectId?: string;
  notes?: string;
}

export interface TmuxHistoryResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Check if tmux is available
 * On Windows, checks for WSL tmux
 */
export async function isTmuxAvailable(): Promise<boolean> {
  try {
    if (isWindows) {
      // On Windows, check if tmux is available via WSL
      await execAsync('wsl.exe -e which tmux', { timeout: 10000 });
      return true;
    } else {
      await execAsync('which tmux', { timeout: 5000 });
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Get detailed tmux availability status
 */
export async function getTmuxStatus(): Promise<{
  available: boolean;
  platform: 'linux' | 'wsl' | 'windows-no-wsl' | 'macos';
  message: string;
}> {
  if (isWindows) {
    // Check if WSL is available
    try {
      await execAsync('wsl.exe --status', { timeout: 5000 });
      // WSL exists, check for tmux
      try {
        await execAsync('wsl.exe -e which tmux', { timeout: 10000 });
        return {
          available: true,
          platform: 'wsl',
          message: 'tmux available via WSL',
        };
      } catch {
        return {
          available: false,
          platform: 'wsl',
          message: 'WSL is installed but tmux is not. Run: wsl -e sudo apt install tmux',
        };
      }
    } catch {
      return {
        available: false,
        platform: 'windows-no-wsl',
        message: 'tmux requires WSL on Windows. Install WSL first: wsl --install',
      };
    }
  } else if (process.platform === 'darwin') {
    try {
      await execAsync('which tmux', { timeout: 5000 });
      return { available: true, platform: 'macos', message: 'tmux available' };
    } catch {
      return {
        available: false,
        platform: 'macos',
        message: 'tmux not installed. Run: brew install tmux',
      };
    }
  } else {
    try {
      await execAsync('which tmux', { timeout: 5000 });
      return { available: true, platform: 'linux', message: 'tmux available' };
    } catch {
      return {
        available: false,
        platform: 'linux',
        message: 'tmux not installed. Run: sudo apt install tmux',
      };
    }
  }
}

/**
 * List all tmux sessions
 */
export async function listSessions(): Promise<TmuxSession[]> {
  try {
    // Format: session_id:session_name:window_count:created_timestamp:attached
    const command = wslWrap(
      'tmux list-sessions -F "#{session_id}:#{session_name}:#{session_windows}:#{session_created}:#{session_attached}" 2>/dev/null || echo ""'
    );
    const { stdout } = await execAsync(command, { timeout: 10000 });

    if (!stdout.trim()) {
      return [];
    }

    const meta = tmuxStore.get('sessionMeta') || {};
    const sessions: TmuxSession[] = [];

    for (const line of stdout.trim().split('\n')) {
      if (!line) continue;
      const [id, name, windows, created, attached] = line.split(':');
      const sessionMeta = meta[name] || {};

      sessions.push({
        id,
        name,
        windows: parseInt(windows, 10) || 1,
        created: new Date(parseInt(created, 10) * 1000),
        attached: attached === '1',
        projectId: sessionMeta.projectId,
        notes: sessionMeta.notes,
      });
    }

    return sessions;
  } catch (error) {
    log.error('[Tmux] Failed to list sessions:', error);
    return [];
  }
}

/**
 * Create a new tmux session
 */
export async function createSession(
  name: string,
  projectId?: string,
  cwd?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Sanitize session name (tmux doesn't allow dots or colons)
    const safeName = name.replace(/[.:]/g, '_');

    let tmuxCommand = `tmux new-session -d -s '${safeName}'`;
    if (cwd) {
      tmuxCommand += ` -c '${cwd}'`;
    }

    await execAsync(wslWrap(tmuxCommand), { timeout: 10000 });

    // Save metadata
    const meta = tmuxStore.get('sessionMeta') || {};
    meta[safeName] = {
      projectId,
      createdAt: new Date().toISOString(),
    };
    tmuxStore.set('sessionMeta', meta);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('[Tmux] Failed to create session:', message);
    return { success: false, error: message };
  }
}

/**
 * Attach to a tmux session (opens external terminal)
 */
export async function attachSession(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    let fullCommand: string;

    if (isWindows) {
      // On Windows, use Windows Terminal to attach to WSL tmux session
      // Try Windows Terminal first, fall back to cmd with wsl
      try {
        await execAsync('where wt.exe', { timeout: 2000 });
        fullCommand = `wt.exe -w 0 wsl.exe -e tmux attach -t "${name}"`;
      } catch {
        // Fall back to cmd launching wsl
        fullCommand = `start cmd /c wsl.exe -e tmux attach -t "${name}"`;
      }
    } else {
      // On Linux/macOS, find a terminal emulator
      const terminals = [
        'x-terminal-emulator',
        'gnome-terminal',
        'konsole',
        'xfce4-terminal',
        'alacritty',
        'kitty',
        'xterm',
      ];

      let terminalCmd: string | null = null;
      for (const term of terminals) {
        try {
          await execAsync(`which ${term}`, { timeout: 2000 });
          terminalCmd = term;
          break;
        } catch {
          // Try next terminal
        }
      }

      if (!terminalCmd) {
        return { success: false, error: 'No terminal emulator found' };
      }

      // Build the attach command based on terminal type
      if (terminalCmd === 'gnome-terminal') {
        fullCommand = `gnome-terminal -- tmux attach -t "${name}"`;
      } else if (terminalCmd === 'konsole') {
        fullCommand = `konsole -e tmux attach -t "${name}"`;
      } else if (terminalCmd === 'xfce4-terminal') {
        fullCommand = `xfce4-terminal -e "tmux attach -t '${name}'"`;
      } else if (terminalCmd === 'alacritty') {
        fullCommand = `alacritty -e tmux attach -t "${name}"`;
      } else if (terminalCmd === 'kitty') {
        fullCommand = `kitty tmux attach -t "${name}"`;
      } else {
        fullCommand = `${terminalCmd} -e tmux attach -t "${name}"`;
      }
    }

    // Spawn detached so the terminal runs independently
    const child = spawn(fullCommand, {
      shell: true,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('[Tmux] Failed to attach session:', message);
    return { success: false, error: message };
  }
}

/**
 * Kill a tmux session
 */
export async function killSession(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(wslWrap(`tmux kill-session -t '${name}'`), { timeout: 10000 });

    // Remove metadata
    const meta = tmuxStore.get('sessionMeta') || {};
    delete meta[name];
    tmuxStore.set('sessionMeta', meta);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('[Tmux] Failed to kill session:', message);
    return { success: false, error: message };
  }
}

/**
 * Get the history/content of a tmux session pane
 */
export async function getSessionHistory(
  name: string,
  lines: number = 1000
): Promise<TmuxHistoryResult> {
  try {
    // Capture pane content from the first window/pane
    const command = wslWrap(`tmux capture-pane -t '${name}' -p -S -${lines}`);
    const { stdout } = await execAsync(command, {
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024,
    }); // 10MB buffer

    return { success: true, content: stdout };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('[Tmux] Failed to get session history:', message);
    return { success: false, error: message };
  }
}

/**
 * Send keys to a tmux session
 */
export async function sendKeys(
  name: string,
  keys: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Escape single quotes in keys for shell safety
    const escapedKeys = keys.replace(/'/g, "'\\''");
    const command = wslWrap(`tmux send-keys -t '${name}' '${escapedKeys}' Enter`);
    await execAsync(command, { timeout: 10000 });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('[Tmux] Failed to send keys:', message);
    return { success: false, error: message };
  }
}

/**
 * Update session metadata
 */
export function updateSessionMeta(
  name: string,
  updates: { projectId?: string; notes?: string }
): void {
  const meta = tmuxStore.get('sessionMeta') || {};
  meta[name] = {
    ...meta[name],
    ...updates,
    createdAt: meta[name]?.createdAt || new Date().toISOString(),
  };
  tmuxStore.set('sessionMeta', meta);
}

/**
 * Get session metadata
 */
export function getSessionMeta(name: string): TmuxSessionMeta | undefined {
  const meta = tmuxStore.get('sessionMeta') || {};
  return meta[name];
}

/**
 * Rename a tmux session
 */
export async function renameSession(
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const safeName = newName.replace(/[.:]/g, '_');
    const command = wslWrap(`tmux rename-session -t '${oldName}' '${safeName}'`);
    await execAsync(command, { timeout: 10000 });

    // Move metadata to new name
    const meta = tmuxStore.get('sessionMeta') || {};
    if (meta[oldName]) {
      meta[safeName] = meta[oldName];
      delete meta[oldName];
      tmuxStore.set('sessionMeta', meta);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('[Tmux] Failed to rename session:', message);
    return { success: false, error: message };
  }
}
