import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock electronAPI for all tests
const mockElectronAPI = {
  // Mode
  getMode: vi.fn().mockResolvedValue('windows'),
  setMode: vi.fn().mockResolvedValue(undefined),
  detectModes: vi.fn().mockResolvedValue({
    current: 'windows',
    windows: { available: true },
    wsl: { available: false },
  }),
  getModeStatus: vi.fn().mockResolvedValue({
    current: 'windows',
    windows: { available: true },
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
      executionMode: 'windows',
      theme: 'dark',
      startMinimized: false,
      minimizeToTray: true,
    };
    return Promise.resolve(defaults[key]);
  }),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getAllSettings: vi.fn().mockResolvedValue({
    executionMode: 'windows',
    defaultMode: 'auto',
    windows: {},
    wsl: {},
    gastownPath: '',
    theme: 'dark',
    startMinimized: false,
    minimizeToTray: true,
    showModeToggle: true,
    autoCheckUpdates: true,
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
    hasBeads: false,
    hasClaude: true,
  }),
  removeProject: vi.fn().mockResolvedValue(undefined),
  refreshProjects: vi.fn().mockResolvedValue([]),
  discoverProjects: vi.fn().mockResolvedValue([]),
  browseForProject: vi.fn().mockResolvedValue(null),

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

  // Additional mocks can be added as needed
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
  getDebugInfo: vi.fn().mockResolvedValue({
    isPackaged: false,
    resourcesPath: '/test/resources',
    gtPath: '/test/gt',
    gtExists: true,
    bdPath: '/test/bd',
    bdExists: true,
    claudePath: '/test/claude',
    gastownPath: '/test/gastown',
    gastownExists: true,
    executionMode: 'windows',
  }),
  getClaudeSessions: vi.fn().mockResolvedValue([]),
  getSystemStatus: vi.fn().mockResolvedValue({
    projects: [],
    sessions: [],
    discovered: [],
  }),
};

// Expose the mock globally
beforeAll(() => {
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.resetAllMocks();
});

// Export for use in individual tests
export { mockElectronAPI };
