import type { Bead, AppSettings, ExecutionMode } from './gastown';

export interface ModeStatusResult {
  current: ExecutionMode;
  windows: { available: boolean; claudePath?: string; version?: string };
  wsl: { available: boolean; distro?: string; version?: string };
}

export interface ExecuteResult {
  success: boolean;
  response?: string;
  error?: string;
  exitCode?: number;
}

export interface BeadStats {
  total: number;
  open: number;
  in_progress: number;
  blocked: number;
  closed: number;
  ready: number;
  actionable: number;
  byStatus?: {
    active?: number;
    pending?: number;
  };
}

interface ElectronAPI {
  // Mode management
  getMode: () => Promise<ExecutionMode>;
  setMode: (mode: ExecutionMode) => Promise<void>;
  detectModes: () => Promise<ModeStatusResult>;
  getModeStatus: () => Promise<ModeStatusResult>;

  // Command execution
  executeGt: (args: string[]) => Promise<ExecuteResult>;
  executeBd: (args: string[]) => Promise<ExecuteResult>;
  executeClaudeCode: (message: string) => Promise<ExecuteResult>;
  runCommand: (command: string, args?: string[]) => Promise<ExecuteResult>;

  // Beads
  listBeads: (rig?: string) => Promise<Bead[]>;
  getBeads: (rig?: string) => Promise<Bead[]>;
  getBeadsStats: (rig?: string) => Promise<BeadStats>;
  getBeadStats: (rig?: string) => Promise<BeadStats>;

  // Settings
  getSetting: <K extends keyof AppSettings>(key: K) => Promise<AppSettings[K]>;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  getAllSettings: () => Promise<AppSettings>;

  // App events
  onModeChanged: (callback: (mode: ExecutionMode) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
