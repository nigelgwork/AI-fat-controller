// Shared type definitions between frontend and server

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

// Git clone types
export interface CloneOptions {
  repoUrl: string;
  targetDir?: string;
  branch?: string;
  runSetup?: boolean;
}

export interface SetupCommand {
  command: string;
  args: string[];
  description: string;
  packageManager: string;
}

export interface CloneResult {
  success: boolean;
  projectPath?: string;
  projectId?: string;
  error?: string;
  detectedSetup?: SetupCommand[];
}

export interface SetupResult {
  success: boolean;
  completedCommands: string[];
  failedCommands: { command: string; error: string }[];
}

export interface CloneProgress {
  stage: 'cloning' | 'detecting' | 'setup' | 'complete' | 'error';
  message: string;
  percentage?: number;
}

export interface AddProjectFromGitResult {
  success: boolean;
  project?: Project;
  cloneResult: CloneResult;
  error?: string;
}

export interface RepoInfo {
  name: string;
  defaultBranch?: string;
  size?: string;
  error?: string;
}

// Claude Code Session types (from ~/.claude/projects/)
export interface ClaudeCodeSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  sessionFilePath: string;
  createdAt: string;
  lastModifiedAt: string;
  messageCount: number;
  lastMessagePreview?: string;
}

// Session options for resuming
export interface SessionOptions {
  resumeSessionId?: string;
  continueSession?: boolean;
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
  isDocker: boolean;
  nodeVersion: string;
  platform: string;
  claudePath: string;
  executionMode: 'linux';
}

// Task types
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'failed' | 'blocked';
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
  // Retry handling
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  // Dependencies
  blockedBy?: string[];
  // Scheduling
  scheduledAt?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  projectName?: string;
  maxRetries?: number;
  blockedBy?: string[];
  scheduledAt?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  projectName?: string;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
  nextRetryAt?: string;
  blockedBy?: string[];
  scheduledAt?: string;
}

export interface TasksStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  failed: number;
  blocked: number;
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
  logFilePath: string;
  theme: 'dark' | 'light' | 'system';
  hasCompletedSetup: boolean;
}

// Controller (Phat Controller) types
export type ControllerStatus = 'idle' | 'running' | 'paused' | 'waiting_approval' | 'waiting_input' | 'winding_down';
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

// Execution session types
export interface ExecutionSession {
  id: string;
  taskId: string;
  taskTitle: string;
  status: 'starting' | 'running' | 'waiting_input' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  logs: SessionLogEntry[];
  lastActivity: string;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  error?: string;
  result?: string;
}

export interface SessionLogEntry {
  timestamp: string;
  type: 'text' | 'tool-call' | 'tool-result' | 'error' | 'info' | 'complete';
  content: string;
  details?: Record<string, unknown>;
}

// Summary version for IPC (without full logs)
export interface ExecutionSessionSummary {
  id: string;
  taskId: string;
  taskTitle: string;
  status: ExecutionSession['status'];
  startedAt: string;
  endedAt?: string;
  lastActivity: string;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  error?: string;
  logCount: number;
}

// ntfy notification types
export interface StatusReporterConfig {
  enabled: boolean;
  intervalMinutes: number;
  dailySummaryTime?: string;
  notifyOnTaskStart: boolean;
  notifyOnTaskComplete: boolean;
  notifyOnTaskFail: boolean;
  notifyOnApprovalNeeded: boolean;
  notifyOnTokenWarning: boolean;
}

export interface NtfyConfig {
  enabled: boolean;
  serverUrl: string;
  topic: string;
  responseTopic?: string;
  priority: 'min' | 'low' | 'default' | 'high' | 'urgent';
  authToken?: string;
  enableDesktopNotifications: boolean;
  // Commands
  commandsEnabled: boolean;
  allowedCommands?: string[];
  // Automation
  autoStartOnTask: boolean;
  // Status reporting
  statusReporter: StatusReporterConfig;
}

// ntfy command types
export interface NtfyCommandResult {
  success: boolean;
  response: string;
  data?: Record<string, unknown>;
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
export type ActivityCategory = 'execution' | 'user_action' | 'system' | 'error' | 'project';

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

// Project Brief types
export interface ProjectBrief {
  id: string;
  projectId: string;
  projectPath: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  techStack: string[];
  keyFiles: Array<{ path: string; purpose: string }>;
  architecture: string;
  recentChanges: Array<{ date: string; summary: string; hash: string }>;
  activeWork: string[];
  suggestedTasks: Array<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }>;
  codeMetrics?: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };
}

export interface DeepDiveTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  estimatedComplexity: 'low' | 'medium' | 'high';
  executionOutput?: string;
  executionError?: string;
  executedAt?: string;
}

export interface DeepDivePlan {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  status: 'draft' | 'approved' | 'in_progress' | 'completed';
  phases: Array<{
    id: string;
    name: string;
    description: string;
    tasks: DeepDiveTask[];
  }>;
  totalTasks: number;
  completedTasks: number;
}

export interface NewProjectSpec {
  name: string;
  description: string;
  type: 'web' | 'cli' | 'library' | 'api' | 'desktop' | 'mobile' | 'other';
  techStack: string[];
  features: string[];
  structure?: Record<string, string>;
}
