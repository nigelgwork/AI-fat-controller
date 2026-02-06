import { createLogger } from '../utils/logger';
import { broadcast } from '../websocket';
import {
  getConfig as repoGetConfig,
  setConfig as repoSetConfig,
  getPendingQuestions as repoGetPendingQuestions,
  addQuestion as repoAddQuestion,
  updateQuestion as repoUpdateQuestion,
  removeQuestion as repoRemoveQuestion,
  cleanupExpired as repoCleanupExpired,
  type NtfyConfig,
  type PendingQuestion,
  type StatusReporterConfig,
} from '../db/repositories/ntfy-repo';
import { handleNtfyMessage, sendCommandResponse } from './ntfy-commands';

const log = createLogger('Ntfy');

// Re-export types
export type { NtfyConfig, PendingQuestion, StatusReporterConfig };

export interface NtfyNotification {
  topic: string;
  title: string;
  message: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  click?: string;
  actions?: Array<{
    action: 'view' | 'broadcast' | 'http';
    label: string;
    url?: string;
    body?: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    clear?: boolean;
  }>;
}

let pollingInterval: NodeJS.Timeout | null = null;
let lastEventId: string | null = null;

// Generate a simple unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Config management
export function getNtfyConfig(): NtfyConfig {
  return repoGetConfig();
}

export function setNtfyConfig(config: Partial<NtfyConfig>): NtfyConfig {
  return repoSetConfig(config);
}

// Priority mapping
function mapPriority(priority: NtfyConfig['priority']): 1 | 2 | 3 | 4 | 5 {
  switch (priority) {
    case 'min': return 1;
    case 'low': return 2;
    case 'default': return 3;
    case 'high': return 4;
    case 'urgent': return 5;
  }
}

// Send a notification to ntfy server
export async function sendNotification(
  title: string,
  message: string,
  options?: {
    priority?: NtfyConfig['priority'];
    tags?: string[];
    actions?: NtfyNotification['actions'];
    click?: string;
  }
): Promise<boolean> {
  const config = getNtfyConfig();

  if (!config.enabled) {
    // In server/Docker mode, log instead of desktop notification
    if (config.enableDesktopNotifications) {
      console.log(`[Notification] ${title}: ${message}`);
    }
    return true;
  }

  const notification: NtfyNotification = {
    topic: config.topic,
    title,
    message,
    priority: mapPriority(options?.priority || config.priority),
    tags: options?.tags,
    actions: options?.actions,
    click: options?.click,
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    const response = await fetch(config.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      log.error('Failed to send ntfy notification:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    log.error('Error sending ntfy notification:', error);
    return false;
  }
}

// Pending questions management
export function getPendingQuestions(): PendingQuestion[] {
  return repoGetPendingQuestions();
}

// Ask a question via ntfy and wait for response
export async function askQuestion(
  question: string,
  taskId: string,
  taskTitle: string,
  options?: {
    choices?: string[];
    freeText?: boolean;
    timeoutMinutes?: number;
  }
): Promise<PendingQuestion> {
  const config = getNtfyConfig();
  const id = generateId();
  const timeoutMs = (options?.timeoutMinutes || 30) * 60 * 1000;

  const pendingQuestion: PendingQuestion = {
    id,
    question,
    options: options?.choices,
    freeText: options?.freeText ?? true,
    taskId,
    taskTitle,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
  };

  repoAddQuestion(pendingQuestion);

  // Build notification actions
  const actions: NtfyNotification['actions'] = [];

  if (options?.choices) {
    // Add action buttons for each choice
    for (let i = 0; i < Math.min(options.choices.length, 3); i++) {
      const choice = options.choices[i];
      actions.push({
        action: 'http',
        label: choice,
        url: `${config.serverUrl}/${config.responseTopic || config.topic + '-response'}`,
        method: 'POST',
        body: JSON.stringify({ questionId: id, answer: choice }),
        clear: true,
      });
    }
  }

  // Send notification
  await sendNotification(
    `Question for: ${taskTitle}`,
    question,
    {
      priority: 'high',
      tags: ['question', 'phat-controller'],
      actions: actions.length > 0 ? actions : undefined,
    }
  );

  // Notify renderer via WebSocket
  notifyQuestionAsked(pendingQuestion);

  return pendingQuestion;
}

// Answer a pending question
export function answerQuestion(id: string, answer: string): PendingQuestion | null {
  const question = repoUpdateQuestion(id, {
    status: 'answered',
    answer,
  });

  if (question) {
    notifyQuestionAnswered(question);
  }

  return question;
}

// Polling for responses
export function startPolling(): void {
  const config = getNtfyConfig();

  if (!config.enabled || pollingInterval) {
    return;
  }

  const responseTopic = config.responseTopic || config.topic + '-response';
  const pollUrl = `${config.serverUrl}/${responseTopic}/json?poll=1`;

  pollingInterval = setInterval(async () => {
    repoCleanupExpired();

    try {
      const headers: Record<string, string> = {};
      if (config.authToken) {
        headers['Authorization'] = `Bearer ${config.authToken}`;
      }
      if (lastEventId) {
        headers['Last-Event-ID'] = lastEventId;
      }

      const response = await fetch(pollUrl, { headers });

      if (!response.ok) {
        log.error('Ntfy polling error:', response.statusText);
        return;
      }

      const text = await response.text();
      if (!text.trim()) return;

      // Parse JSONL response
      const lines = text.trim().split('\n');
      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          // Update last event ID
          if (event.id) {
            lastEventId = event.id;
          }

          // Skip if not a message event
          if (event.event !== 'message') continue;

          // Try to parse as a question response
          let payload: { questionId?: string; answer?: string } | null = null;
          try {
            payload = JSON.parse(event.message);
          } catch {
            // Not a JSON response, might be free text
            // Check if it matches the format "questionId:answer"
            const match = event.message.match(/^([a-z0-9]+):(.+)$/i);
            if (match) {
              payload = { questionId: match[1], answer: match[2] };
            }
          }

          if (payload?.questionId && payload?.answer) {
            answerQuestion(payload.questionId, payload.answer);
            continue;
          }

          // Try processing as a command if commands are enabled
          if (config.commandsEnabled !== false) {
            try {
              const result = await handleNtfyMessage(event.message);
              await sendCommandResponse(result);
            } catch (cmdError) {
              log.error('Error handling ntfy command:', cmdError);
            }
          }
        } catch (err) {
          log.error('Error parsing ntfy event:', err);
        }
      }
    } catch (error) {
      log.error('Ntfy polling error:', error);
    }
  }, 5000); // Poll every 5 seconds
}

export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Notification helpers for common events
export async function notifyApprovalRequired(
  taskTitle: string,
  actionType: string,
  description: string
): Promise<void> {
  await sendNotification(
    'Approval Required',
    `${taskTitle}: ${description}`,
    {
      priority: 'high',
      tags: ['approval', actionType],
    }
  );
}

export async function notifyTaskCompleted(
  taskTitle: string,
  success: boolean
): Promise<void> {
  await sendNotification(
    success ? 'Task Completed' : 'Task Failed',
    taskTitle,
    {
      priority: success ? 'default' : 'high',
      tags: [success ? 'white_check_mark' : 'x'],
    }
  );
}

export async function notifyControllerStatus(
  status: string,
  message?: string
): Promise<void> {
  await sendNotification(
    `Controller ${status}`,
    message || `The Phat Controller is now ${status}`,
    {
      priority: 'low',
      tags: ['robot_face'],
    }
  );
}

// WebSocket notifications (replacing Electron safeBroadcast)
function notifyQuestionAsked(question: PendingQuestion): void {
  broadcast('ntfy:questionAsked', question);
}

function notifyQuestionAnswered(question: PendingQuestion): void {
  broadcast('ntfy:questionAnswered', question);
}

// Test connection
export async function testNtfyConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  const config = getNtfyConfig();

  if (!config.enabled) {
    return { success: false, error: 'ntfy is not enabled' };
  }

  try {
    const result = await sendNotification(
      'Connection Test',
      'This is a test notification from Phat Controller',
      { tags: ['test'] }
    );

    return { success: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
