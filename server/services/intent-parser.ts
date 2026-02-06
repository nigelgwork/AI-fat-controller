/**
 * Intent Parser for Clawdbot
 * Parses natural language commands into structured intents
 */

export type IntentType =
  | 'navigation'
  | 'task_management'
  | 'execution'
  | 'query'
  | 'settings'
  | 'unknown';

export interface Intent {
  type: IntentType;
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
  originalText: string;
}

// Navigation patterns
const NAVIGATION_PATTERNS: Array<{ pattern: RegExp; target: string }> = [
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?dashboard$/i, target: 'dashboard' },
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?tasks?(\s+page)?$/i, target: 'tasks' },
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?projects?(\s+page)?$/i, target: 'projects' },
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?settings?(\s+page)?$/i, target: 'settings' },
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?controller(\s+page)?$/i, target: 'controller' },
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?agents?(\s+page)?$/i, target: 'agents' },
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?sessions?(\s+page)?$/i, target: 'sessions' },
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?activity(\s+log)?(\s+page)?$/i, target: 'activity' },
  { pattern: /^(go to|open|show|navigate to)\s+(the\s+)?clawdbot(\s+settings)?(\s+page)?$/i, target: 'clawdbot' },
  { pattern: /^(go\s+)?home$/i, target: 'dashboard' },
];

// Task management patterns
const TASK_PATTERNS: Array<{ pattern: RegExp; action: string; extractName?: boolean }> = [
  { pattern: /^create\s+(a\s+)?task\s+(called|named)\s+["']?(.+?)["']?$/i, action: 'create', extractName: true },
  { pattern: /^add\s+(a\s+)?task\s+["']?(.+?)["']?$/i, action: 'create', extractName: true },
  { pattern: /^mark\s+["']?(.+?)["']?\s+(as\s+)?(done|complete|completed)$/i, action: 'complete', extractName: true },
  { pattern: /^complete\s+task\s+["']?(.+?)["']?$/i, action: 'complete', extractName: true },
  { pattern: /^delete\s+task\s+["']?(.+?)["']?$/i, action: 'delete', extractName: true },
  { pattern: /^remove\s+task\s+["']?(.+?)["']?$/i, action: 'delete', extractName: true },
  { pattern: /^list\s+(all\s+)?tasks$/i, action: 'list' },
  { pattern: /^show\s+(all\s+)?tasks$/i, action: 'list' },
  { pattern: /^what\s+tasks\s+(are\s+)?(pending|open|remaining)/i, action: 'list_pending' },
];

// Execution patterns
const EXECUTION_PATTERNS: Array<{ pattern: RegExp; action: string; extractName?: boolean }> = [
  { pattern: /^(run|execute|send)\s+task\s+["']?(.+?)["']?\s+(to|with)\s+claude$/i, action: 'run_task', extractName: true },
  { pattern: /^run\s+["']?(.+?)["']?\s+(task\s+)?(with|using)\s+claude$/i, action: 'run_task', extractName: true },
  { pattern: /^(stop|cancel)\s+(the\s+)?(current\s+)?execution$/i, action: 'stop' },
  { pattern: /^pause(\s+the\s+controller)?$/i, action: 'pause' },
  { pattern: /^resume(\s+the\s+controller)?$/i, action: 'resume' },
  { pattern: /^(start|activate)(\s+the\s+controller)?$/i, action: 'activate' },
  { pattern: /^(stop|deactivate)(\s+the\s+controller)?$/i, action: 'deactivate' },
];

// Query patterns
const QUERY_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  { pattern: /^how\s+many\s+tokens\s+(have\s+I\s+used\s+)?today/i, action: 'tokens_today' },
  { pattern: /^(what('s| is)\s+)?(the\s+)?token\s+usage/i, action: 'tokens_today' },
  { pattern: /^(what's|what is)\s+(the\s+)?status/i, action: 'status' },
  { pattern: /^status$/i, action: 'status' },
  { pattern: /^how\s+much\s+(have\s+I\s+)?spent/i, action: 'cost' },
  { pattern: /^(what's|what is)\s+(the\s+)?cost/i, action: 'cost' },
  { pattern: /^how\s+many\s+tasks\s+(are\s+)?(pending|open|remaining)/i, action: 'pending_tasks' },
  { pattern: /^what\s+(projects|repos)\s+(do\s+I\s+have|are\s+there)/i, action: 'list_projects' },
];

// Settings patterns
const SETTINGS_PATTERNS: Array<{ pattern: RegExp; action: string; value?: string }> = [
  { pattern: /^(change|set)\s+(the\s+)?theme\s+to\s+(dark|light)/i, action: 'theme' },
  { pattern: /^(enable|turn\s+on)\s+dark\s+mode/i, action: 'theme', value: 'dark' },
  { pattern: /^(enable|turn\s+on)\s+light\s+mode/i, action: 'theme', value: 'light' },
];

/**
 * Parse a text input into a structured intent
 */
export function parseIntent(text: string): Intent {
  const normalizedText = text.trim();

  // Try navigation patterns
  for (const { pattern, target } of NAVIGATION_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        type: 'navigation',
        action: 'navigate',
        parameters: { target },
        confidence: 0.9,
        originalText: normalizedText,
      };
    }
  }

  // Try task management patterns
  for (const { pattern, action, extractName } of TASK_PATTERNS) {
    const match = pattern.exec(normalizedText);
    if (match) {
      const parameters: Record<string, unknown> = { action };
      if (extractName && match.length > 1) {
        // Find the capture group with the task name (usually the last non-empty group)
        for (let i = match.length - 1; i >= 1; i--) {
          if (match[i] && !['a', 'called', 'named', 'as', 'done', 'complete', 'completed'].includes(match[i].toLowerCase())) {
            parameters.taskName = match[i];
            break;
          }
        }
      }
      return {
        type: 'task_management',
        action,
        parameters,
        confidence: 0.85,
        originalText: normalizedText,
      };
    }
  }

  // Try execution patterns
  for (const { pattern, action, extractName } of EXECUTION_PATTERNS) {
    const match = pattern.exec(normalizedText);
    if (match) {
      const parameters: Record<string, unknown> = {};
      if (extractName && match.length > 1) {
        for (let i = match.length - 1; i >= 1; i--) {
          if (match[i] && !['run', 'execute', 'send', 'to', 'with', 'task', 'claude', 'using'].includes(match[i].toLowerCase())) {
            parameters.taskName = match[i];
            break;
          }
        }
      }
      return {
        type: 'execution',
        action,
        parameters,
        confidence: 0.85,
        originalText: normalizedText,
      };
    }
  }

  // Try query patterns
  for (const { pattern, action } of QUERY_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        type: 'query',
        action,
        parameters: {},
        confidence: 0.8,
        originalText: normalizedText,
      };
    }
  }

  // Try settings patterns
  for (const { pattern, action, value } of SETTINGS_PATTERNS) {
    const match = pattern.exec(normalizedText);
    if (match) {
      const parameters: Record<string, unknown> = {};
      if (value) {
        parameters.value = value;
      } else if (match.length > 1) {
        // Extract value from match
        for (let i = match.length - 1; i >= 1; i--) {
          if (match[i] && ['dark', 'light', 'debug', 'info', 'warn', 'error'].includes(match[i].toLowerCase())) {
            parameters.value = match[i].toLowerCase();
            break;
          }
        }
      }
      return {
        type: 'settings',
        action,
        parameters,
        confidence: 0.8,
        originalText: normalizedText,
      };
    }
  }

  // Unknown intent - could be passed to Claude for interpretation
  return {
    type: 'unknown',
    action: 'unknown',
    parameters: { text: normalizedText },
    confidence: 0,
    originalText: normalizedText,
  };
}

/**
 * Get list of available commands for help/autocomplete
 */
export function getAvailableCommands(): Array<{ category: string; examples: string[] }> {
  return [
    {
      category: 'Navigation',
      examples: [
        'Go to dashboard',
        'Open tasks',
        'Show projects',
        'Navigate to settings',
        'Open activity log',
      ],
    },
    {
      category: 'Task Management',
      examples: [
        'Create a task called "Update README"',
        'Add task "Fix login bug"',
        'Mark "Update README" as done',
        'Delete task "Old task"',
        'List all tasks',
        'What tasks are pending?',
      ],
    },
    {
      category: 'Execution',
      examples: [
        'Run task "Update README" with Claude',
        'Pause',
        'Resume',
        'Stop current execution',
        'Activate controller',
        'Deactivate controller',
      ],
    },
    {
      category: 'Queries',
      examples: [
        'How many tokens have I used today?',
        'What\'s the status?',
        'How much have I spent?',
        'How many tasks are pending?',
      ],
    },
    {
      category: 'Settings',
      examples: [
        'Change theme to dark',
        'Enable light mode',
      ],
    },
  ];
}
