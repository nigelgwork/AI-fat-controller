import { contextBridge, ipcRenderer } from 'electron';

// Types for the exposed API
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

export interface ExecuteResult {
  success: boolean;
  response?: string;
  error?: string;
  duration: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  hasBeads: boolean;
  lastModified?: string;
  gitRemote?: string;
  gitBranch?: string;
}

export interface ClaudeSession {
  pid: number;
  workingDir: string;
  projectName?: string;
  command: string;
  startTime?: string;
}

export interface SystemStatus {
  projects: Project[];
  sessions: ClaudeSession[];
  discovered: Project[];
}

export interface AppSettings {
  executionMode: 'windows' | 'wsl';
  defaultMode: 'windows' | 'wsl' | 'auto';
  windows: { claudePath?: string };
  wsl: { distro?: string };
  gastownPath: string;
  theme: 'dark' | 'light' | 'system';
  startMinimized: boolean;
  minimizeToTray: boolean;
  showModeToggle: boolean;
  autoCheckUpdates: boolean;
  hasCompletedSetup: boolean;
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Mode
  getMode: (): Promise<'windows' | 'wsl'> => ipcRenderer.invoke('mode:get'),
  setMode: (mode: 'windows' | 'wsl'): Promise<void> => ipcRenderer.invoke('mode:set', mode),
  detectModes: (): Promise<ModeStatus> => ipcRenderer.invoke('mode:detect'),
  getModeStatus: (): Promise<ModeStatus> => ipcRenderer.invoke('mode:status'),

  // Claude Code
  executeClaudeCode: (message: string, systemPrompt?: string): Promise<ExecuteResult> =>
    ipcRenderer.invoke('claude:execute', message, systemPrompt),

  // Gas Town CLI
  executeGt: (args: string[]): Promise<ExecuteResult> => ipcRenderer.invoke('gt:execute', args),
  executeBd: (args: string[]): Promise<ExecuteResult> => ipcRenderer.invoke('bd:execute', args),

  // Beads
  listBeads: (): Promise<unknown[]> => ipcRenderer.invoke('beads:list'),
  getBeadsStats: (): Promise<unknown> => ipcRenderer.invoke('beads:stats'),
  getBeadsEvents: (limit?: number): Promise<unknown[]> => ipcRenderer.invoke('beads:events', limit),

  // Settings
  getSetting: <K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> =>
    ipcRenderer.invoke('settings:get', key),
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:getAll'),

  // App
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('app:checkUpdates'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('app:installUpdate'),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  minimize: (): Promise<void> => ipcRenderer.invoke('app:minimize'),

  // Projects
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
  addProject: (path: string): Promise<Project> => ipcRenderer.invoke('projects:add', path),
  removeProject: (id: string): Promise<void> => ipcRenderer.invoke('projects:remove', id),
  refreshProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:refresh'),
  discoverProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:discover'),
  browseForProject: (): Promise<string | null> => ipcRenderer.invoke('projects:browse'),

  // Claude sessions
  getClaudeSessions: (): Promise<ClaudeSession[]> => ipcRenderer.invoke('claude:sessions'),

  // System status
  getSystemStatus: (): Promise<SystemStatus> => ipcRenderer.invoke('system:status'),

  // Event listeners
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update-available', callback);
    return () => ipcRenderer.removeListener('update-available', callback);
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback);
    return () => ipcRenderer.removeListener('update-downloaded', callback);
  },
  onModeChanged: (callback: (mode: 'windows' | 'wsl') => void) => {
    const handler = (_: unknown, mode: 'windows' | 'wsl') => callback(mode);
    ipcRenderer.on('mode-changed', handler);
    return () => ipcRenderer.removeListener('mode-changed', handler);
  },
});

// Type declaration for the window object
declare global {
  interface Window {
    electronAPI: {
      getMode: () => Promise<'windows' | 'wsl'>;
      setMode: (mode: 'windows' | 'wsl') => Promise<void>;
      detectModes: () => Promise<ModeStatus>;
      getModeStatus: () => Promise<ModeStatus>;
      executeClaudeCode: (message: string, systemPrompt?: string) => Promise<ExecuteResult>;
      executeGt: (args: string[]) => Promise<ExecuteResult>;
      executeBd: (args: string[]) => Promise<ExecuteResult>;
      listBeads: () => Promise<unknown[]>;
      getBeadsStats: () => Promise<unknown>;
      getBeadsEvents: (limit?: number) => Promise<unknown[]>;
      getSetting: <K extends keyof AppSettings>(key: K) => Promise<AppSettings[K]>;
      setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
      getAllSettings: () => Promise<AppSettings>;
      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<void>;
      installUpdate: () => Promise<void>;
      quit: () => Promise<void>;
      minimize: () => Promise<void>;
      onUpdateAvailable: (callback: () => void) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;
      onModeChanged: (callback: (mode: 'windows' | 'wsl') => void) => () => void;
      // Projects
      listProjects: () => Promise<Project[]>;
      addProject: (path: string) => Promise<Project>;
      removeProject: (id: string) => Promise<void>;
      refreshProjects: () => Promise<Project[]>;
      discoverProjects: () => Promise<Project[]>;
      browseForProject: () => Promise<string | null>;
      // Claude sessions
      getClaudeSessions: () => Promise<ClaudeSession[]>;
      // System status
      getSystemStatus: () => Promise<SystemStatus>;
    };
  }
}
