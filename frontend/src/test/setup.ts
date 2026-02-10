import '@testing-library/jest-dom';
import { vi, afterAll, afterEach } from 'vitest';

// Mock the API module
const mockApi = {
  // Mode
  getMode: vi.fn().mockResolvedValue('linux'),
  setMode: vi.fn().mockResolvedValue(undefined),
  detectModes: vi.fn().mockResolvedValue({
    current: 'linux',
    windows: { available: false },
    wsl: { available: false },
  }),
  getModeStatus: vi.fn().mockResolvedValue({
    current: 'linux',
    windows: { available: false },
    wsl: { available: false },
  }),

  // Claude Code
  executeClaudeCode: vi.fn().mockResolvedValue({
    success: true,
    response: 'Mock response',
    duration: 100,
  }),

  // Settings
  getSetting: vi.fn().mockImplementation((key: string) => {
    const defaults: Record<string, unknown> = {
      executionMode: 'linux',
      theme: 'dark',
    };
    return Promise.resolve(defaults[key]);
  }),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getAllSettings: vi.fn().mockResolvedValue({
    executionMode: 'linux',
    defaultMode: 'auto',
    windows: {},
    wsl: {},
    theme: 'dark',
    hasCompletedSetup: true,
  }),

  // App
  getVersion: vi.fn().mockResolvedValue('0.8.0-test'),
  checkForUpdates: vi.fn().mockResolvedValue(undefined),
  installUpdate: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue(undefined),
  minimize: vi.fn().mockResolvedValue(undefined),

  // Projects
  listProjects: vi.fn().mockResolvedValue([]),
  addProject: vi.fn().mockResolvedValue({
    id: 'test-project',
    name: 'Test Project',
    path: '/test/project',
    hasClaude: true,
  }),
  removeProject: vi.fn().mockResolvedValue(undefined),
  refreshProjects: vi.fn().mockResolvedValue([]),
  discoverProjects: vi.fn().mockResolvedValue([]),
  browseForProject: vi.fn().mockResolvedValue(null),
  browseFilesystem: vi.fn().mockResolvedValue({
    currentPath: '/home/user',
    parentPath: '/',
    entries: [],
    roots: [{ label: 'Home', path: '/home/user', type: 'home' }],
  }),

  // Tasks
  listTasks: vi.fn().mockResolvedValue([]),
  getTask: vi.fn().mockResolvedValue(null),
  getTasksByProject: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockImplementation((input) =>
    Promise.resolve({
      id: 'test-task-id',
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  ),
  updateTask: vi.fn().mockResolvedValue(null),
  deleteTask: vi.fn().mockResolvedValue(true),
  getTasksStats: vi.fn().mockResolvedValue({
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    byPriority: { low: 0, medium: 0, high: 0 },
  }),
  sendTaskToClaude: vi.fn().mockResolvedValue({
    success: true,
    response: 'Mock response',
    duration: 100,
  }),

  // Controller
  getControllerState: vi.fn().mockResolvedValue({
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
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      limit: 200000,
      resetAt: new Date(Date.now() + 3600000).toISOString(),
    },
    usageLimitConfig: {
      maxTokensPerHour: 200000,
      maxTokensPerDay: 1000000,
      pauseThreshold: 0.8,
      warningThreshold: 0.6,
      autoResumeOnReset: true,
    },
    dailyTokenUsage: { input: 0, output: 0, date: new Date().toISOString().split('T')[0] },
    usageLimitStatus: 'ok',
    pausedDueToLimit: false,
  }),
  activateController: vi.fn().mockResolvedValue(undefined),
  deactivateController: vi.fn().mockResolvedValue(undefined),
  pauseController: vi.fn().mockResolvedValue(undefined),
  resumeController: vi.fn().mockResolvedValue(undefined),
  getApprovalQueue: vi.fn().mockResolvedValue([]),
  approveRequest: vi.fn().mockResolvedValue(undefined),
  rejectRequest: vi.fn().mockResolvedValue(undefined),
  getActionLogs: vi.fn().mockResolvedValue([]),
  getUsageLimitConfig: vi.fn().mockResolvedValue({
    maxTokensPerHour: 200000,
    maxTokensPerDay: 1000000,
    pauseThreshold: 0.8,
    warningThreshold: 0.6,
    autoResumeOnReset: true,
  }),
  updateUsageLimitConfig: vi.fn().mockResolvedValue(undefined),
  getUsagePercentages: vi.fn().mockResolvedValue({ hourly: 0, daily: 0 }),

  // Conversations
  createConversationSession: vi.fn().mockImplementation((projectId, projectName) =>
    Promise.resolve({
      id: 'test-session-id',
      projectId,
      projectName,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      entryCount: 0,
      totalTokens: { input: 0, output: 0 },
    })
  ),
  appendConversationEntry: vi.fn().mockResolvedValue({
    id: 'test-entry-id',
    timestamp: new Date().toISOString(),
    role: 'user',
    content: 'Test content',
  }),
  loadConversation: vi.fn().mockResolvedValue([]),
  listConversationSessions: vi.fn().mockResolvedValue([]),
  getConversationSession: vi.fn().mockResolvedValue(null),
  updateConversationSession: vi.fn().mockResolvedValue(null),
  deleteConversationSession: vi.fn().mockResolvedValue(true),
  getRecentConversations: vi.fn().mockResolvedValue([]),
  searchConversations: vi.fn().mockResolvedValue([]),
  getConversationStats: vi.fn().mockResolvedValue({
    totalSessions: 0,
    totalEntries: 0,
    totalTokens: { input: 0, output: 0 },
    sessionsByProject: {},
  }),

  // Agents
  listAgents: vi.fn().mockResolvedValue([]),
  getAgent: vi.fn().mockResolvedValue(null),
  createAgent: vi.fn().mockResolvedValue({
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent',
    content: 'Test content',
    filePath: '/test/agent.md',
    pluginName: 'custom-agents',
    isCustom: true,
  }),
  updateAgent: vi.fn().mockResolvedValue(null),
  deleteAgent: vi.fn().mockResolvedValue(undefined),
  getAgentPlugins: vi.fn().mockResolvedValue([]),

  // Token History
  getTokenHistory: vi.fn().mockResolvedValue([]),
  getTokenHistoryTotal: vi.fn().mockResolvedValue({ input: 0, output: 0 }),
  getTokenHistoryAverage: vi.fn().mockResolvedValue({ input: 0, output: 0 }),
  clearTokenHistory: vi.fn().mockResolvedValue({ success: true }),

  // ntfy
  getNtfyConfig: vi.fn().mockResolvedValue({
    enabled: false,
    serverUrl: '',
    topic: '',
    priority: 'default',
    enableDesktopNotifications: false,
    commandsEnabled: false,
    autoStartOnTask: false,
    statusReporter: {
      enabled: false,
      intervalMinutes: 30,
      notifyOnTaskStart: false,
      notifyOnTaskComplete: false,
      notifyOnTaskFail: false,
      notifyOnApprovalNeeded: false,
      notifyOnTokenWarning: false,
    },
  }),
  setNtfyConfig: vi.fn().mockResolvedValue(undefined),
  testNtfyConnection: vi.fn().mockResolvedValue({ success: true }),

  // System
  getDebugInfo: vi.fn().mockResolvedValue({
    nodeVersion: 'v20.0.0',
    platform: 'linux',
    claudePath: '/test/claude',
    executionMode: 'linux',
  }),
  getClaudeSessions: vi.fn().mockResolvedValue([]),
  getSystemStatus: vi.fn().mockResolvedValue({
    projects: [],
    sessions: [],
    discovered: [],
  }),
  getUpdateStatus: vi.fn().mockResolvedValue({
    checking: false,
    available: false,
    downloaded: false,
    downloading: false,
    progress: 0,
    version: null,
    releaseNotes: null,
    error: null,
  }),
  downloadUpdate: vi.fn().mockResolvedValue(undefined),

  // MCP
  getMcpConfigs: vi.fn().mockResolvedValue([]),
  getMcpDefaultConfigs: vi.fn().mockResolvedValue([]),

  // System metrics (DiagnosticsBar)
  getSystemMetrics: vi.fn().mockResolvedValue({
    system: { cpuPercent: 10, cpuCores: 8, memTotal: 8000000000, memUsed: 4000000000, memPercent: 50 },
    app: { memRss: 100000000, memHeapUsed: 50000000, memHeapTotal: 80000000, uptime: 100 },
  }),
  getClaudeUsage: vi.fn().mockResolvedValue({
    subscription: 'unknown', rateLimitTier: 'unknown',
    source: 'api',
    session: { percent: 0, resetsAt: null },
    week: { percent: 0, resetsAt: null },
    weekOpus: null, weekSonnet: null, extraUsage: null,
  }),

  // Skills
  listSkills: vi.fn().mockResolvedValue([]),

  // ntfy questions
  getPendingQuestions: vi.fn().mockResolvedValue([]),

  // Event listeners - return cleanup functions
  onUpdateChecking: vi.fn().mockReturnValue(() => {}),
  onUpdateAvailable: vi.fn().mockReturnValue(() => {}),
  onUpdateNotAvailable: vi.fn().mockReturnValue(() => {}),
  onUpdateProgress: vi.fn().mockReturnValue(() => {}),
  onUpdateDownloaded: vi.fn().mockReturnValue(() => {}),
  onUpdateError: vi.fn().mockReturnValue(() => {}),
  onModeChanged: vi.fn().mockReturnValue(() => {}),
  onControllerStateChanged: vi.fn().mockReturnValue(() => {}),
  onApprovalRequired: vi.fn().mockReturnValue(() => {}),
  onActionCompleted: vi.fn().mockReturnValue(() => {}),
  onProgressUpdated: vi.fn().mockReturnValue(() => {}),
  onUsageWarning: vi.fn().mockReturnValue(() => {}),
  onExecutorLog: vi.fn().mockReturnValue(() => {}),
  onSessionUpdate: vi.fn().mockReturnValue(() => {}),
  onSessionLog: vi.fn().mockReturnValue(() => {}),
  onNtfyQuestionAsked: vi.fn().mockReturnValue(() => {}),
  onNtfyQuestionAnswered: vi.fn().mockReturnValue(() => {}),
  onCloneProgress: vi.fn().mockReturnValue(() => {}),
  onSetupProgress: vi.fn().mockReturnValue(() => {}),
};

// Mock the @/api module
vi.mock('../api', () => ({
  api: mockApi,
  initApi: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.resetAllMocks();
});

// Export for use in individual tests
export { mockApi as mockElectronAPI };
