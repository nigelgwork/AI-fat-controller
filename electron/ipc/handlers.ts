import { IpcMain, app, dialog, BrowserWindow } from 'electron';
import { safeBroadcast } from '../utils/safe-ipc';
import {
  ExecutionModeSchema,
  CommandArgsSchema,
  NonEmptyStringSchema,
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
  UsageLimitConfigSchema,
  ConversationEntryInputSchema,
  NtfyConfigSchema,
  assertValid,
  isValidId,
} from '../utils/ipc-validation';
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
import fs from 'fs';
import path from 'path';
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
  executeDeepDiveTask,
  convertDeepDiveToTasks,
  convertSingleTaskToProjectTask,
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
import {
  isTmuxAvailable,
  getTmuxStatus,
  listSessions as listTmuxSessions,
  createSession as createTmuxSession,
  attachSession as attachTmuxSession,
  killSession as killTmuxSession,
  getSessionHistory as getTmuxSessionHistory,
  sendKeys as sendTmuxKeys,
  updateSessionMeta,
  renameSession as renameTmuxSession,
  TmuxSession,
} from '../services/tmux';
import {
  getPersonalities,
  getPersonality,
  getCurrentPersonality,
  getCurrentPersonalityId,
  setCurrentPersonality,
  savePersonality,
  deletePersonality,
  buildSystemPrompt,
  getGreeting,
  ClawdbotPersonality,
} from '../services/clawdbot';
import {
  getTokenHistory,
  getTotalUsageForPeriod,
  getAverageDailyUsage,
  clearTokenHistory,
} from '../stores/token-history';

// System prompt for Claude Code (ClawdBot)
function getSystemPrompt(): string {
  const gastownPath = settings.get('gastownPath');

  const basePrompt = `You are Clawdbot, the AI assistant for the AI Fat Controller desktop application.

## About AI Fat Controller
AI Fat Controller is an Electron desktop app built with React/TypeScript that helps users manage and orchestrate AI coding projects. It provides:

### Core Features
1. **Projects Management** - Add, discover, and track git repositories
2. **Project Briefs** - AI-generated summaries of project structure, tech stack, and key files
3. **Deep Dive Plans** - AI-generated implementation plans with executable tasks
   - Tasks can be executed by clicking the play button
   - Execution uses Claude Code to perform the task
   - Risky operations (git push, refactoring) require approval
4. **Controller** - An autonomous AI project manager that processes tasks
5. **Chat Interface** - Where users talk to you (Clawdbot)
6. **Settings** - Configure execution mode (Windows/WSL), notifications, MCP servers

### Pages in the App
- **Dashboard** - Overview of projects, sessions, and beads
- **Projects** - List projects, generate briefs, create deep dive plans
- **Beads** - Work item tracking (issues)
- **Controller** - Phat Controller for autonomous task processing
- **Sessions** - tmux session management for Claude Code instances
- **GUI Testing** - Visual testing capabilities
- **Settings** - App configuration

### Technical Details
- Built with Electron + React + TypeScript + Tailwind CSS
- Uses Claude Code CLI for AI execution
- Supports Windows native and WSL execution modes
- Stores data using electron-store
- Gas Town workspace path: ${gastownPath}

### What You Can Help With
- Explaining how features work in the app
- Guiding users through creating projects and briefs
- Helping with deep dive plan creation and execution
- Troubleshooting issues with Claude Code integration
- General coding assistance within selected project context
- Answering questions about the app's architecture

When a project context is selected, you have access to information about that specific project.`;

  // Apply personality if available
  const personality = getCurrentPersonality();
  if (personality) {
    return buildSystemPrompt(personality, basePrompt);
  }

  return basePrompt + '\n\nBe helpful, concise, and friendly.';
}

export function registerIpcHandlers(ipcMain: IpcMain): void {
  // Mode handlers
  ipcMain.handle('mode:get', () => {
    return settings.get('executionMode');
  });

  ipcMain.handle('mode:set', async (_, mode: unknown) => {
    const validMode = assertValid(ExecutionModeSchema, mode, 'execution mode');
    await switchExecutor(validMode);
    // Notify all windows of mode change
    safeBroadcast('mode-changed', validMode);
  });

  ipcMain.handle('mode:detect', async () => {
    return detectModes();
  });

  ipcMain.handle('mode:status', async () => {
    return detectModes();
  });

  // Claude Code execution
  ipcMain.handle('claude:execute', async (_, message: string, systemPrompt?: string, projectPath?: string, imagePaths?: string[]) => {
    const executor = await getExecutor();
    return executor.runClaude(message, systemPrompt || getSystemPrompt(), projectPath, imagePaths);
  });

  // Gas Town CLI execution
  ipcMain.handle('gt:execute', async (_, args: unknown) => {
    const validArgs = assertValid(CommandArgsSchema, args, 'command arguments');
    const executor = await getExecutor();
    return executor.runGt(validArgs);
  });

  ipcMain.handle('bd:execute', async (_, args: unknown) => {
    const validArgs = assertValid(CommandArgsSchema, args, 'command arguments');
    const executor = await getExecutor();
    return executor.runBd(validArgs);
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

  ipcMain.handle('tasks:create', async (_, input: unknown) => {
    const validInput = assertValid(CreateTaskInputSchema, input, 'task input');
    return createTask(validInput as CreateTaskInput);
  });

  ipcMain.handle('tasks:update', async (_, id: unknown, updates: unknown) => {
    if (!isValidId(id)) {
      throw new Error('Invalid task ID');
    }
    const validUpdates = assertValid(UpdateTaskInputSchema, updates, 'task updates');
    return updateTask(id, validUpdates as UpdateTaskInput);
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

  ipcMain.handle('controller:updateTokenUsage', (_, input: unknown, output: unknown) => {
    const validInput = typeof input === 'number' && input >= 0 ? input : 0;
    const validOutput = typeof output === 'number' && output >= 0 ? output : 0;
    return updateTokenUsage(validInput, validOutput);
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

  ipcMain.handle('controller:updateUsageLimitConfig', (_, config: unknown) => {
    const validConfig = assertValid(UsageLimitConfigSchema, config, 'usage limit config');
    return updateUsageLimitConfig(validConfig);
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

  ipcMain.handle('deepdive:executeTask', async (_, projectId: string, taskId: string) => {
    return executeDeepDiveTask(projectId, taskId);
  });

  ipcMain.handle('deepdive:cancelTask', async (_, projectId: string, taskId: string) => {
    const { cancelExecution } = await import('../services/executor');
    const executionId = `deepdive-${projectId}-${taskId}`;
    const cancelled = cancelExecution(executionId);
    if (cancelled) {
      // Update task status back to pending
      const { updateDeepDivePlan } = await import('../services/project-briefs');
      updateDeepDivePlan(projectId, {
        taskUpdates: [{
          taskId,
          status: 'pending',
        }],
      });
    }
    return { cancelled };
  });

  // Convert Deep Dive tasks to project tasks
  ipcMain.handle('deepdive:convertToTasks', (_, projectId: string, options?: { phaseIds?: string[]; taskIds?: string[] }) => {
    return convertDeepDiveToTasks(projectId, options);
  });

  ipcMain.handle('deepdive:convertTaskToProjectTask', (_, projectId: string, taskId: string) => {
    return convertSingleTaskToProjectTask(projectId, taskId);
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
    interface MCPServerWithClient {
      client: {
        callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
      };
    }
    return (server as unknown as MCPServerWithClient).client.callTool(toolName, args);
  });

  // Auto-connect enabled MCP servers on startup
  ipcMain.handle('mcp:autoConnect', async () => {
    const manager = getMCPManager();
    await manager.autoConnectEnabled();
    return manager.getConnectedServers();
  });

  // ============================================
  // tmux Session Management handlers
  // ============================================
  ipcMain.handle('tmux:available', async () => {
    return isTmuxAvailable();
  });

  ipcMain.handle('tmux:status', async () => {
    return getTmuxStatus();
  });

  ipcMain.handle('tmux:list', async () => {
    return listTmuxSessions();
  });

  ipcMain.handle('tmux:create', async (_, name: string, projectId?: string, cwd?: string) => {
    return createTmuxSession(name, projectId, cwd);
  });

  ipcMain.handle('tmux:attach', async (_, name: string) => {
    return attachTmuxSession(name);
  });

  ipcMain.handle('tmux:kill', async (_, name: string) => {
    return killTmuxSession(name);
  });

  ipcMain.handle('tmux:history', async (_, name: string, lines?: number) => {
    return getTmuxSessionHistory(name, lines);
  });

  ipcMain.handle('tmux:sendKeys', async (_, name: string, keys: string) => {
    return sendTmuxKeys(name, keys);
  });

  ipcMain.handle('tmux:updateMeta', (_, name: string, updates: { projectId?: string; notes?: string }) => {
    updateSessionMeta(name, updates);
    return { success: true };
  });

  ipcMain.handle('tmux:rename', async (_, oldName: string, newName: string) => {
    return renameTmuxSession(oldName, newName);
  });

  // ============================================
  // Clawdbot Personality handlers
  // ============================================
  ipcMain.handle('clawdbot:getPersonalities', () => {
    return getPersonalities();
  });

  ipcMain.handle('clawdbot:getPersonality', (_, id: string) => {
    return getPersonality(id);
  });

  ipcMain.handle('clawdbot:getCurrentPersonality', () => {
    return getCurrentPersonality();
  });

  ipcMain.handle('clawdbot:getCurrentPersonalityId', () => {
    return getCurrentPersonalityId();
  });

  ipcMain.handle('clawdbot:setCurrentPersonality', (_, id: string) => {
    return setCurrentPersonality(id);
  });

  ipcMain.handle('clawdbot:savePersonality', (_, personality: Omit<ClawdbotPersonality, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    return savePersonality(personality);
  });

  ipcMain.handle('clawdbot:deletePersonality', (_, id: string) => {
    return deletePersonality(id);
  });

  ipcMain.handle('clawdbot:getGreeting', () => {
    return getGreeting();
  });

  // ============================================
  // Image handling for chat
  // ============================================
  ipcMain.handle('image:saveTemp', async (_, base64Data: string, filename: string) => {
    try {
      // Remove data URL prefix if present
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');

      // Create temp directory in app data
      const tempDir = path.join(app.getPath('userData'), 'temp-images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate unique filename
      const uniqueName = `${Date.now()}-${filename}`;
      const filePath = path.join(tempDir, uniqueName);

      // Write the file
      fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'));

      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('image:cleanupTemp', async () => {
    try {
      const tempDir = path.join(app.getPath('userData'), 'temp-images');
      if (fs.existsSync(tempDir)) {
        // Delete files older than 1 hour
        const files = fs.readdirSync(tempDir);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        for (const file of files) {
          const filePath = path.join(tempDir, file);
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
          }
        }
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ============================================
  // Token History handlers
  // ============================================
  ipcMain.handle('tokenHistory:get', (_, days?: number) => {
    return getTokenHistory(days || 7);
  });

  ipcMain.handle('tokenHistory:getTotal', (_, days?: number) => {
    return getTotalUsageForPeriod(days || 7);
  });

  ipcMain.handle('tokenHistory:getAverage', (_, days?: number) => {
    return getAverageDailyUsage(days || 7);
  });

  ipcMain.handle('tokenHistory:clear', () => {
    clearTokenHistory();
    return { success: true };
  });
}
