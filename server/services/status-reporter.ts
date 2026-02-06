/**
 * Status Reporter Service
 *
 * Handles periodic status updates, daily summaries, and event-driven notifications
 * sent via ntfy to keep users informed when away from the app.
 */

import { createLogger } from '../utils/logger';
import { sendNotification, getNtfyConfig, StatusReporterConfig } from './ntfy';
import { getControllerState, getUsagePercentages } from './controller';
import { getTasksStats, listTasks } from './tasks';
import { getActivitySummary } from '../stores/activity-log';
import { calculateCost } from './cost-calculator';

const log = createLogger('StatusReporter');

let periodicInterval: NodeJS.Timeout | null = null;
let dailySummaryTimeout: NodeJS.Timeout | null = null;

/**
 * Get the status reporter config from ntfy config
 */
function getConfig(): StatusReporterConfig {
  const ntfyConfig = getNtfyConfig();
  return ntfyConfig.statusReporter || {
    enabled: false,
    intervalMinutes: 0,
    notifyOnTaskStart: false,
    notifyOnTaskComplete: true,
    notifyOnTaskFail: true,
    notifyOnApprovalNeeded: true,
    notifyOnTokenWarning: true,
  };
}

/**
 * Send periodic status update
 */
async function sendPeriodicStatus(): Promise<void> {
  const ntfyConfig = getNtfyConfig();
  if (!ntfyConfig.enabled) return;

  const config = getConfig();
  if (!config.enabled) return;

  try {
    const state = getControllerState();
    const stats = getTasksStats();
    const percentages = getUsagePercentages();

    const statusEmoji = state.status === 'running' ? 'green_circle' :
      state.status === 'paused' ? 'yellow_circle' :
      state.status === 'waiting_approval' ? 'bell' : 'white_circle';

    const message = [
      `Status: ${state.status}`,
      state.currentAction ? `Current: ${state.currentAction}` : null,
      '',
      `Tasks: ${stats.todo} pending, ${stats.inProgress} active, ${stats.done} done`,
      stats.failed > 0 ? `Failed: ${stats.failed}` : null,
      '',
      `Tokens: ${percentages.hourly}% hourly / ${percentages.daily}% daily`,
    ].filter(Boolean).join('\n');

    await sendNotification(
      'Phat Controller Status',
      message,
      {
        priority: 'low',
        tags: [statusEmoji, 'robot_face'],
      }
    );

    log.info('Sent periodic status update');
  } catch (error) {
    log.error('Error sending periodic status:', error);
  }
}

/**
 * Send daily summary
 */
async function sendDailySummary(): Promise<void> {
  const ntfyConfig = getNtfyConfig();
  if (!ntfyConfig.enabled) return;

  const config = getConfig();
  if (!config.enabled) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const summary = getActivitySummary({
      start: today + 'T00:00:00.000Z',
      end: today + 'T23:59:59.999Z',
    });

    const totalTokens = summary.totalTokens.input + summary.totalTokens.output;
    const estimatedCost = calculateCost(summary.totalTokens.input, summary.totalTokens.output);

    const message = [
      'Daily Summary',
      '',
      `Tasks: ${summary.byCategory.execution || 0} executed`,
      `Tokens: ${(totalTokens / 1000).toFixed(1)}K total`,
      `Estimated cost: $${estimatedCost.toFixed(4)}`,
      '',
      `Errors: ${summary.byCategory.error || 0}`,
      `User actions: ${summary.byCategory.user_action || 0}`,
    ].join('\n');

    await sendNotification(
      'Daily Summary',
      message,
      {
        priority: 'default',
        tags: ['calendar', 'chart_with_upwards_trend'],
      }
    );

    log.info('Sent daily summary');
  } catch (error) {
    log.error('Error sending daily summary:', error);
  }
}

/**
 * Calculate milliseconds until next occurrence of a time (HH:MM format)
 */
function getMillisecondsUntilTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  // If the time has passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

/**
 * Schedule the daily summary
 */
function scheduleDailySummary(): void {
  const config = getConfig();

  if (!config.enabled || !config.dailySummaryTime) {
    if (dailySummaryTimeout) {
      clearTimeout(dailySummaryTimeout);
      dailySummaryTimeout = null;
    }
    return;
  }

  const msUntilSummary = getMillisecondsUntilTime(config.dailySummaryTime);

  if (dailySummaryTimeout) {
    clearTimeout(dailySummaryTimeout);
  }

  dailySummaryTimeout = setTimeout(async () => {
    await sendDailySummary();
    // Reschedule for the next day
    scheduleDailySummary();
  }, msUntilSummary);

  const hours = Math.floor(msUntilSummary / (60 * 60 * 1000));
  const minutes = Math.floor((msUntilSummary % (60 * 60 * 1000)) / (60 * 1000));
  log.info(`Daily summary scheduled for ${config.dailySummaryTime} (in ${hours}h ${minutes}m)`);
}

/**
 * Start the status reporter
 */
export function startStatusReporter(): void {
  const config = getConfig();

  if (!config.enabled) {
    log.info('Status reporter is disabled');
    return;
  }

  // Start periodic status updates
  if (config.intervalMinutes > 0) {
    if (periodicInterval) {
      clearInterval(periodicInterval);
    }
    const intervalMs = config.intervalMinutes * 60 * 1000;
    periodicInterval = setInterval(sendPeriodicStatus, intervalMs);
    log.info(`Periodic status updates started (every ${config.intervalMinutes} minutes)`);
  }

  // Schedule daily summary
  if (config.dailySummaryTime) {
    scheduleDailySummary();
  }

  log.info('Status reporter started');
}

/**
 * Stop the status reporter
 */
export function stopStatusReporter(): void {
  if (periodicInterval) {
    clearInterval(periodicInterval);
    periodicInterval = null;
  }
  if (dailySummaryTimeout) {
    clearTimeout(dailySummaryTimeout);
    dailySummaryTimeout = null;
  }
  log.info('Status reporter stopped');
}

/**
 * Restart the status reporter with new config
 */
export function restartStatusReporter(): void {
  stopStatusReporter();
  startStatusReporter();
}

// Event notification helpers

/**
 * Notify when a task starts execution
 */
export async function notifyTaskStarted(taskTitle: string, taskId: string): Promise<void> {
  const ntfyConfig = getNtfyConfig();
  const config = getConfig();

  if (!ntfyConfig.enabled || !config.notifyOnTaskStart) return;

  await sendNotification(
    'Task Started',
    taskTitle,
    {
      priority: 'low',
      tags: ['arrow_forward'],
    }
  );
}

/**
 * Notify when a task completes successfully
 */
export async function notifyTaskCompleted(taskTitle: string, taskId: string): Promise<void> {
  const ntfyConfig = getNtfyConfig();
  const config = getConfig();

  if (!ntfyConfig.enabled || !config.notifyOnTaskComplete) return;

  await sendNotification(
    'Task Completed',
    taskTitle,
    {
      priority: 'default',
      tags: ['white_check_mark'],
    }
  );
}

/**
 * Notify when a task fails
 */
export async function notifyTaskFailed(taskTitle: string, taskId: string, error: string): Promise<void> {
  const ntfyConfig = getNtfyConfig();
  const config = getConfig();

  if (!ntfyConfig.enabled || !config.notifyOnTaskFail) return;

  await sendNotification(
    'Task Failed',
    `${taskTitle}\n\nError: ${error}`,
    {
      priority: 'high',
      tags: ['x', 'warning'],
    }
  );
}

/**
 * Notify when approval is needed
 */
export async function notifyApprovalNeeded(
  taskTitle: string,
  actionType: string,
  description: string,
  requestId: string
): Promise<void> {
  const ntfyConfig = getNtfyConfig();
  const config = getConfig();

  if (!ntfyConfig.enabled || !config.notifyOnApprovalNeeded) return;

  const responseTopic = ntfyConfig.responseTopic || ntfyConfig.topic + '-response';

  await sendNotification(
    `Approval: ${actionType.replace('_', ' ')}`,
    `${taskTitle}\n\n${description}`,
    {
      priority: 'high',
      tags: ['bell', 'warning'],
      actions: [
        {
          action: 'http',
          label: 'Approve',
          url: `${ntfyConfig.serverUrl}/${responseTopic}`,
          method: 'POST',
          body: JSON.stringify({ command: '/approve', requestId }),
          clear: true,
        },
        {
          action: 'http',
          label: 'Reject',
          url: `${ntfyConfig.serverUrl}/${responseTopic}`,
          method: 'POST',
          body: JSON.stringify({ command: '/reject', requestId }),
          clear: true,
        },
      ],
    }
  );
}

/**
 * Notify when approaching token limit
 */
export async function notifyTokenWarning(percentage: number, type: 'hourly' | 'daily'): Promise<void> {
  const ntfyConfig = getNtfyConfig();
  const config = getConfig();

  if (!ntfyConfig.enabled || !config.notifyOnTokenWarning) return;

  await sendNotification(
    'Token Limit Warning',
    `${type.charAt(0).toUpperCase() + type.slice(1)} token usage at ${percentage}%`,
    {
      priority: 'high',
      tags: ['warning', 'chart'],
    }
  );
}
