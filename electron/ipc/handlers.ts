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
  getMayorState,
  activateMayor,
  deactivateMayor,
  pauseMayor,
  resumeMayor,
  getApprovalQueue,
  approveRequest,
  rejectRequest,
  getActionLogs,
} from '../services/mayor';

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

  // Mayor handlers
  ipcMain.handle('mayor:getState', () => {
    return getMayorState();
  });

  ipcMain.handle('mayor:activate', async () => {
    return activateMayor();
  });

  ipcMain.handle('mayor:deactivate', async () => {
    return deactivateMayor();
  });

  ipcMain.handle('mayor:pause', async () => {
    return pauseMayor();
  });

  ipcMain.handle('mayor:resume', async () => {
    return resumeMayor();
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
}
