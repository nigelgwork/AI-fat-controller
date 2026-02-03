import Store from 'electron-store';
import { getExecutor } from './executor';
import { listTasks, updateTask, getTaskById } from './tasks';
import type { Task } from './tasks';
import { safeBroadcast } from '../utils/safe-ipc';

// Generate a simple unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Types
export type MayorStatus = 'idle' | 'running' | 'paused' | 'waiting_approval';
export type ApprovalActionType = 'planning' | 'architecture' | 'git_push' | 'large_edit';

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

interface MayorStore {
  state: MayorState;
  approvalQueue: ApprovalRequest[];
  actionLogs: ActionLog[];
}

const defaultState: MayorState = {
  status: 'idle',
  currentTaskId: null,
  currentAction: null,
  startedAt: null,
  processedCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  errorCount: 0,
};

const defaults: MayorStore = {
  state: defaultState,
  approvalQueue: [],
  actionLogs: [],
};

let store: Store<MayorStore>;
let processingInterval: NodeJS.Timeout | null = null;
let currentAbortController: AbortController | null = null;

export function initMayorStore(): void {
  store = new Store<MayorStore>({
    name: 'mayor',
    defaults,
  });

  // Reset state on initialization (don't resume from previous session)
  store.set('state', { ...defaultState });
  store.set('approvalQueue', []);
}

function getStore(): Store<MayorStore> {
  if (!store) initMayorStore();
  return store;
}

// Notify renderer of state changes
function notifyStateChanged(): void {
  const state = getMayorState();
  safeBroadcast('mayor:stateChanged', state);
}

function notifyApprovalRequired(request: ApprovalRequest): void {
  safeBroadcast('mayor:approvalRequired', request);
}

function notifyActionCompleted(log: ActionLog): void {
  safeBroadcast('mayor:actionCompleted', log);
}

// State management
export function getMayorState(): MayorState {
  return getStore().get('state');
}

function updateState(updates: Partial<MayorState>): void {
  const current = getMayorState();
  getStore().set('state', { ...current, ...updates });
  notifyStateChanged();
}

// Approval queue management
export function getApprovalQueue(): ApprovalRequest[] {
  return getStore().get('approvalQueue') || [];
}

function addApprovalRequest(request: ApprovalRequest): void {
  const queue = getApprovalQueue();
  queue.push(request);
  getStore().set('approvalQueue', queue);
  notifyApprovalRequired(request);
}

function removeApprovalRequest(id: string): void {
  const queue = getApprovalQueue();
  const filtered = queue.filter(r => r.id !== id);
  getStore().set('approvalQueue', filtered);
}

function updateApprovalRequest(id: string, updates: Partial<ApprovalRequest>): ApprovalRequest | null {
  const queue = getApprovalQueue();
  const index = queue.findIndex(r => r.id === id);
  if (index === -1) return null;

  queue[index] = { ...queue[index], ...updates };
  getStore().set('approvalQueue', queue);
  return queue[index];
}

// Action logging
export function getActionLogs(limit?: number): ActionLog[] {
  const logs = getStore().get('actionLogs') || [];
  // Return most recent first
  const sorted = [...logs].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return limit ? sorted.slice(0, limit) : sorted;
}

function addActionLog(log: ActionLog): void {
  const logs = getStore().get('actionLogs') || [];
  logs.push(log);
  // Keep only last 1000 logs
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }
  getStore().set('actionLogs', logs);
  notifyActionCompleted(log);
}

// Action classification
interface ActionClassification {
  type: string;
  requiresApproval: boolean;
  approvalType?: ApprovalActionType;
  description: string;
}

function classifyAction(claudeResponse: string, task: Task): ActionClassification {
  const response = claudeResponse.toLowerCase();

  // Check for planning/architecture keywords
  const planningKeywords = ['plan', 'design', 'architect', 'structure', 'approach', 'strategy', 'implementation plan'];
  for (const keyword of planningKeywords) {
    if (response.includes(keyword)) {
      return {
        type: 'planning',
        requiresApproval: true,
        approvalType: 'planning',
        description: `Planning/architecture decision for "${task.title}"`,
      };
    }
  }

  // Check for git push
  if (response.includes('git push') || response.includes('push to remote') || response.includes('push to origin')) {
    return {
      type: 'git_push',
      requiresApproval: true,
      approvalType: 'git_push',
      description: `Git push requested for "${task.title}"`,
    };
  }

  // Check for large file edits (heuristic: mentions editing multiple files or significant changes)
  const largeEditIndicators = ['multiple files', 'refactor', 'rewrite', 'major changes', 'restructure'];
  for (const indicator of largeEditIndicators) {
    if (response.includes(indicator)) {
      return {
        type: 'large_edit',
        requiresApproval: true,
        approvalType: 'large_edit',
        description: `Large-scale edit for "${task.title}"`,
      };
    }
  }

  // Auto-approve patterns
  const autoApprovePatterns = [
    { pattern: /npm test|pnpm test|yarn test|vitest|jest|pytest/, type: 'test' },
    { pattern: /prettier|eslint|lint|format/, type: 'formatting' },
    { pattern: /git commit|git add|git branch/, type: 'git_local' },
    { pattern: /npm install|pnpm install|yarn add/, type: 'install' },
  ];

  for (const { pattern, type } of autoApprovePatterns) {
    if (pattern.test(response)) {
      return {
        type,
        requiresApproval: false,
        description: `Auto-approved ${type} action`,
      };
    }
  }

  // Default: small edit, auto-approve
  return {
    type: 'edit',
    requiresApproval: false,
    description: `Code edit for "${task.title}"`,
  };
}

// Process a single task
async function processTask(task: Task): Promise<void> {
  const startTime = Date.now();

  updateState({
    currentTaskId: task.id,
    currentAction: `Processing: ${task.title}`,
  });

  // Update task to in_progress
  updateTask(task.id, { status: 'in_progress' });

  try {
    const executor = await getExecutor();

    // Build the prompt
    let prompt = `Task: ${task.title}`;
    if (task.description) {
      prompt += `\n\nDescription: ${task.description}`;
    }
    prompt += '\n\nPlease analyze this task and either provide a plan for implementation or execute any straightforward actions.';

    const systemPrompt = `You are the AI Controller Mayor, an autonomous project manager. You process tasks and execute actions when appropriate. For simple tasks (running tests, formatting, small edits), execute them directly. For complex tasks requiring planning or architecture decisions, provide a detailed plan first.`;

    const result = await executor.runClaude(prompt, systemPrompt);

    const duration = Date.now() - startTime;

    if (!result.success) {
      // Task failed
      addActionLog({
        id: generateId(),
        taskId: task.id,
        taskTitle: task.title,
        actionType: 'error',
        description: 'Task execution failed',
        autoApproved: true,
        result: 'failure',
        output: result.error,
        duration,
        timestamp: new Date().toISOString(),
      });

      updateState({
        errorCount: getMayorState().errorCount + 1,
      });
      return;
    }

    const response = result.response || '';
    const classification = classifyAction(response, task);

    if (classification.requiresApproval) {
      // Create approval request
      const request: ApprovalRequest = {
        id: generateId(),
        taskId: task.id,
        taskTitle: task.title,
        actionType: classification.approvalType!,
        description: classification.description,
        details: response,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      addApprovalRequest(request);

      updateState({
        status: 'waiting_approval',
        currentAction: `Waiting approval: ${classification.description}`,
      });

      // Stop processing until approved/rejected
      return;
    }

    // Auto-approved action
    addActionLog({
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      actionType: classification.type,
      description: classification.description,
      autoApproved: true,
      result: 'success',
      output: response.substring(0, 500), // Truncate output
      duration,
      timestamp: new Date().toISOString(),
    });

    updateState({
      processedCount: getMayorState().processedCount + 1,
      approvedCount: getMayorState().approvedCount + 1,
    });

    // Mark task as done if it was a simple action
    updateTask(task.id, { status: 'done' });

  } catch (error) {
    const duration = Date.now() - startTime;

    addActionLog({
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      actionType: 'error',
      description: 'Task execution error',
      autoApproved: true,
      result: 'failure',
      output: error instanceof Error ? error.message : String(error),
      duration,
      timestamp: new Date().toISOString(),
    });

    updateState({
      errorCount: getMayorState().errorCount + 1,
    });
  }
}

// Main processing loop
async function processNextTask(): Promise<void> {
  const state = getMayorState();

  if (state.status !== 'running') {
    return;
  }

  // Find next todo task
  const tasks = listTasks();
  const todoTask = tasks.find(t => t.status === 'todo');

  if (!todoTask) {
    updateState({
      currentTaskId: null,
      currentAction: 'No tasks in queue',
    });
    return;
  }

  await processTask(todoTask);
}

// Start processing loop
function startProcessingLoop(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
  }

  // Process immediately, then every 5 seconds
  processNextTask();
  processingInterval = setInterval(() => {
    const state = getMayorState();
    if (state.status === 'running') {
      processNextTask();
    }
  }, 5000);
}

function stopProcessingLoop(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }

  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

// Public API
export async function activateMayor(): Promise<void> {
  const state = getMayorState();
  if (state.status !== 'idle') {
    return; // Already active
  }

  updateState({
    status: 'running',
    startedAt: new Date().toISOString(),
    currentAction: 'Starting up...',
  });

  startProcessingLoop();
}

export async function deactivateMayor(): Promise<void> {
  stopProcessingLoop();

  updateState({
    status: 'idle',
    currentTaskId: null,
    currentAction: null,
  });

  // Clear pending approvals
  getStore().set('approvalQueue', []);
}

export async function pauseMayor(): Promise<void> {
  const state = getMayorState();
  if (state.status !== 'running' && state.status !== 'waiting_approval') {
    return;
  }

  stopProcessingLoop();

  updateState({
    status: 'paused',
    currentAction: 'Paused',
  });
}

export async function resumeMayor(): Promise<void> {
  const state = getMayorState();
  if (state.status !== 'paused') {
    return;
  }

  updateState({
    status: 'running',
    currentAction: 'Resuming...',
  });

  startProcessingLoop();
}

export async function approveRequest(id: string): Promise<void> {
  const request = updateApprovalRequest(id, { status: 'approved' });
  if (!request) return;

  const state = getMayorState();

  // Log the approval
  addActionLog({
    id: generateId(),
    taskId: request.taskId,
    taskTitle: request.taskTitle,
    actionType: request.actionType,
    description: `Approved: ${request.description}`,
    autoApproved: false,
    result: 'success',
    output: request.details.substring(0, 500),
    duration: 0,
    timestamp: new Date().toISOString(),
  });

  updateState({
    approvedCount: state.approvedCount + 1,
    processedCount: state.processedCount + 1,
  });

  // Remove from queue
  removeApprovalRequest(id);

  // Mark task as done
  updateTask(request.taskId, { status: 'done' });

  // Resume if was waiting for approval
  if (state.status === 'waiting_approval') {
    updateState({
      status: 'running',
      currentAction: 'Continuing...',
    });
    startProcessingLoop();
  }
}

export async function rejectRequest(id: string, reason?: string): Promise<void> {
  const request = updateApprovalRequest(id, { status: 'rejected' });
  if (!request) return;

  const state = getMayorState();

  // Log the rejection
  addActionLog({
    id: generateId(),
    taskId: request.taskId,
    taskTitle: request.taskTitle,
    actionType: request.actionType,
    description: `Rejected: ${request.description}${reason ? ` - ${reason}` : ''}`,
    autoApproved: false,
    result: 'skipped',
    output: reason,
    duration: 0,
    timestamp: new Date().toISOString(),
  });

  updateState({
    rejectedCount: state.rejectedCount + 1,
    processedCount: state.processedCount + 1,
  });

  // Remove from queue
  removeApprovalRequest(id);

  // Resume if was waiting for approval
  if (state.status === 'waiting_approval') {
    updateState({
      status: 'running',
      currentAction: 'Continuing...',
    });
    startProcessingLoop();
  }
}
