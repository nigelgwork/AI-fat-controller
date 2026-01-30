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

// Mayor (AI Project Manager) Types
export type MayorStatus = 'idle' | 'running' | 'paused' | 'waiting_approval';

export interface MayorState {
  status: MayorStatus;
  currentTaskId: string | null;
  currentAction: string | null;
  startedAt: string | null;
  processedCount: number;
  approvedCount: number;
  rejectedCount: number;
  errorCount: number;
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
