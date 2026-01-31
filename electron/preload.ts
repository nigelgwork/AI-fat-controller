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

// Task types
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: string;
  projectName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  projectName?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  projectName?: string;
}

export interface TasksStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
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

// Controller (Phat Controller) types
export type ControllerStatus = 'idle' | 'running' | 'paused' | 'waiting_approval' | 'waiting_input';
export type ControllerPhase = 'planning' | 'executing' | 'reviewing' | 'idle';
export type ApprovalActionType = 'planning' | 'architecture' | 'git_push' | 'large_edit';

export interface ProgressState {
  phase: ControllerPhase;
  step: number;
  totalSteps: number;
  stepDescription: string;
  startedAt: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  limit: number;
  resetAt: string;
}

export interface UsageLimitConfig {
  maxTokensPerHour: number;
  maxTokensPerDay: number;
  pauseThreshold: number;
  warningThreshold: number;
  autoResumeOnReset: boolean;
}

export type UsageLimitStatus = 'ok' | 'warning' | 'approaching_limit' | 'at_limit';

export interface ControllerState {
  status: ControllerStatus;
  currentTaskId: string | null;
  currentAction: string | null;
  startedAt: string | null;
  processedCount: number;
  approvedCount: number;
  rejectedCount: number;
  errorCount: number;
  currentProgress: ProgressState | null;
  conversationSessionId: string | null;
  tokenUsage: TokenUsage;
  usageLimitConfig: UsageLimitConfig;
  dailyTokenUsage: { input: number; output: number; date: string };
  usageLimitStatus: UsageLimitStatus;
  pausedDueToLimit: boolean;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  taskTitle: string;
  actionType: ApprovalActionType;
  description: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ActionLog {
  id: string;
  taskId: string;
  taskTitle: string;
  actionType: string;
  description: string;
  autoApproved: boolean;
  result: 'success' | 'failure' | 'skipped';
  output?: string;
  duration: number;
  timestamp: string;
}

// Conversation types
export interface ConversationEntry {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  projectId?: string;
  taskId?: string;
  tokens?: { input: number; output: number };
}

export interface ConversationSession {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  lastActivityAt: string;
  entryCount: number;
  totalTokens: { input: number; output: number };
  summary?: string;
}

// Backwards compatibility
export type MayorStatus = ControllerStatus;
export type MayorState = ControllerState;

// ntfy notification types
export interface NtfyConfig {
  enabled: boolean;
  serverUrl: string;
  topic: string;
  responseTopic?: string;
  priority: 'min' | 'low' | 'default' | 'high' | 'urgent';
  authToken?: string;
  enableDesktopNotifications: boolean;
}

export interface PendingQuestion {
  id: string;
  question: string;
  options?: string[];
  freeText: boolean;
  taskId: string;
  taskTitle: string;
  status: 'pending' | 'answered' | 'expired';
  answer?: string;
  createdAt: string;
  expiresAt: string;
}

// Screenshot types
export interface CaptureOptions {
  display?: number;
  region?: { x: number; y: number; width: number; height: number };
}

export interface ScreenshotResult {
  success: boolean;
  filePath?: string;
  base64?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface ScreenAnalysis {
  success: boolean;
  analysis?: string;
  error?: string;
}

export interface UIVerificationResult {
  found: boolean;
  confidence: string;
  details: string;
  error?: string;
}

// MCP Server types
export interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'websocket';
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  autoConnect: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
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

  // Update status
  getUpdateStatus: (): Promise<UpdateStatusType> => ipcRenderer.invoke('app:updateStatus'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('app:downloadUpdate'),

  // Debug info
  getDebugInfo: (): Promise<DebugInfo> => ipcRenderer.invoke('app:debugInfo'),

  // Agent management
  listAgents: (): Promise<ClaudeAgent[]> => ipcRenderer.invoke('agents:list'),
  getAgent: (id: string): Promise<ClaudeAgent | null> => ipcRenderer.invoke('agents:get', id),
  createAgent: (agent: Partial<ClaudeAgent>): Promise<ClaudeAgent> => ipcRenderer.invoke('agents:create', agent),
  updateAgent: (id: string, updates: Partial<ClaudeAgent>): Promise<ClaudeAgent> => ipcRenderer.invoke('agents:update', id, updates),
  deleteAgent: (id: string): Promise<void> => ipcRenderer.invoke('agents:delete', id),
  getAgentPlugins: (): Promise<AgentPlugin[]> => ipcRenderer.invoke('agents:plugins'),
  copyAgentToWindows: (id: string): Promise<ClaudeAgent> => ipcRenderer.invoke('agents:copyToWindows', id),
  copyAgentToWsl: (id: string): Promise<ClaudeAgent> => ipcRenderer.invoke('agents:copyToWsl', id),

  // Tasks
  listTasks: (): Promise<Task[]> => ipcRenderer.invoke('tasks:list'),
  getTask: (id: string): Promise<Task | null> => ipcRenderer.invoke('tasks:get', id),
  getTasksByProject: (projectId: string): Promise<Task[]> => ipcRenderer.invoke('tasks:byProject', projectId),
  createTask: (input: CreateTaskInput): Promise<Task> => ipcRenderer.invoke('tasks:create', input),
  updateTask: (id: string, updates: UpdateTaskInput): Promise<Task | null> => ipcRenderer.invoke('tasks:update', id, updates),
  deleteTask: (id: string): Promise<boolean> => ipcRenderer.invoke('tasks:delete', id),
  getTasksStats: (): Promise<TasksStats> => ipcRenderer.invoke('tasks:stats'),
  sendTaskToClaude: (id: string): Promise<ExecuteResult> => ipcRenderer.invoke('tasks:sendToClaude', id),

  // Controller (Phat Controller - AI Project Manager)
  getControllerState: (): Promise<ControllerState> => ipcRenderer.invoke('controller:getState'),
  activateController: (): Promise<void> => ipcRenderer.invoke('controller:activate'),
  deactivateController: (): Promise<void> => ipcRenderer.invoke('controller:deactivate'),
  pauseController: (): Promise<void> => ipcRenderer.invoke('controller:pause'),
  resumeController: (): Promise<void> => ipcRenderer.invoke('controller:resume'),
  getApprovalQueue: (): Promise<ApprovalRequest[]> => ipcRenderer.invoke('controller:getApprovalQueue'),
  approveRequest: (id: string): Promise<void> => ipcRenderer.invoke('controller:approveRequest', id),
  rejectRequest: (id: string, reason?: string): Promise<void> => ipcRenderer.invoke('controller:rejectRequest', id, reason),
  getActionLogs: (limit?: number): Promise<ActionLog[]> => ipcRenderer.invoke('controller:getActionLogs', limit),
  setControllerProgress: (phase: string, step: number, totalSteps: number, description: string): Promise<void> =>
    ipcRenderer.invoke('controller:setProgress', phase, step, totalSteps, description),
  clearControllerProgress: (): Promise<void> => ipcRenderer.invoke('controller:clearProgress'),
  updateTokenUsage: (input: number, output: number): Promise<void> => ipcRenderer.invoke('controller:updateTokenUsage', input, output),
  resetTokenUsage: (): Promise<void> => ipcRenderer.invoke('controller:resetTokenUsage'),
  setConversationSession: (sessionId: string | null): Promise<void> => ipcRenderer.invoke('controller:setConversationSession', sessionId),
  getUsageLimitConfig: (): Promise<UsageLimitConfig> => ipcRenderer.invoke('controller:getUsageLimitConfig'),
  updateUsageLimitConfig: (config: Partial<UsageLimitConfig>): Promise<void> => ipcRenderer.invoke('controller:updateUsageLimitConfig', config),
  getUsagePercentages: (): Promise<{ hourly: number; daily: number }> => ipcRenderer.invoke('controller:getUsagePercentages'),

  // Backwards compatibility aliases for Mayor
  getMayorState: (): Promise<ControllerState> => ipcRenderer.invoke('mayor:getState'),
  activateMayor: (): Promise<void> => ipcRenderer.invoke('mayor:activate'),
  deactivateMayor: (): Promise<void> => ipcRenderer.invoke('mayor:deactivate'),
  pauseMayor: (): Promise<void> => ipcRenderer.invoke('mayor:pause'),
  resumeMayor: (): Promise<void> => ipcRenderer.invoke('mayor:resume'),

  // Conversations
  createConversationSession: (projectId: string, projectName: string): Promise<ConversationSession> =>
    ipcRenderer.invoke('conversations:create', projectId, projectName),
  appendConversationEntry: (sessionId: string, entry: { role: 'user' | 'assistant' | 'system'; content: string; projectId?: string; taskId?: string; tokens?: { input: number; output: number } }): Promise<ConversationEntry> =>
    ipcRenderer.invoke('conversations:append', sessionId, entry),
  loadConversation: (sessionId: string, options?: { limit?: number; offset?: number }): Promise<ConversationEntry[]> =>
    ipcRenderer.invoke('conversations:load', sessionId, options),
  listConversationSessions: (projectId?: string): Promise<ConversationSession[]> =>
    ipcRenderer.invoke('conversations:list', projectId),
  getConversationSession: (sessionId: string): Promise<ConversationSession | null> =>
    ipcRenderer.invoke('conversations:get', sessionId),
  updateConversationSession: (sessionId: string, updates: { summary?: string; projectName?: string }): Promise<ConversationSession | null> =>
    ipcRenderer.invoke('conversations:update', sessionId, updates),
  deleteConversationSession: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('conversations:delete', sessionId),
  getRecentConversations: (limit?: number): Promise<ConversationSession[]> =>
    ipcRenderer.invoke('conversations:recent', limit),
  searchConversations: (query: string, options?: { projectId?: string; limit?: number }): Promise<Array<{ session: ConversationSession; entry: ConversationEntry; match: string }>> =>
    ipcRenderer.invoke('conversations:search', query, options),
  getConversationStats: (): Promise<{ totalSessions: number; totalEntries: number; totalTokens: { input: number; output: number }; sessionsByProject: Record<string, number> }> =>
    ipcRenderer.invoke('conversations:stats'),

  // ntfy notifications
  getNtfyConfig: (): Promise<NtfyConfig> => ipcRenderer.invoke('ntfy:getConfig'),
  setNtfyConfig: (config: Partial<NtfyConfig>): Promise<NtfyConfig> => ipcRenderer.invoke('ntfy:setConfig', config),
  sendNtfyNotification: (title: string, message: string, options?: { priority?: 'min' | 'low' | 'default' | 'high' | 'urgent'; tags?: string[] }): Promise<boolean> =>
    ipcRenderer.invoke('ntfy:sendNotification', title, message, options),
  getPendingQuestions: (): Promise<PendingQuestion[]> => ipcRenderer.invoke('ntfy:getPendingQuestions'),
  askNtfyQuestion: (question: string, taskId: string, taskTitle: string, options?: { choices?: string[]; freeText?: boolean; timeoutMinutes?: number }): Promise<PendingQuestion> =>
    ipcRenderer.invoke('ntfy:askQuestion', question, taskId, taskTitle, options),
  answerNtfyQuestion: (id: string, answer: string): Promise<PendingQuestion | null> =>
    ipcRenderer.invoke('ntfy:answerQuestion', id, answer),
  startNtfyPolling: (): Promise<void> => ipcRenderer.invoke('ntfy:startPolling'),
  stopNtfyPolling: (): Promise<void> => ipcRenderer.invoke('ntfy:stopPolling'),
  testNtfyConnection: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('ntfy:testConnection'),

  // Project Briefs
  generateProjectBrief: (projectId: string, projectPath: string, projectName: string): Promise<unknown> =>
    ipcRenderer.invoke('briefs:generate', projectId, projectPath, projectName),
  getProjectBrief: (projectId: string): Promise<unknown> =>
    ipcRenderer.invoke('briefs:get', projectId),
  deleteProjectBrief: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('briefs:delete', projectId),
  listProjectBriefs: (): Promise<unknown[]> =>
    ipcRenderer.invoke('briefs:list'),

  // Deep Dive Plans
  generateDeepDivePlan: (projectId: string, projectPath: string, projectName: string, focus?: string): Promise<unknown> =>
    ipcRenderer.invoke('deepdive:generate', projectId, projectPath, projectName, focus),
  getDeepDivePlan: (projectId: string): Promise<unknown> =>
    ipcRenderer.invoke('deepdive:get', projectId),
  updateDeepDivePlan: (projectId: string, updates: { status?: string; taskUpdates?: Array<{ taskId: string; status: string }> }): Promise<unknown> =>
    ipcRenderer.invoke('deepdive:update', projectId, updates),
  deleteDeepDivePlan: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('deepdive:delete', projectId),

  // New Project
  scaffoldNewProject: (targetPath: string, spec: { name: string; description: string; type: string; techStack: string[]; features: string[] }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('project:scaffold', targetPath, spec),

  // Screenshot capture and analysis
  captureScreen: (options?: CaptureOptions): Promise<ScreenshotResult> =>
    ipcRenderer.invoke('screenshot:capture', options),
  captureActiveWindow: (): Promise<ScreenshotResult> =>
    ipcRenderer.invoke('screenshot:captureActiveWindow'),
  analyzeScreenshot: (screenshotPath: string, prompt: string): Promise<ScreenAnalysis> =>
    ipcRenderer.invoke('screenshot:analyze', screenshotPath, prompt),
  verifyUIElement: (description: string, screenshotPath?: string): Promise<UIVerificationResult> =>
    ipcRenderer.invoke('screenshot:verify', description, screenshotPath),
  listScreenshots: (): Promise<string[]> =>
    ipcRenderer.invoke('screenshot:list'),
  deleteScreenshot: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('screenshot:delete', filePath),
  getLatestScreenshot: (): Promise<string | null> =>
    ipcRenderer.invoke('screenshot:getLatest'),

  // GUI Testing
  runGuiTest: (scenarioId: string): Promise<unknown> =>
    ipcRenderer.invoke('gui-test:run', scenarioId),
  createGuiTest: (scenario: { name: string; description: string; application?: string; steps: unknown[] }): Promise<unknown> =>
    ipcRenderer.invoke('gui-test:create', scenario),
  getGuiTest: (id: string): Promise<unknown> =>
    ipcRenderer.invoke('gui-test:get', id),
  updateGuiTest: (id: string, updates: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('gui-test:update', id, updates),
  deleteGuiTest: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('gui-test:delete', id),
  listGuiTests: (): Promise<unknown[]> =>
    ipcRenderer.invoke('gui-test:list'),
  getGuiTestResults: (scenarioId: string, limit?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('gui-test:results', scenarioId, limit),
  generateGuiTest: (description: string, appName?: string): Promise<unknown> =>
    ipcRenderer.invoke('gui-test:generate', description, appName),
  runGuiTestWithConfig: (scenarioId: string, config?: {
    mode?: 'mcp-direct' | 'claude-assisted' | 'hybrid';
    mcpServerName?: string;
    takeScreenshotsAfterSteps?: boolean;
    stopOnFirstFailure?: boolean;
    stepTimeout?: number;
  }): Promise<unknown> =>
    ipcRenderer.invoke('gui-test:runWithConfig', scenarioId, config),

  // MCP Server Management
  getMcpConfigs: (): Promise<MCPServerConfig[]> =>
    ipcRenderer.invoke('mcp:getConfigs'),
  getMcpDefaultConfigs: (): Promise<MCPServerConfig[]> =>
    ipcRenderer.invoke('mcp:getDefaultConfigs'),
  addMcpConfig: (config: MCPServerConfig): Promise<MCPServerConfig[]> =>
    ipcRenderer.invoke('mcp:addConfig', config),
  removeMcpConfig: (name: string): Promise<MCPServerConfig[]> =>
    ipcRenderer.invoke('mcp:removeConfig', name),
  connectMcpServer: (name: string): Promise<{ connected: boolean; tools: MCPTool[] }> =>
    ipcRenderer.invoke('mcp:connect', name),
  disconnectMcpServer: (name: string): Promise<boolean> =>
    ipcRenderer.invoke('mcp:disconnect', name),
  disconnectAllMcpServers: (): Promise<boolean> =>
    ipcRenderer.invoke('mcp:disconnectAll'),
  getConnectedMcpServers: (): Promise<string[]> =>
    ipcRenderer.invoke('mcp:getConnectedServers'),
  getMcpServerTools: (name: string): Promise<MCPTool[]> =>
    ipcRenderer.invoke('mcp:getServerTools', name),
  callMcpTool: (serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('mcp:callTool', serverName, toolName, args),
  autoConnectMcpServers: (): Promise<string[]> =>
    ipcRenderer.invoke('mcp:autoConnect'),

  // Event listeners
  onUpdateChecking: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update:checking', handler);
    return () => ipcRenderer.removeListener('update:checking', handler);
  },
  onUpdateAvailable: (callback: (data: { version: string; releaseNotes?: string }) => void) => {
    const handler = (_: unknown, data: { version: string; releaseNotes?: string }) => callback(data);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update:not-available', handler);
    return () => ipcRenderer.removeListener('update:not-available', handler);
  },
  onUpdateProgress: (callback: (data: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void) => {
    const handler = (_: unknown, data: { percent: number }) => callback(data);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
  onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
    const handler = (_: unknown, data: { version: string }) => callback(data);
    ipcRenderer.on('update:downloaded', handler);
    return () => ipcRenderer.removeListener('update:downloaded', handler);
  },
  onUpdateError: (callback: (data: { error: string }) => void) => {
    const handler = (_: unknown, data: { error: string }) => callback(data);
    ipcRenderer.on('update:error', handler);
    return () => ipcRenderer.removeListener('update:error', handler);
  },
  onModeChanged: (callback: (mode: 'windows' | 'wsl') => void) => {
    const handler = (_: unknown, mode: 'windows' | 'wsl') => callback(mode);
    ipcRenderer.on('mode-changed', handler);
    return () => ipcRenderer.removeListener('mode-changed', handler);
  },

  // Controller event listeners
  onControllerStateChanged: (callback: (state: ControllerState) => void) => {
    const handler = (_: unknown, state: ControllerState) => callback(state);
    ipcRenderer.on('controller:stateChanged', handler);
    return () => ipcRenderer.removeListener('controller:stateChanged', handler);
  },
  onApprovalRequired: (callback: (request: ApprovalRequest) => void) => {
    const handler = (_: unknown, request: ApprovalRequest) => callback(request);
    ipcRenderer.on('controller:approvalRequired', handler);
    return () => ipcRenderer.removeListener('controller:approvalRequired', handler);
  },
  onActionCompleted: (callback: (log: ActionLog) => void) => {
    const handler = (_: unknown, log: ActionLog) => callback(log);
    ipcRenderer.on('controller:actionCompleted', handler);
    return () => ipcRenderer.removeListener('controller:actionCompleted', handler);
  },
  onProgressUpdated: (callback: (progress: ProgressState | null) => void) => {
    const handler = (_: unknown, progress: ProgressState | null) => callback(progress);
    ipcRenderer.on('controller:progressUpdated', handler);
    return () => ipcRenderer.removeListener('controller:progressUpdated', handler);
  },

  onUsageWarning: (callback: (data: { status: UsageLimitStatus; percentage: number }) => void) => {
    const handler = (_: unknown, data: { status: UsageLimitStatus; percentage: number }) => callback(data);
    ipcRenderer.on('controller:usageWarning', handler);
    return () => ipcRenderer.removeListener('controller:usageWarning', handler);
  },

  // GUI Test event listeners
  onGuiTestProgress: (callback: (data: { scenarioId: string; stepIndex: number; totalSteps: number; status: string }) => void) => {
    const handler = (_: unknown, data: { scenarioId: string; stepIndex: number; totalSteps: number; status: string }) => callback(data);
    ipcRenderer.on('gui-test:progress', handler);
    return () => ipcRenderer.removeListener('gui-test:progress', handler);
  },

  onGuiTestComplete: (callback: (result: unknown) => void) => {
    const handler = (_: unknown, result: unknown) => callback(result);
    ipcRenderer.on('gui-test:complete', handler);
    return () => ipcRenderer.removeListener('gui-test:complete', handler);
  },

  // Backwards compatibility: Mayor event listeners
  onMayorStateChanged: (callback: (state: ControllerState) => void) => {
    const handler = (_: unknown, state: ControllerState) => callback(state);
    ipcRenderer.on('controller:stateChanged', handler);
    return () => ipcRenderer.removeListener('controller:stateChanged', handler);
  },

  // ntfy event listeners
  onNtfyQuestionAsked: (callback: (question: PendingQuestion) => void) => {
    const handler = (_: unknown, question: PendingQuestion) => callback(question);
    ipcRenderer.on('ntfy:questionAsked', handler);
    return () => ipcRenderer.removeListener('ntfy:questionAsked', handler);
  },
  onNtfyQuestionAnswered: (callback: (question: PendingQuestion) => void) => {
    const handler = (_: unknown, question: PendingQuestion) => callback(question);
    ipcRenderer.on('ntfy:questionAnswered', handler);
    return () => ipcRenderer.removeListener('ntfy:questionAnswered', handler);
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
      getUpdateStatus: () => Promise<UpdateStatusType>;
      downloadUpdate: () => Promise<void>;
      getDebugInfo: () => Promise<DebugInfo>;
      onUpdateChecking: (callback: () => void) => () => void;
      onUpdateAvailable: (callback: (data: { version: string; releaseNotes?: string }) => void) => () => void;
      onUpdateNotAvailable: (callback: () => void) => () => void;
      onUpdateProgress: (callback: (data: { percent: number }) => void) => () => void;
      onUpdateDownloaded: (callback: (data: { version: string }) => void) => () => void;
      onUpdateError: (callback: (data: { error: string }) => void) => () => void;
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
      setControllerProgress: (phase: string, step: number, totalSteps: number, description: string) => Promise<void>;
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
      // Project Briefs
      generateProjectBrief: (projectId: string, projectPath: string, projectName: string) => Promise<unknown>;
      getProjectBrief: (projectId: string) => Promise<unknown>;
      deleteProjectBrief: (projectId: string) => Promise<boolean>;
      listProjectBriefs: () => Promise<unknown[]>;
      // Deep Dive Plans
      generateDeepDivePlan: (projectId: string, projectPath: string, projectName: string, focus?: string) => Promise<unknown>;
      getDeepDivePlan: (projectId: string) => Promise<unknown>;
      updateDeepDivePlan: (projectId: string, updates: { status?: string; taskUpdates?: Array<{ taskId: string; status: string }> }) => Promise<unknown>;
      deleteDeepDivePlan: (projectId: string) => Promise<boolean>;
      // New Project
      scaffoldNewProject: (targetPath: string, spec: { name: string; description: string; type: string; techStack: string[]; features: string[] }) => Promise<{ success: boolean; error?: string }>;
      // Screenshot capture and analysis
      captureScreen: (options?: CaptureOptions) => Promise<ScreenshotResult>;
      captureActiveWindow: () => Promise<ScreenshotResult>;
      analyzeScreenshot: (screenshotPath: string, prompt: string) => Promise<ScreenAnalysis>;
      verifyUIElement: (description: string, screenshotPath?: string) => Promise<UIVerificationResult>;
      listScreenshots: () => Promise<string[]>;
      deleteScreenshot: (filePath: string) => Promise<boolean>;
      getLatestScreenshot: () => Promise<string | null>;
      // Controller event listeners
      onControllerStateChanged: (callback: (state: ControllerState) => void) => () => void;
      onApprovalRequired: (callback: (request: ApprovalRequest) => void) => () => void;
      onActionCompleted: (callback: (log: ActionLog) => void) => () => void;
      onProgressUpdated: (callback: (progress: ProgressState | null) => void) => () => void;
      onUsageWarning: (callback: (data: { status: UsageLimitStatus; percentage: number }) => void) => () => void;
      // GUI Test event listeners
      onGuiTestProgress: (callback: (data: { scenarioId: string; stepIndex: number; totalSteps: number; status: string }) => void) => () => void;
      onGuiTestComplete: (callback: (result: unknown) => void) => () => void;
      // GUI Testing APIs
      runGuiTest: (scenarioId: string) => Promise<unknown>;
      createGuiTest: (scenario: { name: string; description: string; application?: string; steps: unknown[] }) => Promise<unknown>;
      getGuiTest: (id: string) => Promise<unknown>;
      updateGuiTest: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
      deleteGuiTest: (id: string) => Promise<boolean>;
      listGuiTests: () => Promise<unknown[]>;
      getGuiTestResults: (scenarioId: string, limit?: number) => Promise<unknown[]>;
      generateGuiTest: (description: string, appName?: string) => Promise<unknown>;
      // Backwards compatibility: Mayor event listeners
      onMayorStateChanged: (callback: (state: ControllerState) => void) => () => void;
      // ntfy event listeners
      onNtfyQuestionAsked: (callback: (question: PendingQuestion) => void) => () => void;
      onNtfyQuestionAnswered: (callback: (question: PendingQuestion) => void) => () => void;
    };
  }
}
