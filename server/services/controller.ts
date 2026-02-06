/**
 * Controller Service - Adapted from electron/services/controller.ts AND electron/services/mayor.ts
 * This is the most complex service, combining both controller and mayor functionality.
 *
 * Replaces:
 * - electron-store -> ../db/repositories/controller-repo (state, approval queue, action logs, rules)
 * - safeBroadcast -> broadcast from ../websocket
 * - Notification (Electron) -> console.log
 * - app.isPackaged -> process.env.NODE_ENV === 'production'
 *
 * Keeps ALL business logic: token limits, approval queue, processing loop, action classification,
 * retry scheduling, wind-down behavior, auto-approval rules, progress tracking.
 */

import { getExecutor } from './executor';
import { listTasks, updateTask, getTaskById, getNextExecutableTask, scheduleRetry, getTasksStats } from './tasks';
import type { Task } from './tasks';
import { broadcast } from '../websocket';
import * as controllerRepo from '../db/repositories/controller-repo';
import * as tokenHistoryRepo from '../db/repositories/token-history-repo';
import * as ntfyRepo from '../db/repositories/ntfy-repo';
import { createLogger } from '../utils/logger';
import {
  createSession,
  updateSessionStatus,
  addSessionLog,
  updateSessionTokens,
  getActiveSessions,
  cancelSession,
} from './session-manager';

const log = createLogger('Controller');

// Generate a simple unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Re-export types from repo for consumers
export type {
  ControllerStatus,
  ApprovalActionType,
  ControllerPhase,
  ProgressState,
  TokenUsage,
  UsageLimitConfig,
  UsageLimitStatus,
  ControllerState,
  ApprovalRequest,
  ActionLog,
  AutoApprovalRules,
} from '../db/repositories/controller-repo';

import type {
  ControllerStatus,
  ApprovalActionType,
  ControllerPhase,
  ProgressState,
  TokenUsage,
  UsageLimitConfig,
  UsageLimitStatus,
  ControllerState,
  ApprovalRequest,
  ActionLog,
  AutoApprovalRules,
} from '../db/repositories/controller-repo';

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

let processingInterval: NodeJS.Timeout | null = null;
let currentAbortController: AbortController | null = null;

// ============================================
// Initialization
// ============================================

export function initControllerStore(): void {
  // Reset state on initialization (don't resume from previous session)
  controllerRepo.resetState();
  controllerRepo.clearApprovalQueue();
}

// ============================================
// Notification helpers (replace safeBroadcast)
// ============================================

function notifyStateChanged(): void {
  const state = getControllerState();
  broadcast('controller:stateChanged', state);
}

function notifyApprovalRequired(request: ApprovalRequest): void {
  broadcast('controller:approvalRequired', request);

  // Replace Electron Notification with console.log
  console.log(`[Approval Required] ${request.actionType.replace('_', ' ')}: ${request.taskTitle}`);
}

function notifyActionCompleted(actionLog: ActionLog): void {
  broadcast('controller:actionCompleted', actionLog);
}

function notifyProgressUpdated(progress: ProgressState | null): void {
  broadcast('controller:progressUpdated', progress);
}

function notifyUsageWarning(status: UsageLimitStatus, percentage: number): void {
  broadcast('controller:usageWarning', { status, percentage });
}

// ============================================
// State management
// ============================================

export function getControllerState(): ControllerState {
  return controllerRepo.getState();
}

function updateState(updates: Partial<ControllerState>): void {
  controllerRepo.updateState(updates);
  notifyStateChanged();
}

// ============================================
// Progress management
// ============================================

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

// ============================================
// Token usage management
// ============================================

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

  // Update limits if we got real context window from Claude API
  let usageLimitConfig = current.usageLimitConfig;
  if (contextWindow && contextWindow !== usageLimitConfig.maxTokensPerHour) {
    usageLimitConfig = {
      ...usageLimitConfig,
      maxTokensPerHour: contextWindow,
      maxTokensPerDay: contextWindow * 5,
    };
    log.info(`[Controller] Updated token limits from Claude API: ${contextWindow} per hour, ${contextWindow * 5} per day`);
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
    // Record historical data before reset
    tokenHistoryRepo.recordHourly(current.tokenUsage.inputTokens, current.tokenUsage.outputTokens);
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
  let newControllerStatus = current.status;
  let pausedDueToLimit = current.pausedDueToLimit;

  if (shouldResetHourly && current.status === 'winding_down') {
    // Hourly limit has reset - resume normal operation
    newControllerStatus = 'running';
    pausedDueToLimit = false;
    log.info('[Controller] Token limit reset - resuming normal operation');
  } else if ((newStatus === 'approaching_limit' || newStatus === 'at_limit') && current.status === 'running') {
    // Approaching or at limit - wind down gracefully
    newControllerStatus = 'winding_down';
    pausedDueToLimit = true;
    const resetTime = new Date(newUsage.resetAt);
    const minsUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
    log.info(`[Controller] Approaching token limit - winding down. Will resume in ~${minsUntilReset} minutes`);
  }

  const stateUpdate: Partial<ControllerState> = {
    tokenUsage: newUsage,
    dailyTokenUsage: dailyUsage,
    usageLimitStatus: newStatus,
    pausedDueToLimit,
    usageLimitConfig,
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

// ============================================
// Conversation session management
// ============================================

export function setConversationSession(sessionId: string | null): void {
  updateState({ conversationSessionId: sessionId });
}

// ============================================
// Approval queue management
// ============================================

export function getApprovalQueue(): ApprovalRequest[] {
  return controllerRepo.getApprovalQueue();
}

function addApprovalRequest(request: ApprovalRequest): void {
  controllerRepo.addApprovalRequest(request);
  notifyApprovalRequired(request);
}

function removeApprovalRequest(id: string): void {
  controllerRepo.removeApprovalRequest(id);
}

function updateApprovalRequestStatus(id: string, updates: Partial<ApprovalRequest>): ApprovalRequest | null {
  return controllerRepo.updateApprovalRequest(id, updates);
}

// ============================================
// Auto-approval rules management
// ============================================

export function getAutoApprovalRules(): AutoApprovalRules {
  return controllerRepo.getAutoApprovalRules();
}

export function updateAutoApprovalRules(updates: Partial<AutoApprovalRules>): AutoApprovalRules {
  return controllerRepo.updateAutoApprovalRules(updates);
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
      updateApprovalRequestStatus(request.id, { status: 'timed_out' });
      addActionLogEntry({
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
        addActionLogEntry({
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

// ============================================
// Action logging
// ============================================

export function getActionLogs(limit?: number): ActionLog[] {
  return controllerRepo.getActionLogs(limit);
}

function addActionLogEntry(actionLog: ActionLog): void {
  controllerRepo.addActionLog(actionLog);
  notifyActionCompleted(actionLog);
}

// ============================================
// Action classification
// ============================================

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

// ============================================
// Ntfy notification helper
// ============================================

/**
 * Send notification via ntfy if configured.
 * This is a simplified version - the full ntfy service would be a separate adapted module.
 */
async function sendNtfyNotification(
  title: string,
  message: string,
  options?: { priority?: string; tags?: string[]; actions?: unknown[] }
): Promise<void> {
  const config = ntfyRepo.getConfig();
  if (!config.enabled || !config.topic) return;

  try {
    const headers: Record<string, string> = {
      'Title': title,
    };

    if (options?.priority) {
      headers['Priority'] = options.priority;
    }
    if (options?.tags) {
      headers['Tags'] = options.tags.join(',');
    }
    if (options?.actions) {
      headers['Actions'] = JSON.stringify(options.actions);
    }
    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    await fetch(`${config.serverUrl}/${config.topic}`, {
      method: 'POST',
      headers,
      body: message,
    });
  } catch (err) {
    log.error('[Controller] Failed to send ntfy notification:', err);
  }
}

// ============================================
// Process a single task
// ============================================

async function processTask(task: Task): Promise<void> {
  const startTime = Date.now();
  const sessionId = `session-${task.id}-${Date.now()}`;

  // Create a visible session for this execution
  const session = createSession(sessionId, task.id, task.title);
  addSessionLog(sessionId, 'info', `Starting task: ${task.title}`);

  updateState({
    currentTaskId: task.id,
    currentAction: `Processing: ${task.title}`,
    conversationSessionId: sessionId,
  });

  setProgress('executing', 1, 3, 'Analyzing task...');

  // Update task to in_progress
  updateTask(task.id, { status: 'in_progress' });
  updateSessionStatus(sessionId, 'running');

  try {
    const executor = await getExecutor();

    // Build a more actionable prompt
    let prompt = `## Task: ${task.title}`;
    if (task.description) {
      prompt += `\n\n## Description:\n${task.description}`;
    }
    prompt += `\n\n## Instructions:\nPlease complete this task. You have full permissions to:
- Read and write files
- Run commands
- Make git commits (but ask before pushing)

If this is a coding task, actually implement the changes. If you need more information, explain what you need.
When you're done, summarize what you accomplished.`;

    const systemPrompt = `You are the Phat Controller, an autonomous AI agent that completes software engineering tasks.

IMPORTANT: You should ACTUALLY DO THE WORK, not just describe what needs to be done.

For coding tasks:
- Read the relevant files first
- Make the necessary code changes
- Run tests if available
- Create git commits for your changes

For research tasks:
- Search and read the codebase
- Provide clear findings

For complex tasks:
- Break them down into steps
- Execute each step
- Report progress

Always be thorough and actually complete the task.`;

    setProgress('executing', 2, 3, 'Executing with Claude...');
    addSessionLog(sessionId, 'info', 'Sending task to Claude Code...');

    // Pass session ID so executor events can be tracked
    const result = await executor.runClaude(prompt, systemPrompt, undefined, undefined, sessionId);

    const duration = Date.now() - startTime;

    // Use real token usage from Claude API response
    if (result.tokenUsage) {
      const totalInput = result.tokenUsage.inputTokens +
        (result.tokenUsage.cacheReadInputTokens || 0) +
        (result.tokenUsage.cacheCreationInputTokens || 0);
      updateTokenUsage(totalInput, result.tokenUsage.outputTokens, result.tokenUsage.contextWindow);
    } else {
      // Fallback to estimate if not provided
      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      const estimatedOutputTokens = result.response ? Math.ceil(result.response.length / 4) : 0;
      updateTokenUsage(estimatedInputTokens, estimatedOutputTokens);
    }

    if (!result.success) {
      // Task failed - schedule retry or mark as failed
      const errorMsg = result.error || 'Unknown error';
      const updatedTask = scheduleRetry(task.id, errorMsg);

      // Update session status
      addSessionLog(sessionId, 'error', `Task failed: ${errorMsg}`);
      updateSessionStatus(sessionId, 'failed', { error: errorMsg });

      addActionLogEntry({
        id: generateId(),
        taskId: task.id,
        taskTitle: task.title,
        actionType: 'error',
        description: updatedTask?.status === 'failed'
          ? `Task failed after ${task.retryCount + 1} attempts`
          : `Task failed, retry ${(task.retryCount || 0) + 1}/${task.maxRetries || 3} scheduled`,
        autoApproved: true,
        result: 'failure',
        output: errorMsg,
        duration,
        timestamp: new Date().toISOString(),
      });

      updateState({
        errorCount: getControllerState().errorCount + 1,
      });

      // Notify via ntfy if task failed permanently
      if (updatedTask?.status === 'failed') {
        await sendNtfyNotification(
          'Task Failed',
          `"${task.title}" failed after ${task.retryCount + 1} attempts: ${errorMsg}`,
          { priority: 'high', tags: ['x', 'task-failed'] }
        );
      }

      clearProgress();
      return;
    }

    // Update session with token usage
    if (result.tokenUsage) {
      updateSessionTokens(
        sessionId,
        result.tokenUsage.inputTokens,
        result.tokenUsage.outputTokens,
        result.costUsd
      );
    }

    setProgress('reviewing', 3, 3, 'Reviewing results...');

    const response = result.response || '';
    const classification = classifyAction(response, task);

    if (classification.requiresApproval) {
      // Create approval request with expiry time (30 minutes default)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const request: ApprovalRequest = {
        id: generateId(),
        taskId: task.id,
        taskTitle: task.title,
        actionType: classification.approvalType!,
        description: classification.description,
        details: response,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt,
      };

      addApprovalRequest(request);

      // Send ntfy notification with action buttons
      const ntfyConfig = ntfyRepo.getConfig();
      if (ntfyConfig.enabled) {
        const responseTopic = ntfyConfig.responseTopic || ntfyConfig.topic + '-response';
        await sendNtfyNotification(
          `Approval Required: ${classification.approvalType?.replace('_', ' ')}`,
          `${task.title}\n\n${classification.description}`,
          {
            priority: 'high',
            tags: ['warning', 'approval'],
            actions: [
              {
                action: 'http',
                label: 'Approve',
                url: `${ntfyConfig.serverUrl}/${responseTopic}`,
                method: 'POST',
                body: JSON.stringify({ command: '/approve', requestId: request.id }),
                clear: true,
              },
              {
                action: 'http',
                label: 'Reject',
                url: `${ntfyConfig.serverUrl}/${responseTopic}`,
                method: 'POST',
                body: JSON.stringify({ command: '/reject', requestId: request.id }),
                clear: true,
              },
              {
                action: 'http',
                label: 'Skip',
                url: `${ntfyConfig.serverUrl}/${responseTopic}`,
                method: 'POST',
                body: JSON.stringify({ command: '/skip', requestId: request.id }),
                clear: true,
              },
            ],
          }
        );
      }

      // Update session for approval waiting
      addSessionLog(sessionId, 'info', `Waiting for approval: ${classification.description}`);
      updateSessionStatus(sessionId, 'waiting_input');

      updateState({
        status: 'waiting_approval',
        currentAction: `Waiting approval: ${classification.description}`,
      });

      clearProgress();

      // Stop processing until approved/rejected
      return;
    }

    // Auto-approved action - task completed successfully
    addSessionLog(sessionId, 'complete', `Task completed: ${classification.description}`);
    addSessionLog(sessionId, 'info', `Result: ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}`);
    updateSessionStatus(sessionId, 'completed', { result: response.substring(0, 500) });

    addActionLogEntry({
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
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Update session with error
    addSessionLog(sessionId, 'error', `Task error: ${errorMsg}`);
    updateSessionStatus(sessionId, 'failed', { error: errorMsg });

    // Schedule retry or mark as failed
    const updatedTask = scheduleRetry(task.id, errorMsg);

    addActionLogEntry({
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      actionType: 'error',
      description: updatedTask?.status === 'failed'
        ? `Task error after ${task.retryCount + 1} attempts`
        : `Task error, retry ${(task.retryCount || 0) + 1}/${task.maxRetries || 3} scheduled`,
      autoApproved: true,
      result: 'failure',
      output: errorMsg,
      duration,
      timestamp: new Date().toISOString(),
    });

    updateState({
      errorCount: getControllerState().errorCount + 1,
    });

    // Notify via ntfy if task failed permanently
    if (updatedTask?.status === 'failed') {
      await sendNtfyNotification(
        'Task Failed',
        `"${task.title}" failed after ${task.retryCount + 1} attempts: ${errorMsg}`,
        { priority: 'high', tags: ['x', 'task-failed'] }
      );
    }

    clearProgress();
  }
}

// ============================================
// Main processing loop
// ============================================

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

  // Use smart task selection instead of simple FIFO
  const nextTask = getNextExecutableTask();

  if (!nextTask) {
    const stats = getTasksStats();
    const pendingCount = stats.todo + stats.blocked;
    const action = pendingCount > 0
      ? `Waiting for ${pendingCount} task(s) - blocked or scheduled`
      : 'No tasks in queue';

    updateState({
      currentTaskId: null,
      currentAction: action,
    });
    return;
  }

  await processTask(nextTask);
}

// ============================================
// Processing loop control
// ============================================

function startProcessingLoop(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
  }

  // Process immediately, then every 5 seconds
  processNextTask();
  processingInterval = setInterval(() => {
    const state = getControllerState();
    // Keep loop running for both 'running' and 'winding_down' states
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

// ============================================
// Public API
// ============================================

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
  controllerRepo.clearApprovalQueue();
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
  const request = updateApprovalRequestStatus(id, { status: 'approved' });
  if (!request) return;

  const state = getControllerState();

  // Log the approval
  addActionLogEntry({
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
  const request = updateApprovalRequestStatus(id, { status: 'rejected' });
  if (!request) return;

  const state = getControllerState();

  // Log the rejection
  addActionLogEntry({
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

// ============================================
// Backwards compatibility exports (mayor aliases)
// ============================================

export {
  initControllerStore as initMayorStore,
  getControllerState as getMayorState,
  activateController as activateMayor,
  deactivateController as deactivateMayor,
  pauseController as pauseMayor,
  resumeController as resumeMayor,
};
