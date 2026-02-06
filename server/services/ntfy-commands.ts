/**
 * ntfy Command System
 *
 * Allows remote control of Clawdbot via ntfy messages.
 * Commands start with '/' for direct execution.
 * Free-form text is processed through Clawdbot's intent parser.
 */

import { createLogger } from '../utils/logger';
import {
  getControllerState,
  activateController,
  deactivateController,
  pauseController,
  resumeController,
  getApprovalQueue,
  approveRequest,
  rejectRequest,
  getUsagePercentages,
} from './controller';
import {
  listTasks,
  getTasksStats,
  createTask,
  getTaskById,
} from './tasks';
import type { Task, TasksStats } from './tasks';
import { parseIntent, getAvailableCommands } from './intent-parser';
import { dispatchAction, executeConfirmedAction } from './action-dispatcher';
import { sendNotification, getNtfyConfig } from './ntfy';
import { logActivity } from '../stores/activity-log';

const log = createLogger('NtfyCommands');

// Rate limiting: max 10 commands per minute
const commandHistory: number[] = [];
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

export interface NtfyCommand {
  command: string;
  args: string[];
  raw: string;
}

export interface NtfyCommandResult {
  success: boolean;
  response: string;
  data?: Record<string, unknown>;
}

/**
 * Parse an ntfy message into a command structure
 */
export function parseNtfyCommand(message: string): NtfyCommand | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  return {
    command,
    args,
    raw: trimmed,
  };
}

/**
 * Check rate limiting
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  // Remove old entries
  while (commandHistory.length > 0 && commandHistory[0] < now - RATE_WINDOW_MS) {
    commandHistory.shift();
  }

  if (commandHistory.length >= RATE_LIMIT) {
    return false;
  }

  commandHistory.push(now);
  return true;
}

/**
 * Format task list for ntfy display
 */
function formatTaskList(tasks: Task[], limit = 5): string {
  if (tasks.length === 0) {
    return 'No tasks found.';
  }

  const displayTasks = tasks.slice(0, limit);
  const lines = displayTasks.map((t, i) => {
    const priority = t.priority === 'high' ? '!' : t.priority === 'low' ? '~' : '';
    const status = t.status === 'done' ? '[x]' : t.status === 'in_progress' ? '[>]' : t.status === 'failed' ? '[!]' : '[ ]';
    return `${i + 1}. ${status} ${priority}${t.title}`;
  });

  if (tasks.length > limit) {
    lines.push(`... and ${tasks.length - limit} more`);
  }

  return lines.join('\n');
}

/**
 * Execute a slash command
 */
export async function executeNtfyCommand(cmd: NtfyCommand): Promise<NtfyCommandResult> {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      response: 'Rate limit exceeded. Please wait a moment before sending more commands.',
    };
  }

  // Log the command
  logActivity('user_action', `ntfy command: ${cmd.raw}`, { command: cmd.command, args: cmd.args });

  switch (cmd.command) {
    case 'status': {
      const state = getControllerState();
      const stats = getTasksStats();
      const percentages = getUsagePercentages();

      const statusEmoji = state.status === 'running' ? 'green_circle' :
        state.status === 'paused' ? 'yellow_circle' :
        state.status === 'idle' ? 'white_circle' :
        state.status === 'waiting_approval' ? 'bell' : 'grey_question';

      return {
        success: true,
        response: [
          `Status: ${state.status}`,
          state.currentAction ? `Action: ${state.currentAction}` : null,
          `Tasks: ${stats.todo} todo, ${stats.inProgress} active, ${stats.done} done${stats.failed > 0 ? `, ${stats.failed} failed` : ''}`,
          `Tokens: ${percentages.hourly}% hourly, ${percentages.daily}% daily`,
          `Processed: ${state.processedCount} (${state.approvedCount} approved, ${state.rejectedCount} rejected, ${state.errorCount} errors)`,
        ].filter(Boolean).join('\n'),
        data: { state, stats, percentages },
      };
    }

    case 'pause': {
      const state = getControllerState();
      if (state.status !== 'running' && state.status !== 'waiting_approval') {
        return {
          success: false,
          response: `Cannot pause - controller is ${state.status}`,
        };
      }
      await pauseController();
      logActivity('system', 'Controller paused via ntfy', {});
      return {
        success: true,
        response: 'Controller paused.',
      };
    }

    case 'resume': {
      const state = getControllerState();
      if (state.status !== 'paused') {
        return {
          success: false,
          response: `Cannot resume - controller is ${state.status}`,
        };
      }
      await resumeController();
      logActivity('system', 'Controller resumed via ntfy', {});
      return {
        success: true,
        response: 'Controller resumed.',
      };
    }

    case 'start': {
      const state = getControllerState();
      if (state.status !== 'idle') {
        return {
          success: false,
          response: `Cannot start - controller is ${state.status}`,
        };
      }
      await activateController();
      logActivity('system', 'Controller started via ntfy', {});
      return {
        success: true,
        response: 'Controller started.',
      };
    }

    case 'stop': {
      const state = getControllerState();
      if (state.status === 'idle') {
        return {
          success: false,
          response: 'Controller is already stopped.',
        };
      }
      await deactivateController();
      logActivity('system', 'Controller stopped via ntfy', {});
      return {
        success: true,
        response: 'Controller stopped.',
      };
    }

    case 'tasks': {
      const filter = cmd.args[0]?.toLowerCase();
      let tasks = listTasks();

      if (filter === 'pending' || filter === 'todo') {
        tasks = tasks.filter(t => t.status === 'todo' || t.status === 'blocked');
      } else if (filter === 'done' || filter === 'completed') {
        tasks = tasks.filter(t => t.status === 'done');
      } else if (filter === 'failed') {
        tasks = tasks.filter(t => t.status === 'failed');
      } else if (filter === 'active' || filter === 'running') {
        tasks = tasks.filter(t => t.status === 'in_progress');
      }

      return {
        success: true,
        response: formatTaskList(tasks),
        data: { tasks: tasks.slice(0, 10) },
      };
    }

    case 'run': {
      const taskQuery = cmd.args.join(' ');
      if (!taskQuery) {
        return {
          success: false,
          response: 'Usage: /run <task title or ID>',
        };
      }

      const tasks = listTasks();
      // Find by ID or partial title match
      const task = tasks.find(t =>
        t.id === taskQuery ||
        t.title.toLowerCase().includes(taskQuery.toLowerCase())
      );

      if (!task) {
        return {
          success: false,
          response: `Task not found: "${taskQuery}"`,
        };
      }

      if (task.status !== 'todo' && task.status !== 'blocked') {
        return {
          success: false,
          response: `Task "${task.title}" is ${task.status}, cannot run.`,
        };
      }

      // The controller will pick this up on next cycle
      return {
        success: true,
        response: `Task "${task.title}" queued for execution.`,
        data: { taskId: task.id },
      };
    }

    case 'approve': {
      const requestId = cmd.args[0];
      const queue = getApprovalQueue();

      if (!requestId && queue.length === 1) {
        // Auto-select if only one pending
        await approveRequest(queue[0].id);
        logActivity('user_action', 'Approval approved via ntfy', { requestId: queue[0].id });
        return {
          success: true,
          response: `Approved: ${queue[0].taskTitle}`,
        };
      }

      if (!requestId) {
        if (queue.length === 0) {
          return {
            success: false,
            response: 'No pending approval requests.',
          };
        }
        return {
          success: false,
          response: `${queue.length} pending approvals. Specify ID:\n${queue.map(r => `- ${r.id}: ${r.taskTitle}`).join('\n')}`,
        };
      }

      const request = queue.find(r => r.id === requestId);
      if (!request) {
        return {
          success: false,
          response: `Approval request not found: ${requestId}`,
        };
      }

      await approveRequest(requestId);
      logActivity('user_action', 'Approval approved via ntfy', { requestId });
      return {
        success: true,
        response: `Approved: ${request.taskTitle}`,
      };
    }

    case 'reject': {
      const queue = getApprovalQueue();
      const requestId = cmd.args[0];
      const reason = cmd.args.slice(1).join(' ') || undefined;

      if (!requestId && queue.length === 1) {
        await rejectRequest(queue[0].id, reason);
        logActivity('user_action', 'Approval rejected via ntfy', { requestId: queue[0].id, reason });
        return {
          success: true,
          response: `Rejected: ${queue[0].taskTitle}${reason ? ` (${reason})` : ''}`,
        };
      }

      if (!requestId) {
        if (queue.length === 0) {
          return {
            success: false,
            response: 'No pending approval requests.',
          };
        }
        return {
          success: false,
          response: `${queue.length} pending approvals. Specify ID:\n${queue.map(r => `- ${r.id}: ${r.taskTitle}`).join('\n')}`,
        };
      }

      const request = queue.find(r => r.id === requestId);
      if (!request) {
        return {
          success: false,
          response: `Approval request not found: ${requestId}`,
        };
      }

      await rejectRequest(requestId, reason);
      logActivity('user_action', 'Approval rejected via ntfy', { requestId, reason });
      return {
        success: true,
        response: `Rejected: ${request.taskTitle}${reason ? ` (${reason})` : ''}`,
      };
    }

    case 'skip': {
      const queue = getApprovalQueue();
      const requestId = cmd.args[0];

      if (!requestId && queue.length === 1) {
        await rejectRequest(queue[0].id, 'Skipped via ntfy');
        logActivity('user_action', 'Approval skipped via ntfy', { requestId: queue[0].id });
        return {
          success: true,
          response: `Skipped: ${queue[0].taskTitle}`,
        };
      }

      const request = queue.find(r => r.id === requestId);
      if (request) {
        await rejectRequest(requestId, 'Skipped via ntfy');
        logActivity('user_action', 'Approval skipped via ntfy', { requestId });
        return {
          success: true,
          response: `Skipped: ${request.taskTitle}`,
        };
      }

      return {
        success: false,
        response: 'No matching approval request found.',
      };
    }

    case 'add':
    case 'create': {
      const title = cmd.args.join(' ');
      if (!title) {
        return {
          success: false,
          response: 'Usage: /add <task title>',
        };
      }

      const task = createTask({
        title,
        priority: 'medium',
      });

      logActivity('user_action', 'Task created via ntfy', { taskId: task.id, title });
      return {
        success: true,
        response: `Task created: "${title}" (ID: ${task.id})`,
        data: { task },
      };
    }

    case 'help': {
      return {
        success: true,
        response: [
          'Available commands:',
          '/status - Controller status & stats',
          '/pause - Pause the controller',
          '/resume - Resume the controller',
          '/start - Start the controller',
          '/stop - Stop the controller',
          '/tasks [filter] - List tasks (pending/done/failed/active)',
          '/run <task> - Queue task for execution',
          '/add <title> - Create a new task',
          '/approve [id] - Approve pending request',
          '/reject [id] [reason] - Reject pending request',
          '/skip [id] - Skip pending request',
          '/help - Show this help',
          '',
          'Or send free-form text to interact with Clawdbot.',
        ].join('\n'),
      };
    }

    default:
      return {
        success: false,
        response: `Unknown command: /${cmd.command}\nType /help for available commands.`,
      };
  }
}

/**
 * Process a free-form text message through Clawdbot's intent parser
 */
export async function processNtfyText(message: string): Promise<NtfyCommandResult> {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      response: 'Rate limit exceeded. Please wait a moment.',
    };
  }

  try {
    // Parse intent using Clawdbot's intent parser
    const intent = parseIntent(message);

    log.info('Parsed intent from ntfy message', { message, intent });
    logActivity('user_action', `ntfy message: ${message}`, { intent });

    if (intent.type === 'unknown' || intent.confidence < 0.5) {
      return {
        success: false,
        response: `I didn't understand that. Try /help for commands, or be more specific.\n\nExamples:\n- "add task fix the login bug"\n- "show me pending tasks"\n- "pause the controller"`,
      };
    }

    // Dispatch the action
    const result = await dispatchAction(intent);

    if (result.requiresConfirmation) {
      // Send confirmation request via ntfy
      const config = getNtfyConfig();
      if (config.enabled) {
        const responseTopic = config.responseTopic || config.topic + '-response';
        await sendNotification(
          'Confirm Action',
          result.confirmationMessage || 'Confirm this action?',
          {
            priority: 'high',
            tags: ['question'],
            actions: [
              {
                action: 'http',
                label: 'Confirm',
                url: `${config.serverUrl}/${responseTopic}`,
                method: 'POST',
                body: JSON.stringify({ command: '/confirm', message: result.confirmationMessage }),
                clear: true,
              },
              {
                action: 'http',
                label: 'Cancel',
                url: `${config.serverUrl}/${responseTopic}`,
                method: 'POST',
                body: JSON.stringify({ command: '/cancel' }),
                clear: true,
              },
            ],
          }
        );
      }
      return {
        success: true,
        response: result.confirmationMessage || 'Action requires confirmation.',
        data: { requiresConfirmation: true },
      };
    }

    return {
      success: result.success,
      response: result.response,
      data: result.data,
    };
  } catch (error) {
    log.error('Error processing ntfy text', error);
    return {
      success: false,
      response: `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Handle an incoming ntfy message - either command or free-form text
 */
export async function handleNtfyMessage(message: string): Promise<NtfyCommandResult> {
  const trimmed = message.trim();

  // Try to parse as JSON first (for button responses)
  try {
    const json = JSON.parse(trimmed);
    if (json.command) {
      // Handle button-triggered commands
      const cmd = parseNtfyCommand(json.command);
      if (cmd) {
        // Add extra args from JSON if present
        if (json.requestId) cmd.args = [json.requestId, ...cmd.args];
        if (json.message) cmd.args = [json.message, ...cmd.args];
        return executeNtfyCommand(cmd);
      }
    }
  } catch {
    // Not JSON, continue with text processing
  }

  // Check if it's a slash command
  const cmd = parseNtfyCommand(trimmed);
  if (cmd) {
    return executeNtfyCommand(cmd);
  }

  // Process as free-form text through intent parser
  return processNtfyText(trimmed);
}

/**
 * Send a command result back via ntfy
 */
export async function sendCommandResponse(result: NtfyCommandResult): Promise<void> {
  const config = getNtfyConfig();
  if (!config.enabled) return;

  await sendNotification(
    result.success ? 'Command Result' : 'Command Failed',
    result.response,
    {
      priority: result.success ? 'default' : 'high',
      tags: [result.success ? 'white_check_mark' : 'x'],
    }
  );
}
