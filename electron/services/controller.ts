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
export type ControllerStatus = 'idle' | 'running' | 'paused' | 'waiting_approval' | 'waiting_input' | 'winding_down';
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
  status: 'pending' | 'approved' | 'rejected' | 'timed_out';
  createdAt: string;
  expiresAt?: string; // Optional timeout
}

export interface AutoApprovalRules {
  enabled: boolean;
  allowedActionTypes: ApprovalActionType[];
  maxPendingTimeMinutes: number; // Auto-approve after this time (0 = never)
  requireConfirmationForGitPush: boolean;
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
  autoApprovalRules: AutoApprovalRules;
}

const defaultAutoApprovalRules: AutoApprovalRules = {
  enabled: false,
  allowedActionTypes: ['planning'], // Only auto-approve planning by default
  maxPendingTimeMinutes: 0, // Never auto-approve based on time by default
  requireConfirmationForGitPush: true,
};

// Default context window - will be updated with real value from Claude API
const DEFAULT_CONTEXT_WINDOW = 200000;

const defaultTokenUsage: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  limit: DEFAULT_CONTEXT_WINDOW,
  resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
};

const defaultUsageLimitConfig: UsageLimitConfig = {
  maxTokensPerHour: DEFAULT_CONTEXT_WINDOW,
  maxTokensPerDay: DEFAULT_CONTEXT_WINDOW * 5,
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
  autoApprovalRules: defaultAutoApprovalRules,
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
  safeBroadcast('controller:stateChanged', state);
}

function notifyApprovalRequired(request: ApprovalRequest): void {
  safeBroadcast('controller:approvalRequired', request);
}

function notifyActionCompleted(log: ActionLog): void {
  safeBroadcast('controller:actionCompleted', log);
}

function notifyProgressUpdated(progress: ProgressState | null): void {
  safeBroadcast('controller:progressUpdated', progress);
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
  safeBroadcast('controller:usageWarning', { status, percentage });
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

export function updateTokenUsage(input: number, output: number, contextWindow?: number): void {
  const current = getControllerState();
  const today = getToday();
  const totalTokens = input + output;

  // Update limits if we got real context window from Claude API
  let usageLimitConfig = current.usageLimitConfig;
  if (contextWindow && contextWindow !== usageLimitConfig.maxTokensPerHour) {
    usageLimitConfig = {
      ...usageLimitConfig,
      maxTokensPerHour: contextWindow,
      maxTokensPerDay: contextWindow * 5,
    };
    console.log(`[Controller] Updated token limits from Claude API: ${contextWindow} per hour, ${contextWindow * 5} per day`);
  }

  // Handle hourly reset
  let newUsage: TokenUsage = {
    ...current.tokenUsage,
    inputTokens: current.tokenUsage.inputTokens + input,
    outputTokens: current.tokenUsage.outputTokens + output,
    limit: contextWindow || current.tokenUsage.limit,
  };

  let shouldResetHourly = false;
  if (new Date() > new Date(newUsage.resetAt)) {
    shouldResetHourly = true;
    newUsage = {
      inputTokens: input,
      outputTokens: output,
      limit: contextWindow || usageLimitConfig.maxTokensPerHour,
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

  // Check limits using potentially updated config
  const previousStatus = current.usageLimitStatus;
  const newStatus = checkUsageLimits(hourlyTotal, dailyTotal, usageLimitConfig);

  // Notify if status changed
  if (newStatus !== previousStatus && newStatus !== 'ok') {
    const percentage = Math.max(
      hourlyTotal / usageLimitConfig.maxTokensPerHour,
      dailyTotal / usageLimitConfig.maxTokensPerDay
    ) * 100;
    notifyUsageWarning(newStatus, Math.round(percentage));
  }

  // Graceful wind-down when approaching limit
  // Let current task finish, but don't start new ones until limit resets
  let newControllerStatus = current.status;
  let pausedDueToLimit = current.pausedDueToLimit;

  if (shouldResetHourly && current.status === 'winding_down') {
    // Hourly limit has reset - resume normal operation
    newControllerStatus = 'running';
    pausedDueToLimit = false;
    console.log('[Controller] Token limit reset - resuming normal operation');
  } else if ((newStatus === 'approaching_limit' || newStatus === 'at_limit') && current.status === 'running') {
    // Approaching or at limit - wind down gracefully
    newControllerStatus = 'winding_down';
    pausedDueToLimit = true;
    const resetTime = new Date(newUsage.resetAt);
    const minsUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
    console.log(`[Controller] Approaching token limit - winding down. Will resume in ~${minsUntilReset} minutes`);
  }

  const stateUpdate: Partial<ControllerState> = {
    tokenUsage: newUsage,
    dailyTokenUsage: dailyUsage,
    usageLimitStatus: newStatus,
    pausedDueToLimit,
    usageLimitConfig, // Include updated config with real limits from Claude API
  };

  // Only update status if it changed
  if (newControllerStatus !== current.status) {
    stateUpdate.status = newControllerStatus;
    stateUpdate.currentAction = newControllerStatus === 'winding_down'
      ? 'Winding down - approaching token limit'
      : 'Resuming after token limit reset';
  }

  updateState(stateUpdate);
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

// Auto-approval rules management
export function getAutoApprovalRules(): AutoApprovalRules {
  return getStore().get('autoApprovalRules') || defaultAutoApprovalRules;
}

export function updateAutoApprovalRules(updates: Partial<AutoApprovalRules>): AutoApprovalRules {
  const current = getAutoApprovalRules();
  const updated = { ...current, ...updates };
  getStore().set('autoApprovalRules', updated);
  return updated;
}

/**
 * Check if an action type should be auto-approved based on rules
 */
export function shouldAutoApprove(actionType: ApprovalActionType): boolean {
  const rules = getAutoApprovalRules();

  if (!rules.enabled) return false;
  if (actionType === 'git_push' && rules.requireConfirmationForGitPush) return false;

  return rules.allowedActionTypes.includes(actionType);
}

/**
 * Check and process any timed-out approval requests
 * Should be called periodically
 */
export function processApprovalTimeouts(): void {
  const rules = getAutoApprovalRules();
  const queue = getApprovalQueue();
  const now = new Date();

  for (const request of queue) {
    if (request.status !== 'pending') continue;

    // Check timeout based on expiresAt
    if (request.expiresAt && new Date(request.expiresAt) < now) {
      // Mark as timed out
      updateApprovalRequest(request.id, { status: 'timed_out' });
      addActionLog({
        id: generateId(),
        taskId: request.taskId,
        taskTitle: request.taskTitle,
        actionType: request.actionType,
        description: `Timed out: ${request.description}`,
        autoApproved: false,
        result: 'skipped',
        output: 'Approval request expired',
        duration: 0,
        timestamp: new Date().toISOString(),
      });
      removeApprovalRequest(request.id);
      continue;
    }

    // Check auto-approve based on time if configured
    if (rules.enabled && rules.maxPendingTimeMinutes > 0) {
      const createdAt = new Date(request.createdAt);
      const pendingMinutes = (now.getTime() - createdAt.getTime()) / 60000;

      if (pendingMinutes >= rules.maxPendingTimeMinutes && shouldAutoApprove(request.actionType)) {
        // Auto-approve
        approveRequest(request.id);
        addActionLog({
          id: generateId(),
          taskId: request.taskId,
          taskTitle: request.taskTitle,
          actionType: request.actionType,
          description: `Auto-approved after ${rules.maxPendingTimeMinutes} minutes: ${request.description}`,
          autoApproved: true,
          result: 'success',
          output: 'Auto-approved based on timeout rules',
          duration: 0,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
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

    // Use real token usage from Claude API response
    if (result.tokenUsage) {
      const totalInput = result.tokenUsage.inputTokens +
        (result.tokenUsage.cacheReadInputTokens || 0) +
        (result.tokenUsage.cacheCreationInputTokens || 0);
      updateTokenUsage(totalInput, result.tokenUsage.outputTokens, result.tokenUsage.contextWindow);
    } else {
      // Fallback to estimate if not provided (shouldn't happen with JSON output)
      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      const estimatedOutputTokens = result.response ? Math.ceil(result.response.length / 4) : 0;
      updateTokenUsage(estimatedInputTokens, estimatedOutputTokens);
    }

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

  // Don't pick up new tasks if winding down due to token limit
  if (state.status === 'winding_down') {
    // Check if hourly limit has reset
    if (new Date() > new Date(state.tokenUsage.resetAt)) {
      // Limit has reset - resume normal operation
      updateState({
        status: 'running',
        currentAction: 'Resuming after token limit reset...',
        pausedDueToLimit: false,
      });
      // Continue to pick up next task
    } else {
      // Still in wind-down period, don't start new tasks
      return;
    }
  }

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
    // Keep loop running for both 'running' and 'winding_down' states
    // winding_down needs the loop to check when limit resets
    if (state.status === 'running' || state.status === 'winding_down') {
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
