import { IpcMain, app, BrowserWindow, dialog } from 'electron';
import { getExecutor, switchExecutor, detectModes, getDebugInfo } from '../services/executor';
import { checkForUpdates, downloadUpdate, installUpdate, getUpdateStatus, getCurrentVersion } from '../services/auto-updater';
import { settings, getSetting, setSetting, getSettings } from '../services/settings';
import { readBeadsFile, getBeadsStats, getBeadsEvents } from '../services/beads';
import {
  getProjects,
  addProject,
  removeProject,
  refreshProjects,
  discoverGitRepos,
  detectClaudeSessions,
  getSystemStatus,
} from '../services/projects';
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentPlugins,
  copyAgentToWindows,
  copyAgentToWsl,
  ClaudeAgent,
} from '../services/claude-agents';
import {
  listTasks,
  getTaskById,
  getTasksByProject,
  createTask,
  updateTask,
  deleteTask,
  getTasksStats,
  buildTaskPrompt,
  CreateTaskInput,
  UpdateTaskInput,
} from '../services/tasks';
import {
  getControllerState,
  activateController,
  deactivateController,
  pauseController,
  resumeController,
  getApprovalQueue,
  approveRequest,
  rejectRequest,
  getActionLogs,
  updateProgress,
  setProgress,
  clearProgress,
  updateTokenUsage,
  resetTokenUsage,
  setConversationSession,
  getUsageLimitConfig,
  updateUsageLimitConfig,
  getUsagePercentages,
} from '../services/controller';
import {
  getNtfyConfig,
  setNtfyConfig,
  sendNotification,
  getPendingQuestions,
  askQuestion,
  answerQuestion,
  startPolling,
  stopPolling,
  testNtfyConnection,
  NtfyConfig,
} from '../services/ntfy';
import {
  generateProjectBrief,
  getProjectBrief,
  deleteProjectBrief,
  listProjectBriefs,
  generateDeepDivePlan,
  getDeepDivePlan,
  updateDeepDivePlan,
  deleteDeepDivePlan,
  scaffoldNewProject,
  NewProjectSpec,
} from '../services/project-briefs';
import {
  createConversationSession,
  appendConversationEntry,
  loadConversation,
  listConversationSessions,
  getConversationSession,
  updateConversationSession,
  deleteConversationSession,
  getRecentConversations,
  searchConversations,
  getConversationStats,
} from '../services/conversations';
import {
  captureScreen,
  captureActiveWindow,
  analyzeScreenshot,
  verifyUIElement,
  listScreenshots,
  deleteScreenshot,
  getLatestScreenshot,
  CaptureOptions,
} from '../services/screenshot';
import {
  runTestScenario,
  createTestScenario,
  getTestScenario,
  updateTestScenario,
  deleteTestScenario,
  listTestScenarios,
  getTestResults,
  generateTestScenario,
  TestScenario,
  TestStep,
  TestExecutionConfig,
} from '../services/gui-testing';
import {
  getMCPManager,
  MCPServerConfig,
  DEFAULT_MCP_CONFIGS,
} from '../services/mcp-client';

// System prompt for Claude Code
function getSystemPrompt(): string {
  const gastownPath = settings.get('gastownPath');
  return `You are the AI Controller for Gas Town, a multi-agent orchestration system. You have access to the Gas Town workspace at ${gastownPath}. Available CLI tools: gt (Gas Town CLI for managing rigs, convoys, agents) and bd (Beads CLI for managing work items). Common commands: gt rig list, gt convoy list, bd list, bd ready. Help the user manage their multi-agent coding workflow. Be concise and helpful.`;
}

export function registerIpcHandlers(ipcMain: IpcMain): void {
  // Mode handlers
  ipcMain.handle('mode:get', () => {
    return settings.get('executionMode');
  });

  ipcMain.handle('mode:set', async (_, mode: 'windows' | 'wsl') => {
    await switchExecutor(mode);
    // Notify all windows of mode change
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('mode-changed', mode);
    });
  });

  ipcMain.handle('mode:detect', async () => {
    return detectModes();
  });

  ipcMain.handle('mode:status', async () => {
    return detectModes();
  });

  // Claude Code execution
  ipcMain.handle('claude:execute', async (_, message: string, systemPrompt?: string) => {
    const executor = await getExecutor();
    return executor.runClaude(message, systemPrompt || getSystemPrompt());
  });

  // Gas Town CLI execution
  ipcMain.handle('gt:execute', async (_, args: string[]) => {
    const executor = await getExecutor();
    return executor.runGt(args);
  });

  ipcMain.handle('bd:execute', async (_, args: string[]) => {
    const executor = await getExecutor();
    return executor.runBd(args);
  });

  // Beads handlers (direct file access for performance)
  ipcMain.handle('beads:list', async () => {
    const gastownPath = settings.get('gastownPath');
    return readBeadsFile(gastownPath);
  });

  ipcMain.handle('beads:stats', async () => {
    const gastownPath = settings.get('gastownPath');
    return getBeadsStats(gastownPath);
  });

  ipcMain.handle('beads:events', async (_, limit?: number) => {
    const gastownPath = settings.get('gastownPath');
    return getBeadsEvents(gastownPath, limit);
  });

  // Settings handlers
  ipcMain.handle('settings:get', (_, key: string) => {
    return getSetting(key as keyof typeof settings.store);
  });

  ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
    setSetting(key as keyof typeof settings.store, value as never);
  });

  ipcMain.handle('settings:getAll', () => {
    return getSettings();
  });

  // App handlers
  ipcMain.handle('app:version', () => {
    return getCurrentVersion();
  });

  ipcMain.handle('app:checkUpdates', async () => {
    return checkForUpdates();
  });

  ipcMain.handle('app:downloadUpdate', async () => {
    return downloadUpdate();
  });

  ipcMain.handle('app:installUpdate', () => {
    installUpdate();
  });

  ipcMain.handle('app:updateStatus', () => {
    return getUpdateStatus();
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  ipcMain.handle('app:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  // Project handlers
  ipcMain.handle('projects:list', () => {
    return getProjects();
  });

  ipcMain.handle('projects:add', async (_, projectPath: string) => {
    return addProject(projectPath);
  });

  ipcMain.handle('projects:remove', (_, projectId: string) => {
    removeProject(projectId);
  });

  ipcMain.handle('projects:refresh', async () => {
    return refreshProjects();
  });

  ipcMain.handle('projects:discover', async () => {
    return discoverGitRepos();
  });

  ipcMain.handle('projects:browse', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Claude session detection
  ipcMain.handle('claude:sessions', async () => {
    return detectClaudeSessions();
  });

  // Combined system status
  ipcMain.handle('system:status', async () => {
    return getSystemStatus();
  });

  // Debug info
  ipcMain.handle('app:debugInfo', async () => {
    return getDebugInfo();
  });

  // Agent handlers
  ipcMain.handle('agents:list', async () => {
    return listAgents();
  });

  ipcMain.handle('agents:get', async (_, id: string) => {
    return getAgent(id);
  });

  ipcMain.handle('agents:create', async (_, agent: Partial<ClaudeAgent>) => {
    return createAgent(agent);
  });

  ipcMain.handle('agents:update', async (_, id: string, updates: Partial<ClaudeAgent>) => {
    return updateAgent(id, updates);
  });

  ipcMain.handle('agents:delete', async (_, id: string) => {
    return deleteAgent(id);
  });

  ipcMain.handle('agents:plugins', async () => {
    return getAgentPlugins();
  });

  ipcMain.handle('agents:copyToWindows', async (_, id: string) => {
    return copyAgentToWindows(id);
  });

  ipcMain.handle('agents:copyToWsl', async (_, id: string) => {
    return copyAgentToWsl(id);
  });

  // Task handlers
  ipcMain.handle('tasks:list', async () => {
    return listTasks();
  });

  ipcMain.handle('tasks:get', async (_, id: string) => {
    return getTaskById(id);
  });

  ipcMain.handle('tasks:byProject', async (_, projectId: string) => {
    return getTasksByProject(projectId);
  });

  ipcMain.handle('tasks:create', async (_, input: CreateTaskInput) => {
    return createTask(input);
  });

  ipcMain.handle('tasks:update', async (_, id: string, updates: UpdateTaskInput) => {
    return updateTask(id, updates);
  });

  ipcMain.handle('tasks:delete', async (_, id: string) => {
    return deleteTask(id);
  });

  ipcMain.handle('tasks:stats', async () => {
    return getTasksStats();
  });

  ipcMain.handle('tasks:sendToClaude', async (_, id: string) => {
    const task = getTaskById(id);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const prompt = buildTaskPrompt(task);
    const executor = await getExecutor();

    // Run Claude Code with the task as the prompt
    return executor.runClaude(prompt, getSystemPrompt());
  });

  // Controller (Phat Controller) handlers
  ipcMain.handle('controller:getState', () => {
    return getControllerState();
  });

  ipcMain.handle('controller:activate', async () => {
    return activateController();
  });

  ipcMain.handle('controller:deactivate', async () => {
    return deactivateController();
  });

  ipcMain.handle('controller:pause', async () => {
    return pauseController();
  });

  ipcMain.handle('controller:resume', async () => {
    return resumeController();
  });

  ipcMain.handle('controller:getApprovalQueue', () => {
    return getApprovalQueue();
  });

  ipcMain.handle('controller:approveRequest', async (_, id: string) => {
    return approveRequest(id);
  });

  ipcMain.handle('controller:rejectRequest', async (_, id: string, reason?: string) => {
    return rejectRequest(id, reason);
  });

  ipcMain.handle('controller:getActionLogs', (_, limit?: number) => {
    return getActionLogs(limit);
  });

  ipcMain.handle('controller:setProgress', (_, phase: string, step: number, totalSteps: number, description: string) => {
    return setProgress(phase as 'planning' | 'executing' | 'reviewing' | 'idle', step, totalSteps, description);
  });

  ipcMain.handle('controller:clearProgress', () => {
    return clearProgress();
  });

  ipcMain.handle('controller:updateTokenUsage', (_, input: number, output: number) => {
    return updateTokenUsage(input, output);
  });

  ipcMain.handle('controller:resetTokenUsage', () => {
    return resetTokenUsage();
  });

  ipcMain.handle('controller:setConversationSession', (_, sessionId: string | null) => {
    return setConversationSession(sessionId);
  });

  ipcMain.handle('controller:getUsageLimitConfig', () => {
    return getUsageLimitConfig();
  });

  ipcMain.handle('controller:updateUsageLimitConfig', (_, config: Partial<{ maxTokensPerHour: number; maxTokensPerDay: number; pauseThreshold: number; warningThreshold: number; autoResumeOnReset: boolean }>) => {
    return updateUsageLimitConfig(config);
  });

  ipcMain.handle('controller:getUsagePercentages', () => {
    return getUsagePercentages();
  });

  // Backwards compatibility: Mayor aliases for controller
  ipcMain.handle('mayor:getState', () => {
    return getControllerState();
  });

  ipcMain.handle('mayor:activate', async () => {
    return activateController();
  });

  ipcMain.handle('mayor:deactivate', async () => {
    return deactivateController();
  });

  ipcMain.handle('mayor:pause', async () => {
    return pauseController();
  });

  ipcMain.handle('mayor:resume', async () => {
    return resumeController();
  });

  ipcMain.handle('mayor:getApprovalQueue', () => {
    return getApprovalQueue();
  });

  ipcMain.handle('mayor:approveRequest', async (_, id: string) => {
    return approveRequest(id);
  });

  ipcMain.handle('mayor:rejectRequest', async (_, id: string, reason?: string) => {
    return rejectRequest(id, reason);
  });

  ipcMain.handle('mayor:getActionLogs', (_, limit?: number) => {
    return getActionLogs(limit);
  });

  // Conversation handlers
  ipcMain.handle('conversations:create', (_, projectId: string, projectName: string) => {
    return createConversationSession(projectId, projectName);
  });

  ipcMain.handle('conversations:append', (_, sessionId: string, entry: { role: 'user' | 'assistant' | 'system'; content: string; projectId?: string; taskId?: string; tokens?: { input: number; output: number } }) => {
    return appendConversationEntry(sessionId, entry);
  });

  ipcMain.handle('conversations:load', (_, sessionId: string, options?: { limit?: number; offset?: number }) => {
    return loadConversation(sessionId, options);
  });

  ipcMain.handle('conversations:list', (_, projectId?: string) => {
    return listConversationSessions(projectId);
  });

  ipcMain.handle('conversations:get', (_, sessionId: string) => {
    return getConversationSession(sessionId);
  });

  ipcMain.handle('conversations:update', (_, sessionId: string, updates: { summary?: string; projectName?: string }) => {
    return updateConversationSession(sessionId, updates);
  });

  ipcMain.handle('conversations:delete', (_, sessionId: string) => {
    return deleteConversationSession(sessionId);
  });

  ipcMain.handle('conversations:recent', (_, limit?: number) => {
    return getRecentConversations(limit);
  });

  ipcMain.handle('conversations:search', (_, query: string, options?: { projectId?: string; limit?: number }) => {
    return searchConversations(query, options);
  });

  ipcMain.handle('conversations:stats', () => {
    return getConversationStats();
  });

  // ntfy notification handlers
  ipcMain.handle('ntfy:getConfig', () => {
    return getNtfyConfig();
  });

  ipcMain.handle('ntfy:setConfig', (_, config: Partial<NtfyConfig>) => {
    return setNtfyConfig(config);
  });

  ipcMain.handle('ntfy:sendNotification', async (_, title: string, message: string, options?: { priority?: 'min' | 'low' | 'default' | 'high' | 'urgent'; tags?: string[] }) => {
    return sendNotification(title, message, options);
  });

  ipcMain.handle('ntfy:getPendingQuestions', () => {
    return getPendingQuestions();
  });

  ipcMain.handle('ntfy:askQuestion', async (_, question: string, taskId: string, taskTitle: string, options?: { choices?: string[]; freeText?: boolean; timeoutMinutes?: number }) => {
    return askQuestion(question, taskId, taskTitle, options);
  });

  ipcMain.handle('ntfy:answerQuestion', (_, id: string, answer: string) => {
    return answerQuestion(id, answer);
  });

  ipcMain.handle('ntfy:startPolling', () => {
    return startPolling();
  });

  ipcMain.handle('ntfy:stopPolling', () => {
    return stopPolling();
  });

  ipcMain.handle('ntfy:testConnection', async () => {
    return testNtfyConnection();
  });

  // Project Briefs handlers
  ipcMain.handle('briefs:generate', async (_, projectId: string, projectPath: string, projectName: string) => {
    return generateProjectBrief(projectId, projectPath, projectName);
  });

  ipcMain.handle('briefs:get', (_, projectId: string) => {
    return getProjectBrief(projectId);
  });

  ipcMain.handle('briefs:delete', (_, projectId: string) => {
    return deleteProjectBrief(projectId);
  });

  ipcMain.handle('briefs:list', () => {
    return listProjectBriefs();
  });

  // Deep Dive Plan handlers
  ipcMain.handle('deepdive:generate', async (_, projectId: string, projectPath: string, projectName: string, focus?: string) => {
    return generateDeepDivePlan(projectId, projectPath, projectName, focus);
  });

  ipcMain.handle('deepdive:get', (_, projectId: string) => {
    return getDeepDivePlan(projectId);
  });

  ipcMain.handle('deepdive:update', (_, projectId: string, updates: { status?: 'draft' | 'approved' | 'in_progress' | 'completed'; taskUpdates?: Array<{ taskId: string; status: 'pending' | 'in_progress' | 'completed' }> }) => {
    return updateDeepDivePlan(projectId, updates);
  });

  ipcMain.handle('deepdive:delete', (_, projectId: string) => {
    return deleteDeepDivePlan(projectId);
  });

  // New Project handlers
  ipcMain.handle('project:scaffold', async (_, targetPath: string, spec: NewProjectSpec) => {
    return scaffoldNewProject(targetPath, spec);
  });

  // Screenshot handlers
  ipcMain.handle('screenshot:capture', async (_, options?: CaptureOptions) => {
    return captureScreen(options);
  });

  ipcMain.handle('screenshot:captureActiveWindow', async () => {
    return captureActiveWindow();
  });

  ipcMain.handle('screenshot:analyze', async (_, screenshotPath: string, prompt: string) => {
    return analyzeScreenshot(screenshotPath, prompt);
  });

  ipcMain.handle('screenshot:verify', async (_, description: string, screenshotPath?: string) => {
    return verifyUIElement(description, screenshotPath);
  });

  ipcMain.handle('screenshot:list', () => {
    return listScreenshots();
  });

  ipcMain.handle('screenshot:delete', (_, filePath: string) => {
    return deleteScreenshot(filePath);
  });

  ipcMain.handle('screenshot:getLatest', () => {
    return getLatestScreenshot();
  });

  // GUI Testing handlers
  ipcMain.handle('gui-test:run', async (_, scenarioId: string) => {
    const scenario = getTestScenario(scenarioId);
    if (!scenario) {
      throw new Error(`Test scenario not found: ${scenarioId}`);
    }
    return runTestScenario(scenario);
  });

  ipcMain.handle('gui-test:create', (_, scenario: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'>) => {
    return createTestScenario(scenario);
  });

  ipcMain.handle('gui-test:get', (_, id: string) => {
    return getTestScenario(id);
  });

  ipcMain.handle('gui-test:update', (_, id: string, updates: Partial<TestScenario>) => {
    return updateTestScenario(id, updates);
  });

  ipcMain.handle('gui-test:delete', (_, id: string) => {
    return deleteTestScenario(id);
  });

  ipcMain.handle('gui-test:list', () => {
    return listTestScenarios();
  });

  ipcMain.handle('gui-test:results', (_, scenarioId: string, limit?: number) => {
    return getTestResults(scenarioId, limit);
  });

  ipcMain.handle('gui-test:generate', async (_, description: string, appName?: string) => {
    return generateTestScenario(description, appName);
  });

  // Update gui-test:run to accept execution config
  ipcMain.handle('gui-test:runWithConfig', async (_, scenarioId: string, config?: Partial<TestExecutionConfig>) => {
    const scenario = getTestScenario(scenarioId);
    if (!scenario) {
      throw new Error(`Test scenario not found: ${scenarioId}`);
    }
    return runTestScenario(scenario, config);
  });

  // MCP Server Management handlers
  ipcMain.handle('mcp:getConfigs', () => {
    const manager = getMCPManager();
    return manager.getConfigs();
  });

  ipcMain.handle('mcp:getDefaultConfigs', () => {
    return DEFAULT_MCP_CONFIGS;
  });

  ipcMain.handle('mcp:addConfig', (_, config: MCPServerConfig) => {
    const manager = getMCPManager();
    manager.addConfig(config);
    return manager.getConfigs();
  });

  ipcMain.handle('mcp:removeConfig', async (_, name: string) => {
    const manager = getMCPManager();
    manager.removeConfig(name);
    return manager.getConfigs();
  });

  ipcMain.handle('mcp:connect', async (_, name: string) => {
    const manager = getMCPManager();
    await manager.connect(name);
    const server = manager.getServer(name);
    return {
      connected: server?.isConnected() || false,
      tools: server?.getAvailableTools() || [],
    };
  });

  ipcMain.handle('mcp:disconnect', async (_, name: string) => {
    const manager = getMCPManager();
    await manager.disconnect(name);
    return true;
  });

  ipcMain.handle('mcp:disconnectAll', async () => {
    const manager = getMCPManager();
    await manager.disconnectAll();
    return true;
  });

  ipcMain.handle('mcp:getConnectedServers', () => {
    const manager = getMCPManager();
    return manager.getConnectedServers();
  });

  ipcMain.handle('mcp:getServerTools', (_, name: string) => {
    const manager = getMCPManager();
    const server = manager.getServer(name);
    return server?.getAvailableTools() || [];
  });

  ipcMain.handle('mcp:callTool', async (_, serverName: string, toolName: string, args: Record<string, unknown>) => {
    const manager = getMCPManager();
    const server = manager.getServer(serverName);
    if (!server?.isConnected()) {
      throw new Error(`MCP server not connected: ${serverName}`);
    }
    // Access the underlying client to call tools
    return (server as unknown as { client: { callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> } }).client.callTool(toolName, args);
  });

  // Auto-connect enabled MCP servers on startup
  ipcMain.handle('mcp:autoConnect', async () => {
    const manager = getMCPManager();
    await manager.autoConnectEnabled();
    return manager.getConnectedServers();
  });
}
