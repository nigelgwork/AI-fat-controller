// Bead (Issue) Types
export type BeadStatus = "open" | "in_progress" | "blocked" | "closed" | "ready";
export type BeadType = "bug" | "feature" | "task" | "epic" | "chore";
export type IssueType = "bug" | "feature" | "task" | "epic" | "chore" | "agent" | "convoy" | "molecule" | "gate" | "event" | "role";

export interface Comment {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface Dependency {
  issue_id: string;
  depends_on_id: string;
  type: string;
  created_at: string;
  created_by: string;
}

export interface Bead {
  id: string;
  title: string;
  description?: string;
  status: BeadStatus;
  type?: BeadType;
  issue_type?: IssueType;
  priority?: number;
  assignee?: string;
  labels?: string[];
  blocks?: string[];
  depends_on?: string[];
  dependencies?: Dependency[];
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  comments?: Comment[];
  external_ref?: string;
  molecule_id?: string;
  step_id?: string;
  agent_state?: string;
  last_activity?: string;
}

// Convoy Types
export type ConvoyStatus = "active" | "completed" | "paused" | "failed";

export interface Convoy {
  id: string;
  name: string;
  description?: string;
  status: ConvoyStatus;
  beads: string[];
  progress?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  notify?: boolean;
  human_required?: boolean;
}

// Agent Types
export type AgentRole = "mayor" | "witness" | "refinery" | "polecat" | "crew" | "deacon";
export type AgentStatus = "idle" | "working" | "stuck" | "handoff_requested" | "offline";

export interface Hook {
  agent_id: string;
  work?: string[];
  molecule_id?: string;
  step_id?: string;
}

export interface Agent {
  id: string;
  role: AgentRole;
  rig?: string;
  status: AgentStatus;
  current_task?: string;
  hook?: Hook;
  session_id?: string;
  started_at?: string;
  context_usage?: number;
  last_activity?: string;
}

// Mail Types
export interface Mail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sent_at: string;
  read?: boolean;
  thread_id?: string;
}

// Rig Types
export interface Rig {
  name: string;
  path: string;
  remote?: string;
  beads_count?: number;
  agents_count?: number;
}

// Town Types
export interface Town {
  name: string;
  path: string;
  rigs: Rig[];
  agents: Agent[];
}

// Insights Types
export interface InsightMetric {
  id: string;
  score: number;
}

export interface Insights {
  bottlenecks: InsightMetric[];
  keystones: InsightMetric[];
  hubs: InsightMetric[];
  authorities: InsightMetric[];
  cycles: string[][];
  health: {
    density: number;
    velocity: number;
  };
}

// Molecule & Formula Types
export interface FormulaStep {
  id: string;
  description: string;
  needs?: string[];
}

export interface Formula {
  name: string;
  description: string;
  steps: FormulaStep[];
}

export interface Molecule {
  id: string;
  formula: string;
  status: "active" | "completed" | "paused";
  current_step?: string;
  variables?: Record<string, string>;
  created_at: string;
}

// Dashboard Stats Types
export interface TownStats {
  total_agents: number;
  active_agents: number;
  total_beads: number;
  open_beads: number;
  in_progress_beads: number;
  blocked_beads: number;
  actionable_beads: number;
  active_convoys: number;
  health_percentage: number;
}

// Event Types (for real-time updates)
export type EventType =
  | "bead_created"
  | "bead_updated"
  | "bead_closed"
  | "agent_spawned"
  | "agent_handoff"
  | "agent_stuck"
  | "convoy_milestone"
  | "convoy_completed"
  | "mail_received";

export interface TownEvent {
  type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
  message: string;
}

// Task Types
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

// IPC Types for Electron
export interface ExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export interface ModeStatus {
  windows: { available: boolean; claudePath?: string; version?: string };
  wsl: { available: boolean; distro?: string; version?: string };
}

export type ExecutionMode = 'windows' | 'wsl';
export type DefaultMode = 'windows' | 'wsl' | 'auto';

export interface AppSettings {
  executionMode: ExecutionMode;
  defaultMode: DefaultMode;
  windows: {
    claudePath?: string;
  };
  wsl: {
    distro?: string;
  };
  gastownPath: string;
  theme: 'dark' | 'light' | 'system';
  startMinimized: boolean;
  minimizeToTray: boolean;
  showModeToggle: boolean;
  autoCheckUpdates: boolean;
  updateChannel: 'stable' | 'beta';
  hasCompletedSetup: boolean;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
  };
}

// Controller (Phat Controller - AI Project Manager) Types
export type ControllerStatus = 'idle' | 'running' | 'paused' | 'waiting_approval' | 'waiting_input' | 'winding_down';
export type ControllerPhase = 'planning' | 'executing' | 'reviewing' | 'idle';

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

export type ApprovalActionType = 'planning' | 'architecture' | 'git_push' | 'large_edit';

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

// Conversation Types
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

// Project Brief Types
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

// Screenshot Types
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

// GUI Testing Types
export type TestActionType =
  | 'click'
  | 'type'
  | 'scroll'
  | 'shortcut'
  | 'wait'
  | 'app'
  | 'shell'
  | 'snapshot'
  | 'verify'
  | 'custom';

export interface TestStep {
  id: string;
  action: TestActionType;
  description: string;
  params: Record<string, unknown>;
  assertion?: {
    type: 'contains' | 'visible' | 'not_visible' | 'matches' | 'custom';
    target: string;
    timeout?: number;
  };
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  application?: string;
  steps: TestStep[];
  createdAt: string;
  updatedAt: string;
}

export interface StepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  screenshot?: string;
  output?: string;
  error?: string;
  assertion?: {
    expected: string;
    actual: string;
    passed: boolean;
  };
}

export interface TestResult {
  scenarioId: string;
  scenarioName: string;
  status: 'passed' | 'failed' | 'error';
  startedAt: string;
  completedAt: string;
  duration: number;
  stepResults: StepResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

// MCP Server Types
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

// Test execution configuration
export type TestExecutionMode = 'mcp-direct' | 'claude-assisted' | 'hybrid';

export interface TestExecutionConfig {
  mode: TestExecutionMode;
  mcpServerName?: string;
  takeScreenshotsAfterSteps: boolean;
  stopOnFirstFailure: boolean;
  stepTimeout: number;
}

// Backwards compatibility aliases
export type MayorStatus = ControllerStatus;
export type MayorState = ControllerState;
