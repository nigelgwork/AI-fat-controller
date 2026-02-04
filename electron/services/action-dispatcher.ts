/**
 * Action Dispatcher for Clawdbot
 * Maps parsed intents to actual app actions
 */

import { Intent } from './intent-parser';
import { getControllerState } from './controller';
import { listTasks, createTask, updateTask, deleteTask, getTasksStats } from './tasks';
import { getProjects } from './projects';
import { getActivitySummary } from '../stores/activity-log';
import { formatCost, formatTokens } from './cost-calculator';
import { getExecutor } from './executor';
import { getRecentMessages, ClawdbotMessage } from '../stores/clawdbot-conversation';
import { createLogger } from '../utils/logger';

const log = createLogger('ActionDispatcher');

export interface ActionResult {
  success: boolean;
  action: string;
  response: string;
  data?: Record<string, unknown>;
  navigate?: string; // Route to navigate to
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

/**
 * Dispatch an intent to the appropriate handler
 */
export async function dispatchAction(intent: Intent): Promise<ActionResult> {
  switch (intent.type) {
    case 'navigation':
      return handleNavigation(intent);
    case 'task_management':
      return handleTaskManagement(intent);
    case 'execution':
      return handleExecution(intent);
    case 'query':
      return handleQuery(intent);
    case 'settings':
      return handleSettings(intent);
    case 'unknown':
    default:
      // Try to handle with Claude Code
      return handleUnknownWithClaude(intent);
  }
}

/**
 * Handle unknown intents by calling Claude Code
 */
async function handleUnknownWithClaude(intent: Intent): Promise<ActionResult> {
  const userMessage = intent.originalText;

  log.info('[Clawdbot] Routing unknown intent to Claude Code:', userMessage.substring(0, 50));

  try {
    const executor = await getExecutor();

    // Build context from recent conversation
    const recentMessages = getRecentMessages(6);
    let conversationContext = '';
    if (recentMessages.length > 0) {
      conversationContext = recentMessages
        .map((m: ClawdbotMessage) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      conversationContext = `\n\nRecent conversation:\n${conversationContext}\n\n`;
    }

    // Get current state for context
    const state = getControllerState();
    const stats = await getTasksStats();
    const projects = await getProjects();

    const systemPrompt = `You are Clawdbot, a helpful AI assistant integrated into the AI Controller app.
You help users manage tasks, navigate the app, understand the codebase, and answer questions.

Current app state:
- Controller status: ${state.status}
- Tasks: ${stats.todo} todo, ${stats.inProgress} in progress, ${stats.done} done
- Projects: ${projects.length} registered

Available navigation: dashboard, tasks, projects, settings, controller, agents, sessions, activity, clawdbot, tmux

You can help with:
- Creating and managing tasks
- Navigating the app
- Answering questions about the codebase
- Explaining features
- General conversation

Keep responses concise but helpful. If you need to suggest an action, clearly state what you're recommending.`;

    const prompt = conversationContext + `User: ${userMessage}`;

    const result = await executor.runClaude(prompt, systemPrompt, undefined, undefined, `clawdbot-${Date.now()}`);

    if (result.success && result.response) {
      // Parse out the final result from potential JSON stream output
      let response = result.response;

      // If it looks like JSON stream output, try to extract the text
      if (response.includes('"type":"result"')) {
        try {
          const lines = response.split('\n');
          for (const line of lines) {
            if (line.includes('"type":"result"')) {
              const json = JSON.parse(line);
              if (json.result) {
                response = json.result;
                break;
              }
            }
          }
        } catch {
          // Keep original response if parsing fails
        }
      }

      return {
        success: true,
        action: 'claude_response',
        response: response.trim(),
        data: { usedClaudeCode: true, duration: result.duration },
      };
    } else {
      return {
        success: false,
        action: 'claude_error',
        response: result.error || "I couldn't process that request. Try a simpler command or say 'help' for options.",
        data: { usedClaudeCode: true, error: result.error },
      };
    }
  } catch (error) {
    log.error('[Clawdbot] Claude Code error:', error);
    return {
      success: false,
      action: 'unknown',
      response: "I'm having trouble connecting to Claude. Try using specific commands like 'go to tasks' or 'what's the status'.",
    };
  }
}

/**
 * Handle navigation intents
 */
function handleNavigation(intent: Intent): ActionResult {
  const target = intent.parameters.target as string;

  const routes: Record<string, string> = {
    dashboard: '/',
    tasks: '/tasks',
    projects: '/projects',
    settings: '/settings',
    controller: '/controller',
    agents: '/agents',
    sessions: '/sessions',
    activity: '/activity',
    clawdbot: '/clawdbot',
    tmux: '/tmux',
  };

  const route = routes[target];
  if (route) {
    return {
      success: true,
      action: 'navigate',
      response: `Navigating to ${target}.`,
      navigate: route,
    };
  }

  return {
    success: false,
    action: 'navigate',
    response: `I don't know how to navigate to "${target}".`,
  };
}

/**
 * Handle task management intents
 */
async function handleTaskManagement(intent: Intent): Promise<ActionResult> {
  const action = intent.action;

  switch (action) {
    case 'create': {
      const taskName = intent.parameters.taskName as string;
      if (!taskName) {
        return {
          success: false,
          action: 'create_task',
          response: "What should I name the task?",
        };
      }

      try {
        const task = await createTask({
          title: taskName,
          description: '',
          status: 'todo',
          priority: 'medium',
        });

        return {
          success: true,
          action: 'create_task',
          response: `Created task "${taskName}".`,
          data: { task },
          navigate: '/tasks',
        };
      } catch (error) {
        return {
          success: false,
          action: 'create_task',
          response: `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    case 'complete': {
      const taskName = intent.parameters.taskName as string;
      const tasks = await listTasks();
      const task = tasks.find(t =>
        t.title.toLowerCase().includes(taskName?.toLowerCase() || '')
      );

      if (!task) {
        return {
          success: false,
          action: 'complete_task',
          response: `I couldn't find a task matching "${taskName}".`,
        };
      }

      await updateTask(task.id, { status: 'done' });
      return {
        success: true,
        action: 'complete_task',
        response: `Marked "${task.title}" as done.`,
        data: { task },
      };
    }

    case 'delete': {
      const taskName = intent.parameters.taskName as string;
      const tasks = await listTasks();
      const task = tasks.find(t =>
        t.title.toLowerCase().includes(taskName?.toLowerCase() || '')
      );

      if (!task) {
        return {
          success: false,
          action: 'delete_task',
          response: `I couldn't find a task matching "${taskName}".`,
        };
      }

      return {
        success: false,
        action: 'delete_task',
        response: `Are you sure you want to delete "${task.title}"?`,
        requiresConfirmation: true,
        confirmationMessage: `delete_task:${task.id}`,
        data: { task },
      };
    }

    case 'list':
    case 'list_pending': {
      const tasks = await listTasks();
      const pendingTasks = action === 'list_pending'
        ? tasks.filter(t => t.status === 'todo' || t.status === 'in_progress')
        : tasks;

      if (pendingTasks.length === 0) {
        return {
          success: true,
          action: 'list_tasks',
          response: action === 'list_pending'
            ? "You have no pending tasks."
            : "You have no tasks.",
          navigate: '/tasks',
        };
      }

      const taskList = pendingTasks.slice(0, 5).map(t => `- ${t.title} (${t.status})`).join('\n');
      const more = pendingTasks.length > 5 ? `\n...and ${pendingTasks.length - 5} more` : '';

      return {
        success: true,
        action: 'list_tasks',
        response: action === 'list_pending'
          ? `You have ${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'}:\n${taskList}${more}`
          : `You have ${pendingTasks.length} task${pendingTasks.length === 1 ? '' : 's'}:\n${taskList}${more}`,
        data: { tasks: pendingTasks },
        navigate: '/tasks',
      };
    }

    default:
      return {
        success: false,
        action: 'task_management',
        response: `I don't know how to ${action} tasks.`,
      };
  }
}

/**
 * Handle execution intents
 */
async function handleExecution(intent: Intent): Promise<ActionResult> {
  const action = intent.action;
  const state = getControllerState();

  switch (action) {
    case 'run_task': {
      const taskName = intent.parameters.taskName as string;
      const tasks = await listTasks();
      const task = tasks.find(t =>
        t.title.toLowerCase().includes(taskName?.toLowerCase() || '')
      );

      if (!task) {
        return {
          success: false,
          action: 'run_task',
          response: `I couldn't find a task matching "${taskName}".`,
        };
      }

      // This would trigger the IPC call to run the task
      return {
        success: true,
        action: 'run_task',
        response: `Starting execution of "${task.title}" with Claude...`,
        data: { task, executeTaskId: task.id },
      };
    }

    case 'pause':
      if (state.status === 'paused') {
        return {
          success: false,
          action: 'pause',
          response: "The controller is already paused.",
        };
      }
      return {
        success: true,
        action: 'pause',
        response: "Pausing the controller.",
        data: { controllerAction: 'pause' },
      };

    case 'resume':
      if (state.status !== 'paused') {
        return {
          success: false,
          action: 'resume',
          response: "The controller isn't paused.",
        };
      }
      return {
        success: true,
        action: 'resume',
        response: "Resuming the controller.",
        data: { controllerAction: 'resume' },
      };

    case 'activate':
      if (state.status !== 'idle') {
        return {
          success: false,
          action: 'activate',
          response: "The controller is already active.",
        };
      }
      return {
        success: true,
        action: 'activate',
        response: "Activating the controller.",
        data: { controllerAction: 'activate' },
      };

    case 'deactivate':
      if (state.status === 'idle') {
        return {
          success: false,
          action: 'deactivate',
          response: "The controller isn't active.",
        };
      }
      return {
        success: true,
        action: 'deactivate',
        response: "Deactivating the controller.",
        data: { controllerAction: 'deactivate' },
      };

    case 'stop':
      return {
        success: true,
        action: 'stop',
        response: "Stopping the current execution.",
        data: { controllerAction: 'stop' },
      };

    default:
      return {
        success: false,
        action: 'execution',
        response: `I don't know how to ${action}.`,
      };
  }
}

/**
 * Handle query intents
 */
async function handleQuery(intent: Intent): Promise<ActionResult> {
  const action = intent.action;
  const state = getControllerState();

  switch (action) {
    case 'tokens_today':
    case 'cost': {
      const dailyUsage = state.dailyTokenUsage;
      const totalTokens = dailyUsage.input + dailyUsage.output;
      const summary = getActivitySummary({ start: new Date().toISOString().split('T')[0] });

      if (action === 'tokens_today') {
        return {
          success: true,
          action: 'tokens_today',
          response: `Today you've used ${formatTokens(totalTokens)} tokens (${formatTokens(dailyUsage.input)} input, ${formatTokens(dailyUsage.output)} output), costing approximately ${formatCost(summary.totalCostUsd)}.`,
          data: { dailyUsage, cost: summary.totalCostUsd },
        };
      } else {
        return {
          success: true,
          action: 'cost',
          response: `Today's estimated cost is ${formatCost(summary.totalCostUsd)}.`,
          data: { cost: summary.totalCostUsd },
        };
      }
    }

    case 'status': {
      const statusParts: string[] = [];

      // Controller status
      if (state.status !== 'idle') {
        statusParts.push(state.status === 'paused' ? 'Controller is paused' : 'Controller is active');
      } else {
        statusParts.push('Controller is inactive');
      }

      // Task stats
      const stats = await getTasksStats();
      statusParts.push(`${stats.todo} tasks pending, ${stats.done} completed`);

      // Token usage
      const hourlyUsage = state.tokenUsage.inputTokens + state.tokenUsage.outputTokens;
      if (hourlyUsage > 0) {
        statusParts.push(`${formatTokens(hourlyUsage)} tokens used this hour`);
      }

      return {
        success: true,
        action: 'status',
        response: statusParts.join('. ') + '.',
        data: { controllerState: state, taskStats: stats },
      };
    }

    case 'pending_tasks': {
      const stats = await getTasksStats();
      const total = stats.todo + stats.inProgress;
      return {
        success: true,
        action: 'pending_tasks',
        response: `You have ${total} pending task${total === 1 ? '' : 's'} (${stats.todo} to do, ${stats.inProgress} in progress).`,
        data: { stats },
        navigate: '/tasks',
      };
    }

    case 'list_projects': {
      const projects = await getProjects();
      if (projects.length === 0) {
        return {
          success: true,
          action: 'list_projects',
          response: "You haven't added any projects yet.",
          navigate: '/projects',
        };
      }

      const projectList = projects.slice(0, 5).map(p => `- ${p.name}`).join('\n');
      const more = projects.length > 5 ? `\n...and ${projects.length - 5} more` : '';

      return {
        success: true,
        action: 'list_projects',
        response: `You have ${projects.length} project${projects.length === 1 ? '' : 's'}:\n${projectList}${more}`,
        data: { projects },
        navigate: '/projects',
      };
    }

    default:
      return {
        success: false,
        action: 'query',
        response: `I don't know how to answer that.`,
      };
  }
}

/**
 * Handle settings intents
 */
function handleSettings(intent: Intent): ActionResult {
  const action = intent.action;
  const value = intent.parameters.value as string;

  switch (action) {
    case 'theme':
      return {
        success: true,
        action: 'theme',
        response: `Changing theme to ${value} mode.`,
        data: { settingAction: 'theme', value },
      };

    default:
      return {
        success: false,
        action: 'settings',
        response: `I don't know how to change that setting.`,
      };
  }
}

/**
 * Execute a confirmed action (after user confirmation)
 */
export async function executeConfirmedAction(confirmationMessage: string): Promise<ActionResult> {
  const [action, ...params] = confirmationMessage.split(':');

  switch (action) {
    case 'delete_task': {
      const taskId = params[0];
      const deleted = await deleteTask(taskId);
      if (deleted) {
        return {
          success: true,
          action: 'delete_task',
          response: "Task deleted.",
        };
      }
      return {
        success: false,
        action: 'delete_task',
        response: "Failed to delete task.",
      };
    }

    default:
      return {
        success: false,
        action: 'unknown',
        response: "Unknown confirmation action.",
      };
  }
}
