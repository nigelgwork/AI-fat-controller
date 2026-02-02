import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import { getExecutor } from './executor';
import { listTasks, updateTask, getTaskById } from './tasks';
import type { Task } from './tasks';

// Generate a simple unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Types
export type ControllerStatus = 'idle' | 'running' | 'paused' | 'waiting_approval' | 'waiting_input';
export type ApprovalActionType = 'planning' | 'architecture' | 'git_push' | 'large_edit';
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
  pauseThreshold: number; // 0.8 = pause at 80%
  warningThreshold: number; // 0.6 = warning at 60%
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
  // New fields for Phase 1.3
  currentProgress: ProgressState | null;
  conversationSessionId: string | null;
  tokenUsage: TokenUsage;
  // Phase 5: Usage limit handling
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

interface ControllerStore {
  state: ControllerState;
  approvalQueue: ApprovalRequest[];
  actionLogs: ActionLog[];
}

const defaultTokenUsage: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  limit: 100000,
  resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
};

const defaultUsageLimitConfig: UsageLimitConfig = {
  maxTokensPerHour: 100000,
  maxTokensPerDay: 500000,
  pauseThreshold: 0.8,
  warningThreshold: 0.6,
  autoResumeOnReset: true,
};

const getToday = () => new Date().toISOString().split('T')[0];

const defaultState: ControllerState = {
  status: 'idle',
  currentTaskId: null,
  currentAction: null,
  startedAt: null,
  processedCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  errorCount: 0,
  currentProgress: null,
  conversationSessionId: null,
  tokenUsage: defaultTokenUsage,
  usageLimitConfig: defaultUsageLimitConfig,
  dailyTokenUsage: { input: 0, output: 0, date: getToday() },
  usageLimitStatus: 'ok',
  pausedDueToLimit: false,
};

const defaults: ControllerStore = {
  state: defaultState,
  approvalQueue: [],
  actionLogs: [],
};

let store: Store<ControllerStore>;
let processingInterval: NodeJS.Timeout | null = null;
let currentAbortController: AbortController | null = null;

export function initControllerStore(): void {
  store = new Store<ControllerStore>({
    name: 'controller',
    defaults,
  });

  // Reset state on initialization (don't resume from previous session)
  store.set('state', { ...defaultState });
  store.set('approvalQueue', []);
}

function getStore(): Store<ControllerStore> {
  if (!store) initControllerStore();
  return store;
}

// Notify renderer of state changes
function notifyStateChanged(): void {
  const state = getControllerState();
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('controller:stateChanged', state);
  });
}

function notifyApprovalRequired(request: ApprovalRequest): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('controller:approvalRequired', request);
  });
}

function notifyActionCompleted(log: ActionLog): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('controller:actionCompleted', log);
  });
}

function notifyProgressUpdated(progress: ProgressState | null): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('controller:progressUpdated', progress);
  });
}

// State management
export function getControllerState(): ControllerState {
  return getStore().get('state');
}

function updateState(updates: Partial<ControllerState>): void {
  const current = getControllerState();
  getStore().set('state', { ...current, ...updates });
  notifyStateChanged();
}

// Progress management
export function updateProgress(progress: ProgressState | null): void {
  updateState({ currentProgress: progress });
  notifyProgressUpdated(progress);
}

export function setProgress(phase: ControllerPhase, step: number, totalSteps: number, description: string): void {
  updateProgress({
    phase,
    step,
    totalSteps,
    stepDescription: description,
    startedAt: new Date().toISOString(),
  });
}

export function clearProgress(): void {
  updateProgress(null);
}

// Token usage management
function notifyUsageWarning(status: UsageLimitStatus, percentage: number): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('controller:usageWarning', { status, percentage });
  });
}

function checkUsageLimits(hourlyTotal: number, dailyTotal: number, config: UsageLimitConfig): UsageLimitStatus {
  const hourlyPercentage = hourlyTotal / config.maxTokensPerHour;
  const dailyPercentage = dailyTotal / config.maxTokensPerDay;
  const maxPercentage = Math.max(hourlyPercentage, dailyPercentage);

  if (maxPercentage >= 1) return 'at_limit';
  if (maxPercentage >= config.pauseThreshold) return 'approaching_limit';
  if (maxPercentage >= config.warningThreshold) return 'warning';
  return 'ok';
}

export function updateTokenUsage(input: number, output: number): void {
  const current = getControllerState();
  const today = getToday();
  const totalTokens = input + output;

  // Handle hourly reset
  let newUsage: TokenUsage = {
    ...current.tokenUsage,
    inputTokens: current.tokenUsage.inputTokens + input,
    outputTokens: current.tokenUsage.outputTokens + output,
  };

  let shouldResetHourly = false;
  if (new Date() > new Date(newUsage.resetAt)) {
    shouldResetHourly = true;
    newUsage = {
      inputTokens: input,
      outputTokens: output,
      limit: current.usageLimitConfig.maxTokensPerHour,
      resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  // Handle daily reset
  let dailyUsage = current.dailyTokenUsage;
  if (dailyUsage.date !== today) {
    // New day - reset daily usage
    dailyUsage = { input, output, date: today };
  } else {
    dailyUsage = {
      input: dailyUsage.input + input,
      output: dailyUsage.output + output,
      date: today,
    };
  }

  const hourlyTotal = newUsage.inputTokens + newUsage.outputTokens;
  const dailyTotal = dailyUsage.input + dailyUsage.output;

  // Check limits
  const previousStatus = current.usageLimitStatus;
  const newStatus = checkUsageLimits(hourlyTotal, dailyTotal, current.usageLimitConfig);

  // Notify if status changed
  if (newStatus !== previousStatus && newStatus !== 'ok') {
    const percentage = Math.max(
      hourlyTotal / current.usageLimitConfig.maxTokensPerHour,
      dailyTotal / current.usageLimitConfig.maxTokensPerDay
    ) * 100;
    notifyUsageWarning(newStatus, Math.round(percentage));
  }

  // Token usage is monitored only - no auto-pause
  // Claude Code itself provides warnings when approaching API limits
  updateState({
    tokenUsage: newUsage,
    dailyTokenUsage: dailyUsage,
    usageLimitStatus: newStatus,
    pausedDueToLimit: false,  // Never pause due to limit - just monitor
  });
}

export function resetTokenUsage(): void {
  updateState({
    tokenUsage: {
      ...defaultTokenUsage,
      resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    dailyTokenUsage: { input: 0, output: 0, date: getToday() },
    usageLimitStatus: 'ok',
    pausedDueToLimit: false,
  });
}

export function updateUsageLimitConfig(config: Partial<UsageLimitConfig>): void {
  const current = getControllerState();
  const newConfig = { ...current.usageLimitConfig, ...config };
  updateState({ usageLimitConfig: newConfig });

  // Recheck limits with new config
  const hourlyTotal = current.tokenUsage.inputTokens + current.tokenUsage.outputTokens;
  const dailyTotal = current.dailyTokenUsage.input + current.dailyTokenUsage.output;
  const newStatus = checkUsageLimits(hourlyTotal, dailyTotal, newConfig);
  updateState({ usageLimitStatus: newStatus });
}

export function getUsageLimitConfig(): UsageLimitConfig {
  return getControllerState().usageLimitConfig;
}

export function getUsagePercentages(): { hourly: number; daily: number } {
  const state = getControllerState();
  const hourlyTotal = state.tokenUsage.inputTokens + state.tokenUsage.outputTokens;
  const dailyTotal = state.dailyTokenUsage.input + state.dailyTokenUsage.output;

  return {
    hourly: Math.round((hourlyTotal / state.usageLimitConfig.maxTokensPerHour) * 100),
    daily: Math.round((dailyTotal / state.usageLimitConfig.maxTokensPerDay) * 100),
  };
}

// Conversation session management
export function setConversationSession(sessionId: string | null): void {
  updateState({ conversationSessionId: sessionId });
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

  setProgress('executing', 1, 3, 'Analyzing task...');

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

    const systemPrompt = `You are the Phat Controller, an autonomous AI project manager. You process tasks and execute actions when appropriate. For simple tasks (running tests, formatting, small edits), execute them directly. For complex tasks requiring planning or architecture decisions, provide a detailed plan first.`;

    setProgress('executing', 2, 3, 'Executing with Claude...');

    const result = await executor.runClaude(prompt, systemPrompt);

    const duration = Date.now() - startTime;

    // Estimate token usage (rough estimate if not provided)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = result.response ? Math.ceil(result.response.length / 4) : 0;
    updateTokenUsage(estimatedInputTokens, estimatedOutputTokens);

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
        errorCount: getControllerState().errorCount + 1,
      });

      clearProgress();
      return;
    }

    setProgress('reviewing', 3, 3, 'Reviewing results...');

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

      clearProgress();

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
      processedCount: getControllerState().processedCount + 1,
      approvedCount: getControllerState().approvedCount + 1,
    });

    // Mark task as done if it was a simple action
    updateTask(task.id, { status: 'done' });

    clearProgress();

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
      errorCount: getControllerState().errorCount + 1,
    });

    clearProgress();
  }
}

// Main processing loop
async function processNextTask(): Promise<void> {
  const state = getControllerState();

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
    const state = getControllerState();
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
export async function activateController(): Promise<void> {
  const state = getControllerState();
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

export async function deactivateController(): Promise<void> {
  stopProcessingLoop();

  updateState({
    status: 'idle',
    currentTaskId: null,
    currentAction: null,
    currentProgress: null,
  });

  // Clear pending approvals
  getStore().set('approvalQueue', []);
}

export async function pauseController(): Promise<void> {
  const state = getControllerState();
  if (state.status !== 'running' && state.status !== 'waiting_approval') {
    return;
  }

  stopProcessingLoop();

  updateState({
    status: 'paused',
    currentAction: 'Paused',
  });
}

export async function resumeController(): Promise<void> {
  const state = getControllerState();
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

  const state = getControllerState();

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

  const state = getControllerState();

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

// Backwards compatibility exports (for gradual migration)
export {
  initControllerStore as initMayorStore,
  getControllerState as getMayorState,
  activateController as activateMayor,
  deactivateController as deactivateMayor,
  pauseController as pauseMayor,
  resumeController as resumeMayor,
};
