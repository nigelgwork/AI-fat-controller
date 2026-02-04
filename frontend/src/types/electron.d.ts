import type { Bead, AppSettings, ExecutionMode, Task, CreateTaskInput, UpdateTaskInput, TasksStats, ControllerState, ControllerPhase, ProgressState, TokenUsage, UsageLimitConfig, UsageLimitStatus, ApprovalRequest, ActionLog, ConversationEntry, ConversationSession, NtfyConfig, PendingQuestion, ProjectBrief, DeepDivePlan, NewProjectSpec, CaptureOptions, ScreenshotResult, ScreenAnalysis, UIVerificationResult, TestScenario, TestStep, TestResult, MCPServerConfig, MCPTool, TestExecutionConfig, ExecutionSession, SessionLogEntry, ExecutionSessionSummary } from './gastown';

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
  executeClaudeCode: (message: string, systemPrompt?: string, projectPath?: string, imagePaths?: string[]) => Promise<ExecuteResult>;

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

  // Controller (Phat Controller - AI Project Manager)
  getControllerState: () => Promise<ControllerState>;
  activateController: () => Promise<void>;
  deactivateController: () => Promise<void>;
  pauseController: () => Promise<void>;
  resumeController: () => Promise<void>;
  getApprovalQueue: () => Promise<ApprovalRequest[]>;
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string, reason?: string) => Promise<void>;
  getActionLogs: (limit?: number) => Promise<ActionLog[]>;
  setControllerProgress: (phase: ControllerPhase, step: number, totalSteps: number, description: string) => Promise<void>;
  clearControllerProgress: () => Promise<void>;
  updateTokenUsage: (input: number, output: number) => Promise<void>;
  resetTokenUsage: () => Promise<void>;
  setConversationSession: (sessionId: string | null) => Promise<void>;
  getUsageLimitConfig: () => Promise<UsageLimitConfig>;
  updateUsageLimitConfig: (config: Partial<UsageLimitConfig>) => Promise<void>;
  getUsagePercentages: () => Promise<{ hourly: number; daily: number }>;

  // Backwards compatibility: Mayor aliases
  getMayorState: () => Promise<ControllerState>;
  activateMayor: () => Promise<void>;
  deactivateMayor: () => Promise<void>;
  pauseMayor: () => Promise<void>;
  resumeMayor: () => Promise<void>;

  // Conversations
  createConversationSession: (projectId: string, projectName: string) => Promise<ConversationSession>;
  appendConversationEntry: (sessionId: string, entry: { role: 'user' | 'assistant' | 'system'; content: string; projectId?: string; taskId?: string; tokens?: { input: number; output: number } }) => Promise<ConversationEntry>;
  loadConversation: (sessionId: string, options?: { limit?: number; offset?: number }) => Promise<ConversationEntry[]>;
  listConversationSessions: (projectId?: string) => Promise<ConversationSession[]>;
  getConversationSession: (sessionId: string) => Promise<ConversationSession | null>;
  updateConversationSession: (sessionId: string, updates: { summary?: string; projectName?: string }) => Promise<ConversationSession | null>;
  deleteConversationSession: (sessionId: string) => Promise<boolean>;
  getRecentConversations: (limit?: number) => Promise<ConversationSession[]>;
  searchConversations: (query: string, options?: { projectId?: string; limit?: number }) => Promise<Array<{ session: ConversationSession; entry: ConversationEntry; match: string }>>;
  getConversationStats: () => Promise<{ totalSessions: number; totalEntries: number; totalTokens: { input: number; output: number }; sessionsByProject: Record<string, number> }>;

  // Update event listeners
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (data: { version: string; releaseNotes?: string }) => void) => () => void;
  onUpdateNotAvailable: (callback: () => void) => () => void;
  onUpdateProgress: (callback: (data: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (data: { version: string }) => void) => () => void;
  onUpdateError: (callback: (data: { error: string }) => void) => () => void;

  // Mode event listeners
  onModeChanged: (callback: (mode: ExecutionMode) => void) => () => void;

  // Controller event listeners
  onControllerStateChanged: (callback: (state: ControllerState) => void) => () => void;
  onApprovalRequired: (callback: (request: ApprovalRequest) => void) => () => void;
  onActionCompleted: (callback: (log: ActionLog) => void) => () => void;
  onProgressUpdated: (callback: (progress: ProgressState | null) => void) => () => void;
  onUsageWarning: (callback: (data: { status: UsageLimitStatus; percentage: number }) => void) => () => void;

  // Backwards compatibility: Mayor event listeners
  onMayorStateChanged: (callback: (state: ControllerState) => void) => () => void;

  // ntfy notifications
  getNtfyConfig: () => Promise<NtfyConfig>;
  setNtfyConfig: (config: Partial<NtfyConfig>) => Promise<NtfyConfig>;
  sendNtfyNotification: (title: string, message: string, options?: { priority?: 'min' | 'low' | 'default' | 'high' | 'urgent'; tags?: string[] }) => Promise<boolean>;
  getPendingQuestions: () => Promise<PendingQuestion[]>;
  askNtfyQuestion: (question: string, taskId: string, taskTitle: string, options?: { choices?: string[]; freeText?: boolean; timeoutMinutes?: number }) => Promise<PendingQuestion>;
  answerNtfyQuestion: (id: string, answer: string) => Promise<PendingQuestion | null>;
  startNtfyPolling: () => Promise<void>;
  stopNtfyPolling: () => Promise<void>;
  testNtfyConnection: () => Promise<{ success: boolean; error?: string }>;

  // ntfy event listeners
  onNtfyQuestionAsked: (callback: (question: PendingQuestion) => void) => () => void;
  onNtfyQuestionAnswered: (callback: (question: PendingQuestion) => void) => () => void;

  // Executor debugging logs
  onExecutorLog: (callback: (log: { type: string; [key: string]: unknown }) => void) => () => void;

  // Project Briefs
  generateProjectBrief: (projectId: string, projectPath: string, projectName: string) => Promise<ProjectBrief>;
  getProjectBrief: (projectId: string) => Promise<ProjectBrief | null>;
  deleteProjectBrief: (projectId: string) => Promise<boolean>;
  listProjectBriefs: () => Promise<ProjectBrief[]>;

  // Deep Dive Plans
  generateDeepDivePlan: (projectId: string, projectPath: string, projectName: string, focus?: string) => Promise<DeepDivePlan>;
  getDeepDivePlan: (projectId: string) => Promise<DeepDivePlan | null>;
  updateDeepDivePlan: (projectId: string, updates: { status?: 'draft' | 'approved' | 'in_progress' | 'completed'; taskUpdates?: Array<{ taskId: string; status: 'pending' | 'in_progress' | 'completed' | 'failed' }> }) => Promise<DeepDivePlan | null>;
  deleteDeepDivePlan: (projectId: string) => Promise<boolean>;
  executeDeepDiveTask: (projectId: string, taskId: string) => Promise<{ success: boolean; output?: string; error?: string; requiresApproval?: boolean; approvalReason?: string }>;
  cancelDeepDiveTask: (projectId: string, taskId: string) => Promise<{ cancelled: boolean }>;
  convertDeepDiveToTasks: (projectId: string, options?: { phaseIds?: string[]; taskIds?: string[] }) => Promise<{ success: boolean; tasksCreated: number; error?: string }>;
  convertDeepDiveTaskToProjectTask: (projectId: string, taskId: string) => Promise<{ success: boolean; tasksCreated: number; error?: string }>;

  // New Project
  scaffoldNewProject: (targetPath: string, spec: NewProjectSpec) => Promise<{ success: boolean; error?: string }>;

  // Screenshot capture and analysis
  captureScreen: (options?: CaptureOptions) => Promise<ScreenshotResult>;
  captureActiveWindow: () => Promise<ScreenshotResult>;
  analyzeScreenshot: (screenshotPath: string, prompt: string) => Promise<ScreenAnalysis>;
  verifyUIElement: (description: string, screenshotPath?: string) => Promise<UIVerificationResult>;
  listScreenshots: () => Promise<string[]>;
  deleteScreenshot: (filePath: string) => Promise<boolean>;
  getLatestScreenshot: () => Promise<string | null>;

  // GUI Testing
  runGuiTest: (scenarioId: string) => Promise<TestResult>;
  createGuiTest: (scenario: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TestScenario>;
  getGuiTest: (id: string) => Promise<TestScenario | null>;
  updateGuiTest: (id: string, updates: Partial<TestScenario>) => Promise<TestScenario | null>;
  deleteGuiTest: (id: string) => Promise<boolean>;
  listGuiTests: () => Promise<TestScenario[]>;
  getGuiTestResults: (scenarioId: string, limit?: number) => Promise<TestResult[]>;
  generateGuiTest: (description: string, appName?: string) => Promise<TestScenario>;

  // GUI Test event listeners
  onGuiTestProgress: (callback: (data: { scenarioId: string; stepIndex: number; totalSteps: number; status: string }) => void) => () => void;
  onGuiTestComplete: (callback: (result: TestResult) => void) => () => void;

  // GUI Test with execution config
  runGuiTestWithConfig: (scenarioId: string, config?: Partial<TestExecutionConfig>) => Promise<TestResult>;

  // MCP Server Management
  getMcpConfigs: () => Promise<MCPServerConfig[]>;
  getMcpDefaultConfigs: () => Promise<MCPServerConfig[]>;
  addMcpConfig: (config: MCPServerConfig) => Promise<MCPServerConfig[]>;
  removeMcpConfig: (name: string) => Promise<MCPServerConfig[]>;
  connectMcpServer: (name: string) => Promise<{ connected: boolean; tools: MCPTool[] }>;
  disconnectMcpServer: (name: string) => Promise<boolean>;
  disconnectAllMcpServers: () => Promise<boolean>;
  getConnectedMcpServers: () => Promise<string[]>;
  getMcpServerTools: (name: string) => Promise<MCPTool[]>;
  callMcpTool: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  autoConnectMcpServers: () => Promise<string[]>;

  // tmux Session Management
  isTmuxAvailable: () => Promise<boolean>;
  getTmuxStatus: () => Promise<TmuxStatus>;
  listTmuxSessions: () => Promise<TmuxSession[]>;
  createTmuxSession: (name: string, projectId?: string, cwd?: string) => Promise<{ success: boolean; error?: string }>;
  attachTmuxSession: (name: string) => Promise<{ success: boolean; error?: string }>;
  killTmuxSession: (name: string) => Promise<{ success: boolean; error?: string }>;
  getTmuxSessionHistory: (name: string, lines?: number) => Promise<TmuxHistoryResult>;
  sendTmuxKeys: (name: string, keys: string) => Promise<{ success: boolean; error?: string }>;
  updateTmuxSessionMeta: (name: string, updates: { projectId?: string; notes?: string }) => Promise<{ success: boolean }>;
  renameTmuxSession: (oldName: string, newName: string) => Promise<{ success: boolean; error?: string }>;

  // Image handling for chat
  saveImageToTemp: (base64Data: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  cleanupTempImages: () => Promise<{ success: boolean; error?: string }>;

  // Clawdbot Personality Management
  getPersonalities: () => Promise<ClawdbotPersonality[]>;
  getPersonality: (id: string) => Promise<ClawdbotPersonality | undefined>;
  getCurrentPersonality: () => Promise<ClawdbotPersonality | undefined>;
  getCurrentPersonalityId: () => Promise<string | null>;
  setCurrentPersonality: (id: string) => Promise<boolean>;
  savePersonality: (personality: Omit<ClawdbotPersonality, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<ClawdbotPersonality>;
  deletePersonality: (id: string) => Promise<boolean>;
  getClawdbotGreeting: () => Promise<string>;

  // Token History
  getTokenHistory?: (days?: number) => Promise<DailyTokenUsage[]>;
  getTokenHistoryTotal?: (days?: number) => Promise<{ input: number; output: number }>;
  getTokenHistoryAverage?: (days?: number) => Promise<{ input: number; output: number }>;
  clearTokenHistory?: () => Promise<{ success: boolean }>;

  // Activity Log
  getActivityLogs?: (options?: ActivityLogQueryOptions) => Promise<ActivityLogEntry[]>;
  searchActivityLogs?: (query: string, filters?: ActivityLogQueryOptions) => Promise<ActivityLogEntry[]>;
  exportActivityLogs?: (format: 'json' | 'csv', dateRange?: { start?: string; end?: string }) => Promise<string>;
  getActivitySummary?: (dateRange?: { start?: string; end?: string }) => Promise<ActivitySummary>;
  clearActivityLogs?: () => Promise<{ success: boolean }>;

  // Clawdbot Intent/Action APIs
  parseIntent?: (text: string) => Promise<Intent>;
  dispatchAction?: (intent: Intent) => Promise<ActionResult>;
  executeConfirmedAction?: (confirmationMessage: string) => Promise<ActionResult>;
  getAvailableCommands?: () => Promise<Array<{ category: string; examples: string[] }>>;

  // Clawdbot Conversation Persistence
  getClawdbotMessages?: () => Promise<ClawdbotMessage[]>;
  addClawdbotMessage?: (message: { role: 'user' | 'assistant'; content: string; intent?: { type: string; action: string; confidence: number }; usedClaudeCode?: boolean }) => Promise<ClawdbotMessage>;
  clearClawdbotMessages?: () => Promise<{ success: boolean }>;

  // Execution Sessions (Claude Code session tracking)
  getActiveSessions?: () => Promise<ExecutionSessionSummary[]>;
  getSessionHistory?: (limit?: number) => Promise<ExecutionSessionSummary[]>;
  getSession?: (id: string) => Promise<ExecutionSession | undefined>;
  getSessionLogs?: (id: string, limit?: number) => Promise<SessionLogEntry[]>;
  cancelSession?: (id: string) => Promise<{ success: boolean }>;

  // Execution session event listeners
  onSessionUpdate?: (callback: (data: { session: ExecutionSessionSummary }) => void) => () => void;
  onSessionLog?: (callback: (data: { sessionId: string; entry: SessionLogEntry }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// tmux types
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

export interface TmuxStatus {
  available: boolean;
  platform: 'linux' | 'wsl' | 'windows-no-wsl' | 'macos';
  message: string;
}

// Token history types
export interface HourlyUsage {
  hour: number;
  input: number;
  output: number;
}

export interface DailyTokenUsage {
  date: string;
  hourlyUsage: HourlyUsage[];
  dailyTotal: {
    input: number;
    output: number;
  };
}

// Activity Log types
export type ActivityCategory = 'execution' | 'user_action' | 'system' | 'error';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  category: ActivityCategory;
  action: string;
  details: Record<string, unknown>;
  taskId?: string;
  projectId?: string;
  tokens?: { input: number; output: number };
  costUsd?: number;
  duration?: number;
}

export interface ActivitySummary {
  totalEntries: number;
  totalCostUsd: number;
  totalTokens: { input: number; output: number };
  byCategory: Record<ActivityCategory, number>;
  averageDuration: number;
}

export interface ActivityLogQueryOptions {
  category?: ActivityCategory;
  taskId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Clawdbot Intent/Action types
export type IntentType = 'navigation' | 'task_management' | 'execution' | 'query' | 'settings' | 'unknown';

export interface Intent {
  type: IntentType;
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
  originalText: string;
}

export interface ActionResult {
  success: boolean;
  action: string;
  response: string;
  data?: Record<string, unknown>;
  navigate?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

// Clawdbot conversation message
export interface ClawdbotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: {
    type: string;
    action: string;
    confidence: number;
  };
  usedClaudeCode?: boolean;
}

// Clawdbot personality types
export type TraitLevel = 'low' | 'medium' | 'high';

export interface ClawdbotPersonality {
  id: string;
  name: string;
  description: string;
  traits: {
    verbosity: TraitLevel;
    humor: TraitLevel;
    formality: TraitLevel;
    enthusiasm: TraitLevel;
  };
  customInstructions?: string;
  greeting?: string;
  signoff?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export {};
