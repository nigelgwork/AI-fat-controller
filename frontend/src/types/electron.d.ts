import type { Bead, AppSettings, ExecutionMode, Task, CreateTaskInput, UpdateTaskInput, TasksStats, MayorState, ApprovalRequest, ActionLog } from './gastown';

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
  duration?: number;
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

export interface Project {
  id: string;
  name: string;
  path: string;
  hasBeads: boolean;
  hasClaude: boolean;
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
  source?: 'windows' | 'wsl' | 'history';
  status?: 'running' | 'recent';
  sessionId?: string;
}

export interface ClaudeAgent {
  id: string;
  name: string;
  description: string;
  model?: string;
  color?: string;
  tools?: string[];
  content: string;
  filePath: string;
  pluginName: string;
  isCustom: boolean;
}

export interface AgentPlugin {
  name: string;
  path: string;
  agentCount: number;
  isCustom: boolean;
}

export interface SystemStatus {
  projects: Project[];
  sessions: ClaudeSession[];
  discovered: Project[];
}

export interface UpdateStatusType {
  checking: boolean;
  available: boolean;
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  version: string | null;
  releaseNotes: string | null;
  error: string | null;
}

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

interface ElectronAPI {
  // Mode management
  getMode: () => Promise<ExecutionMode>;
  setMode: (mode: ExecutionMode) => Promise<void>;
  detectModes: () => Promise<ModeStatusResult>;
  getModeStatus: () => Promise<ModeStatusResult>;

  // Command execution
  executeGt: (args: string[]) => Promise<ExecuteResult>;
  executeBd: (args: string[]) => Promise<ExecuteResult>;
  executeClaudeCode: (message: string, systemPrompt?: string) => Promise<ExecuteResult>;

  // Beads
  listBeads: (rig?: string) => Promise<Bead[]>;
  getBeadsStats: (rig?: string) => Promise<BeadStats>;
  getBeadsEvents: (limit?: number) => Promise<unknown[]>;

  // Settings
  getSetting: <K extends keyof AppSettings>(key: K) => Promise<AppSettings[K]>;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  getAllSettings: () => Promise<AppSettings>;

  // App
  getVersion: () => Promise<string>;
  quit: () => Promise<void>;
  minimize: () => Promise<void>;

  // Updates
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<UpdateStatusType>;

  // Debug
  getDebugInfo: () => Promise<DebugInfo>;

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

  // Agent management
  listAgents: () => Promise<ClaudeAgent[]>;
  getAgent: (id: string) => Promise<ClaudeAgent | null>;
  createAgent: (agent: Partial<ClaudeAgent>) => Promise<ClaudeAgent>;
  updateAgent: (id: string, updates: Partial<ClaudeAgent>) => Promise<ClaudeAgent>;
  deleteAgent: (id: string) => Promise<void>;
  getAgentPlugins: () => Promise<AgentPlugin[]>;
  copyAgentToWindows: (id: string) => Promise<ClaudeAgent>;
  copyAgentToWsl: (id: string) => Promise<ClaudeAgent>;

  // Tasks
  listTasks: () => Promise<Task[]>;
  getTask: (id: string) => Promise<Task | null>;
  getTasksByProject: (projectId: string) => Promise<Task[]>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, updates: UpdateTaskInput) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  getTasksStats: () => Promise<TasksStats>;
  sendTaskToClaude: (id: string) => Promise<ExecuteResult>;

  // Mayor (AI Project Manager)
  getMayorState: () => Promise<MayorState>;
  activateMayor: () => Promise<void>;
  deactivateMayor: () => Promise<void>;
  pauseMayor: () => Promise<void>;
  resumeMayor: () => Promise<void>;
  getApprovalQueue: () => Promise<ApprovalRequest[]>;
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string, reason?: string) => Promise<void>;
  getActionLogs: (limit?: number) => Promise<ActionLog[]>;

  // Update event listeners
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (data: { version: string; releaseNotes?: string }) => void) => () => void;
  onUpdateNotAvailable: (callback: () => void) => () => void;
  onUpdateProgress: (callback: (data: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (data: { version: string }) => void) => () => void;
  onUpdateError: (callback: (data: { error: string }) => void) => () => void;

  // Mode event listeners
  onModeChanged: (callback: (mode: ExecutionMode) => void) => () => void;

  // Mayor event listeners
  onMayorStateChanged: (callback: (state: MayorState) => void) => () => void;
  onApprovalRequired: (callback: (request: ApprovalRequest) => void) => () => void;
  onActionCompleted: (callback: (log: ActionLog) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
