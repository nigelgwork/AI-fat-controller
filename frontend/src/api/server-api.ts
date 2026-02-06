import { apiGet, apiPost, apiPut, apiDelete } from './client';
import { wsClient } from './websocket';

// Server-side API that mirrors the ElectronAPI interface
export const serverApi = {
  // Mode
  getMode: () => apiGet('/mode'),
  setMode: (mode: string) => apiPut('/mode', { mode }),
  detectModes: () => apiGet('/mode/detect'),
  getModeStatus: () => apiGet('/mode/status'),

  // Claude Code
  executeClaudeCode: (message: string, systemPrompt?: string, projectPath?: string, imagePaths?: string[]) =>
    apiPost('/claude/execute', { message, systemPrompt, projectPath, imagePaths }),
  resumeClaudeSession: (message: string, sessionId: string, systemPrompt?: string, projectPath?: string) =>
    apiPost('/claude/resume', { message, sessionId, systemPrompt, projectPath }),
  continueClaudeSession: (message: string, systemPrompt?: string, projectPath?: string) =>
    apiPost('/claude/continue', { message, systemPrompt, projectPath }),

  // Gas Town CLI
  executeGt: (args: string[]) => apiPost('/claude/execute-gt', { args }),
  executeBd: (args: string[]) => apiPost('/claude/execute-bd', { args }),

  // Beads
  listBeads: () => apiGet('/beads'),
  getBeadsStats: () => apiGet('/beads/stats'),
  getBeadsEvents: (limit?: number) => apiGet('/beads/events', limit ? { limit: String(limit) } : undefined),

  // Settings
  getSetting: (key: string) => apiGet(`/settings/${key}`),
  setSetting: (key: string, value: any) => apiPut(`/settings/${key}`, { value }),
  getAllSettings: () => apiGet('/settings'),

  // App
  getVersion: () => apiGet('/system/version'),
  checkForUpdates: () => Promise.resolve(), // No-op in Docker
  installUpdate: () => Promise.resolve(), // No-op in Docker
  quit: () => Promise.resolve(), // No-op in Docker
  minimize: () => Promise.resolve(), // No-op in Docker
  getUpdateStatus: () => Promise.resolve({
    checking: false, available: false, downloaded: false, downloading: false,
    progress: 0, version: null, releaseNotes: null, error: null,
  }),
  downloadUpdate: () => Promise.resolve(), // No-op in Docker
  getDebugInfo: () => apiGet('/system/debug'),

  // Projects
  listProjects: () => apiGet('/projects'),
  addProject: (projectPath: string) => apiPost('/projects', { path: projectPath }),
  removeProject: (id: string) => apiDelete(`/projects/${id}`),
  refreshProjects: () => apiPost('/projects/refresh'),
  discoverProjects: () => apiGet('/projects/discover'),
  browseForProject: () => Promise.resolve(null), // No native dialog in Docker - frontend shows text input instead

  // Git clone
  cloneFromGit: (options: any) => apiPost('/projects/clone', options),
  detectProjectSetup: (projectPath: string) => apiPost('/projects/detect-setup', { projectPath }),
  runProjectSetup: (projectPath: string, commands: any[]) => apiPost('/projects/run-setup', { projectPath, commands }),
  getProjectsDirectory: () => apiGet('/projects/directory'),
  setProjectsDirectory: (dir: string) => apiPut('/projects/directory', { directory: dir }),
  getRepoInfo: (repoUrl: string) => apiPost('/projects/repo-info', { repoUrl }),
  isValidGitUrl: (url: string) => apiPost('/projects/validate-url', { url }),

  // Claude sessions (running processes)
  getClaudeSessions: () => apiGet('/claude/sessions'),

  // System status
  getSystemStatus: () => apiGet('/system/status'),

  // Agent management
  listAgents: () => apiGet('/agents'),
  getAgent: (id: string) => apiGet(`/agents/${id}`),
  createAgent: (agent: any) => apiPost('/agents', agent),
  updateAgent: (id: string, updates: any) => apiPut(`/agents/${id}`, updates),
  deleteAgent: (id: string) => apiDelete(`/agents/${id}`),
  getAgentPlugins: () => apiGet('/agents/plugins'),
  copyAgentToWindows: (id: string) => apiPost(`/agents/${id}/copy-windows`),
  copyAgentToWsl: (id: string) => apiPost(`/agents/${id}/copy-wsl`),

  // Tasks
  listTasks: () => apiGet('/tasks'),
  getTask: (id: string) => apiGet(`/tasks/${id}`),
  getTasksByProject: (projectId: string) => apiGet(`/tasks/by-project/${projectId}`),
  createTask: (input: any) => apiPost('/tasks', input),
  updateTask: (id: string, updates: any) => apiPut(`/tasks/${id}`, updates),
  deleteTask: (id: string) => apiDelete(`/tasks/${id}`),
  getTasksStats: () => apiGet('/tasks/stats'),
  sendTaskToClaude: (id: string) => apiPost(`/tasks/${id}/execute`),

  // Controller
  getControllerState: () => apiGet('/controller/state'),
  activateController: () => apiPost('/controller/activate'),
  deactivateController: () => apiPost('/controller/deactivate'),
  pauseController: () => apiPost('/controller/pause'),
  resumeController: () => apiPost('/controller/resume'),
  getApprovalQueue: () => apiGet('/controller/approvals'),
  approveRequest: (id: string) => apiPost(`/controller/approvals/${id}/approve`),
  rejectRequest: (id: string, reason?: string) => apiPost(`/controller/approvals/${id}/reject`, { reason }),
  getActionLogs: (limit?: number) => apiGet('/controller/logs', limit ? { limit: String(limit) } : undefined),
  setControllerProgress: (phase: string, step: number, totalSteps: number, description: string) =>
    apiPost('/controller/progress', { phase, step, totalSteps, description }),
  clearControllerProgress: () => apiDelete('/controller/progress'),
  updateTokenUsage: (input: number, output: number) => apiPost('/controller/token-usage', { input, output }),
  resetTokenUsage: () => apiDelete('/controller/token-usage'),
  setConversationSession: (sessionId: string | null) => apiPost('/controller/conversation-session', { sessionId }),
  getUsageLimitConfig: () => apiGet('/controller/usage-limits'),
  updateUsageLimitConfig: (config: any) => apiPut('/controller/usage-limits', config),
  getUsagePercentages: () => apiGet('/controller/usage-percentages'),

  // Backwards compatibility: Mayor aliases
  getMayorState: () => apiGet('/controller/state'),
  activateMayor: () => apiPost('/controller/activate'),
  deactivateMayor: () => apiPost('/controller/deactivate'),
  pauseMayor: () => apiPost('/controller/pause'),
  resumeMayor: () => apiPost('/controller/resume'),

  // Conversations
  createConversationSession: (projectId: string, projectName: string) =>
    apiPost('/conversations', { projectId, projectName }),
  appendConversationEntry: (sessionId: string, entry: any) =>
    apiPost(`/conversations/${sessionId}/entries`, entry),
  loadConversation: (sessionId: string, options?: any) =>
    apiGet(`/conversations/${sessionId}/entries`, options ? {
      ...(options.limit ? { limit: String(options.limit) } : {}),
      ...(options.offset ? { offset: String(options.offset) } : {}),
    } : undefined),
  listConversationSessions: (projectId?: string) =>
    apiGet('/conversations', projectId ? { projectId } : undefined),
  getConversationSession: (sessionId: string) => apiGet(`/conversations/${sessionId}`),
  updateConversationSession: (sessionId: string, updates: any) =>
    apiPut(`/conversations/${sessionId}`, updates),
  deleteConversationSession: (sessionId: string) => apiDelete(`/conversations/${sessionId}`),
  getRecentConversations: (limit?: number) =>
    apiGet('/conversations/recent', limit ? { limit: String(limit) } : undefined),
  searchConversations: (query: string, options?: any) =>
    apiGet('/conversations/search', { query, ...options }),
  getConversationStats: () => apiGet('/conversations/stats'),

  // Claude session linking
  linkClaudeSession: (appSessionId: string, claudeSessionId: string, claudeSessionPath?: string) =>
    apiPost(`/conversations/${appSessionId}/link-claude`, { claudeSessionId, claudeSessionPath }),
  getResumableSessions: (projectId?: string) =>
    apiGet('/conversations/resumable', projectId ? { projectId } : undefined),
  unlinkClaudeSession: (appSessionId: string) =>
    apiDelete(`/conversations/${appSessionId}/link-claude`),
  findSessionByClaudeId: (claudeSessionId: string) =>
    apiGet(`/conversations/by-claude-id/${claudeSessionId}`),

  // Claude Code Sessions
  listClaudeCodeSessions: (projectPath?: string) =>
    apiGet('/claude-sessions', projectPath ? { projectPath } : undefined),
  getClaudeCodeSession: (sessionId: string) => apiGet(`/claude-sessions/${sessionId}`),
  canResumeClaudeSession: (sessionId: string) => apiGet(`/claude-sessions/${sessionId}/can-resume`),
  findLatestClaudeSession: (projectPath: string) =>
    apiGet('/claude-sessions/latest', { projectPath }),
  getRecentClaudeSessions: (limit?: number) =>
    apiGet('/claude-sessions/recent', limit ? { limit: String(limit) } : undefined),

  // ntfy
  getNtfyConfig: () => apiGet('/ntfy/config'),
  setNtfyConfig: (config: any) => apiPut('/ntfy/config', config),
  sendNtfyNotification: (title: string, message: string, options?: any) =>
    apiPost('/ntfy/notify', { title, message, ...options }),
  getPendingQuestions: () => apiGet('/ntfy/questions'),
  askNtfyQuestion: (question: string, taskId: string, taskTitle: string, options?: any) =>
    apiPost('/ntfy/questions', { question, taskId, taskTitle, ...options }),
  answerNtfyQuestion: (id: string, answer: string) =>
    apiPut(`/ntfy/questions/${id}`, { answer }),
  startNtfyPolling: () => apiPost('/ntfy/polling/start'),
  stopNtfyPolling: () => apiPost('/ntfy/polling/stop'),
  testNtfyConnection: () => apiPost('/ntfy/test'),
  executeNtfyCommand: (message: string) => apiPost('/ntfy/command', { message }),

  // Status Reporter
  startStatusReporter: () => apiPost('/ntfy/status-reporter/start'),
  stopStatusReporter: () => apiPost('/ntfy/status-reporter/stop'),
  restartStatusReporter: () => apiPost('/ntfy/status-reporter/restart'),

  // Project Briefs
  generateProjectBrief: (projectId: string, projectPath: string, projectName: string) =>
    apiPost('/briefs/generate', { projectId, projectPath, projectName }),
  getProjectBrief: (projectId: string) => apiGet(`/briefs/${projectId}`),
  deleteProjectBrief: (projectId: string) => apiDelete(`/briefs/${projectId}`),
  listProjectBriefs: () => apiGet('/briefs'),

  // Deep Dive Plans
  generateDeepDivePlan: (projectId: string, projectPath: string, projectName: string, focus?: string) =>
    apiPost('/briefs/deep-dive/generate', { projectId, projectPath, projectName, focus }),
  getDeepDivePlan: (projectId: string) => apiGet(`/briefs/deep-dive/${projectId}`),
  updateDeepDivePlan: (projectId: string, updates: any) =>
    apiPut(`/briefs/deep-dive/${projectId}`, updates),
  deleteDeepDivePlan: (projectId: string) => apiDelete(`/briefs/deep-dive/${projectId}`),
  executeDeepDiveTask: (projectId: string, taskId: string) =>
    apiPost(`/briefs/deep-dive/${projectId}/execute/${taskId}`),
  cancelDeepDiveTask: (projectId: string, taskId: string) =>
    apiPost(`/briefs/deep-dive/${projectId}/cancel/${taskId}`),
  convertDeepDiveToTasks: (projectId: string, options?: any) =>
    apiPost(`/briefs/deep-dive/${projectId}/convert`, options),
  convertDeepDiveTaskToProjectTask: (projectId: string, taskId: string) =>
    apiPost(`/briefs/deep-dive/${projectId}/convert/${taskId}`),

  // New Project
  scaffoldNewProject: (targetPath: string, spec: any) =>
    apiPost('/projects/scaffold', { targetPath, spec }),

  // Screenshots
  captureScreen: (options?: any) => apiPost('/screenshots/capture', options),
  captureActiveWindow: () => apiPost('/screenshots/capture-active'),
  analyzeScreenshot: (screenshotPath: string, prompt: string) =>
    apiPost('/screenshots/analyze', { screenshotPath, prompt }),
  verifyUIElement: (description: string, screenshotPath?: string) =>
    apiPost('/screenshots/verify', { description, screenshotPath }),
  listScreenshots: () => apiGet('/screenshots'),
  deleteScreenshot: (filePath: string) => apiDelete(`/screenshots?path=${encodeURIComponent(filePath)}`),
  getLatestScreenshot: () => apiGet('/screenshots/latest'),

  // GUI Testing
  runGuiTest: (scenarioId: string) => apiPost(`/gui-tests/${scenarioId}/run`),
  createGuiTest: (scenario: any) => apiPost('/gui-tests', scenario),
  getGuiTest: (id: string) => apiGet(`/gui-tests/${id}`),
  updateGuiTest: (id: string, updates: any) => apiPut(`/gui-tests/${id}`, updates),
  deleteGuiTest: (id: string) => apiDelete(`/gui-tests/${id}`),
  listGuiTests: () => apiGet('/gui-tests'),
  getGuiTestResults: (scenarioId: string, limit?: number) =>
    apiGet(`/gui-tests/${scenarioId}/results`, limit ? { limit: String(limit) } : undefined),
  generateGuiTest: (description: string, appName?: string) =>
    apiPost('/gui-tests/generate', { description, appName }),
  runGuiTestWithConfig: (scenarioId: string, config?: any) =>
    apiPost(`/gui-tests/${scenarioId}/run-with-config`, config),

  // MCP
  getMcpConfigs: () => apiGet('/mcp/configs'),
  getMcpDefaultConfigs: () => apiGet('/mcp/configs/defaults'),
  addMcpConfig: (config: any) => apiPost('/mcp/configs', config),
  removeMcpConfig: (name: string) => apiDelete(`/mcp/configs/${encodeURIComponent(name)}`),
  connectMcpServer: (name: string) => apiPost(`/mcp/connect/${encodeURIComponent(name)}`),
  disconnectMcpServer: (name: string) => apiPost(`/mcp/disconnect/${encodeURIComponent(name)}`),
  disconnectAllMcpServers: () => apiPost('/mcp/disconnect-all'),
  getConnectedMcpServers: () => apiGet('/mcp/connected'),
  getMcpServerTools: (name: string) => apiGet(`/mcp/tools/${encodeURIComponent(name)}`),
  callMcpTool: (serverName: string, toolName: string, args: any) =>
    apiPost(`/mcp/tools/${encodeURIComponent(serverName)}/${encodeURIComponent(toolName)}`, args),
  autoConnectMcpServers: () => apiPost('/mcp/auto-connect'),

  // Images
  saveImageToTemp: (base64Data: string, filename: string) =>
    apiPost('/images/save-temp', { base64Data, filename }),
  cleanupTempImages: () => apiPost('/images/cleanup'),

  // Clawdbot Personality
  getPersonalities: () => apiGet('/clawdbot/personalities'),
  getPersonality: (id: string) => apiGet(`/clawdbot/personalities/${id}`),
  getCurrentPersonality: () => apiGet('/clawdbot/personality/current'),
  getCurrentPersonalityId: () => apiGet('/clawdbot/personality/current-id'),
  setCurrentPersonality: (id: string) => apiPut('/clawdbot/personality/current', { id }),
  savePersonality: (personality: any) => apiPost('/clawdbot/personalities', personality),
  deletePersonality: (id: string) => apiDelete(`/clawdbot/personalities/${id}`),
  getClawdbotGreeting: () => apiGet('/clawdbot/greeting'),

  // Token History
  getTokenHistory: (days?: number) => apiGet('/token-history', days ? { days: String(days) } : undefined),
  getTokenHistoryTotal: (days?: number) => apiGet('/token-history/total', days ? { days: String(days) } : undefined),
  getTokenHistoryAverage: (days?: number) => apiGet('/token-history/average', days ? { days: String(days) } : undefined),
  clearTokenHistory: () => apiDelete('/token-history'),

  // Activity Log
  getActivityLogs: (options?: any) => apiGet('/activity', options ? Object.fromEntries(
    Object.entries(options).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])
  ) : undefined),
  searchActivityLogs: (query: string, filters?: any) =>
    apiGet('/activity/search', { query, ...filters }),
  exportActivityLogs: (format: string, dateRange?: any) =>
    apiGet('/activity/export', { format, ...dateRange }),
  getActivitySummary: (dateRange?: any) => apiGet('/activity/summary', dateRange),
  clearActivityLogs: () => apiDelete('/activity'),

  // Clawdbot Intent/Action
  parseIntent: (text: string) => apiPost('/clawdbot/parse-intent', { text }),
  dispatchAction: (intent: any, claudeSessionId?: string) =>
    apiPost('/clawdbot/dispatch-action', { intent, claudeSessionId }),
  executeConfirmedAction: (confirmationMessage: string) =>
    apiPost('/clawdbot/execute-confirmed', { confirmationMessage }),
  getAvailableCommands: () => apiGet('/clawdbot/commands'),

  // Clawdbot Messages
  getClawdbotMessages: () => apiGet('/clawdbot/messages'),
  addClawdbotMessage: (message: any) => apiPost('/clawdbot/messages', message),
  clearClawdbotMessages: () => apiDelete('/clawdbot/messages'),

  // Execution Sessions
  getActiveSessions: () => apiGet('/sessions/active'),
  getSessionHistory: (limit?: number) => apiGet('/sessions/history', limit ? { limit: String(limit) } : undefined),
  getSession: (id: string) => apiGet(`/sessions/${id}`),
  getSessionLogs: (id: string, limit?: number) =>
    apiGet(`/sessions/${id}/logs`, limit ? { limit: String(limit) } : undefined),
  cancelSession: (id: string) => apiPost(`/sessions/${id}/cancel`),

  // Event listeners via WebSocket
  onSessionUpdate: (callback: (data: any) => void) => wsClient.subscribe('session:updated', callback),
  onSessionLog: (callback: (data: any) => void) => wsClient.subscribe('session:log', callback),
  onUpdateChecking: (callback: () => void) => wsClient.subscribe('update:checking', callback),
  onUpdateAvailable: (callback: (data: any) => void) => wsClient.subscribe('update:available', callback),
  onUpdateNotAvailable: (callback: () => void) => wsClient.subscribe('update:not-available', callback),
  onUpdateProgress: (callback: (data: any) => void) => wsClient.subscribe('update:progress', callback),
  onUpdateDownloaded: (callback: (data: any) => void) => wsClient.subscribe('update:downloaded', callback),
  onUpdateError: (callback: (data: any) => void) => wsClient.subscribe('update:error', callback),
  onModeChanged: (callback: (mode: any) => void) => wsClient.subscribe('mode-changed', callback),
  onControllerStateChanged: (callback: (state: any) => void) => wsClient.subscribe('controller:stateChanged', callback),
  onApprovalRequired: (callback: (request: any) => void) => wsClient.subscribe('controller:approvalRequired', callback),
  onActionCompleted: (callback: (log: any) => void) => wsClient.subscribe('controller:actionCompleted', callback),
  onProgressUpdated: (callback: (progress: any) => void) => wsClient.subscribe('controller:progressUpdated', callback),
  onUsageWarning: (callback: (data: any) => void) => wsClient.subscribe('controller:usageWarning', callback),
  onGuiTestProgress: (callback: (data: any) => void) => wsClient.subscribe('gui-test:progress', callback),
  onGuiTestComplete: (callback: (result: any) => void) => wsClient.subscribe('gui-test:complete', callback),
  onMayorStateChanged: (callback: (state: any) => void) => wsClient.subscribe('controller:stateChanged', callback),
  onNtfyQuestionAsked: (callback: (question: any) => void) => wsClient.subscribe('ntfy:questionAsked', callback),
  onNtfyQuestionAnswered: (callback: (question: any) => void) => wsClient.subscribe('ntfy:questionAnswered', callback),
  onExecutorLog: (callback: (log: any) => void) => wsClient.subscribe('executor-log', callback),
  onCloneProgress: (callback: (progress: any) => void) => wsClient.subscribe('clone:progress', callback),
  onSetupProgress: (callback: (progress: any) => void) => wsClient.subscribe('setup:progress', callback),
};
