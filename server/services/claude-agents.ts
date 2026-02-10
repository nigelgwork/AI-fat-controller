import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getHomeDir } from '../utils/paths';
import { createLogger } from '../utils/logger';

const log = createLogger('ClaudeAgents');

const fsPromises = fs.promises;
const execAsync = promisify(exec);

// Cache for expensive operations
let cachedAgents: ClaudeAgent[] | null = null;
let agentsCacheTime = 0;
const AGENTS_CACHE_TTL = 60000; // 1 minute

let cachedCrossEnvHome: string | null | undefined = undefined; // undefined = not yet checked
let crossEnvHomeChecked = false;

export interface ClaudeAgent {
  id: string;              // plugin:filename (e.g., "custom-agents:code-architect")
  name: string;            // from frontmatter
  description: string;     // from frontmatter
  model?: string;
  color?: string;
  tools?: string[];
  content: string;         // full markdown body (system prompt)
  filePath: string;        // absolute path to .md file
  pluginName: string;      // which plugin it belongs to
  isCustom: boolean;       // true if in user's custom plugin
}

export interface AgentPlugin {
  name: string;
  path: string;
  agentCount: number;
  isCustom: boolean;
}

// Parse YAML-like frontmatter from an agent .md file
function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const meta: Record<string, unknown> = {};

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Remove surrounding quotes
    if (typeof value === 'string' && /^["'].*["']$/.test(value)) {
      value = (value as string).slice(1, -1);
    }

    // Parse arrays: ["a", "b", "c"]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      try {
        value = JSON.parse(value);
      } catch {
        // Keep as string if parse fails
      }
    }

    meta[key] = value;
  }

  return { meta, body };
}

// Serialize agent back to frontmatter + markdown
function serializeAgent(agent: Partial<ClaudeAgent>): string {
  const lines: string[] = ['---'];

  if (agent.name) lines.push(`name: ${agent.name}`);
  if (agent.description) lines.push(`description: "${agent.description}"`);
  if (agent.model) lines.push(`model: ${agent.model}`);
  if (agent.color) lines.push(`color: ${agent.color}`);
  if (agent.tools && agent.tools.length > 0) {
    lines.push(`tools: ${JSON.stringify(agent.tools)}`);
  }

  lines.push('---');
  lines.push('');
  lines.push(agent.content || '');

  return lines.join('\n');
}

// Parse a single agent .md file
async function parseAgentFile(filePath: string, pluginName: string, isCustom: boolean): Promise<ClaudeAgent | null> {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);
    const basename = path.basename(filePath, '.md');

    return {
      id: `${pluginName}:${basename}`,
      name: (meta.name as string) || basename,
      description: (meta.description as string) || '',
      model: meta.model as string | undefined,
      color: meta.color as string | undefined,
      tools: Array.isArray(meta.tools) ? meta.tools : undefined,
      content: body.trim(),
      filePath,
      pluginName,
      isCustom,
    };
  } catch (err) {
    log.error(`Error parsing agent file ${filePath}:`, err);
    return null;
  }
}

// Get the custom plugin directory path
function getCustomPluginDir(): string {
  const homeDir = getHomeDir();
  return path.join(homeDir, '.claude', 'plugins', 'custom-agents');
}

// Get the custom agents directory
function getCustomAgentsDir(): string {
  return path.join(getCustomPluginDir(), 'agents');
}

// Ensure the custom plugin directory exists with plugin.json
async function ensureCustomPluginDir(): Promise<void> {
  const pluginDir = getCustomPluginDir();
  const agentsDir = getCustomAgentsDir();

  await fsPromises.mkdir(agentsDir, { recursive: true });

  const pluginJsonPath = path.join(pluginDir, 'plugin.json');
  try {
    await fsPromises.access(pluginJsonPath);
  } catch {
    // Create plugin.json
    const pluginJson = {
      name: 'custom-agents',
      description: 'User-created custom agents',
      version: '1.0.0',
    };
    await fsPromises.writeFile(pluginJsonPath, JSON.stringify(pluginJson, null, 2), 'utf-8');
  }
}

// Get WSL home directory path accessible from Windows
async function getWslHomePath(): Promise<string | null> {
  if (process.platform !== 'win32') return null;

  try {
    const { stdout } = await execAsync('wsl.exe -e bash -c "echo $HOME"', { timeout: 5000 });
    const wslHome = stdout.trim();
    if (wslHome) {
      // Convert WSL path to Windows UNC path: /home/user -> \\wsl$\Ubuntu\home\user
      // First get the default distro name
      const { stdout: distroOut } = await execAsync('wsl.exe -l -q', { timeout: 5000 });
      const distro = distroOut.trim().split('\n')[0].replace(/\0/g, '').trim();
      if (distro) {
        return `\\\\wsl$\\${distro}${wslHome.replace(/\//g, '\\')}`;
      }
    }
  } catch {
    // WSL not available
  }
  return null;
}

// Recursively find plugin directories that contain agents/ or commands/ subdirectories
function findPluginDirs(rootDir: string): { path: string; name: string }[] {
  const results: { path: string; name: string }[] = [];
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(rootDir, entry.name);
      // If this directory has agents/ or commands/ subdirectories, it's a plugin
      const hasAgents = fs.existsSync(path.join(fullPath, 'agents'));
      const hasCommands = fs.existsSync(path.join(fullPath, 'commands'));
      if (hasAgents || hasCommands) {
        results.push({ path: fullPath, name: entry.name });
      }
      // Recurse into subdirectories (for marketplace structure: marketplaces/*/plugins/*)
      if (['marketplaces', 'plugins', 'external_plugins'].includes(entry.name) ||
          fullPath.includes('marketplaces')) {
        results.push(...findPluginDirs(fullPath));
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return results;
}

// Get all directories that may contain agent definitions
function getAgentSourceDirs(): { path: string; name: string; isCustom: boolean }[] {
  const homeDir = getHomeDir();
  const dirs: { path: string; name: string; isCustom: boolean }[] = [];

  // Check ~/.claude/agents directory (where Claude Code stores agents directly)
  const agentsDir = path.join(homeDir, '.claude', 'agents');
  if (fs.existsSync(agentsDir)) {
    dirs.push({ path: agentsDir, name: 'agents', isCustom: false });
  }

  // Check ~/.claude/commands directory (user slash commands)
  const commandsDir = path.join(homeDir, '.claude', 'commands');
  if (fs.existsSync(commandsDir)) {
    dirs.push({ path: commandsDir, name: 'commands', isCustom: true });
  }

  // Recursively scan ~/.claude/plugins for plugin directories with agents/commands
  const pluginsRoot = path.join(homeDir, '.claude', 'plugins');
  if (fs.existsSync(pluginsRoot)) {
    const pluginDirs = findPluginDirs(pluginsRoot);
    for (const pluginDir of pluginDirs) {
      dirs.push({
        path: pluginDir.path,
        name: pluginDir.name,
        isCustom: pluginDir.name === 'custom-agents',
      });
    }
  }

  // Custom agents directory (inside plugins)
  const customAgentsDir = getCustomAgentsDir();
  if (fs.existsSync(customAgentsDir)) {
    dirs.push({ path: customAgentsDir, name: 'custom-agents', isCustom: true });
  }

  return dirs;
}

// Get Windows home path from WSL (when running in WSL)
async function getWindowsHomePath(): Promise<string | null> {
  // Check if we're running in WSL (Linux with Microsoft kernel)
  try {
    const versionInfo = fs.readFileSync('/proc/version', 'utf-8');
    if (!versionInfo.toLowerCase().includes('microsoft')) return null;
    const { stdout } = await execAsync('cmd.exe /c "echo %USERPROFILE%" 2>/dev/null', { timeout: 5000 });
    const winPath = stdout.trim();
    if (winPath && winPath !== '%USERPROFILE%') {
      const { stdout: wslPath } = await execAsync(`wslpath "${winPath}"`, { timeout: 5000 });
      return wslPath.trim();
    }
  } catch {
    // cmd.exe not available or WSL interop disabled
  }
  return null;
}

// Get agent source directories including cross-environment paths (async version)
async function getAgentSourceDirsAsync(): Promise<{ path: string; name: string; isCustom: boolean }[]> {
  const dirs = getAgentSourceDirs();

  // Check cross-environment paths (cached to avoid spawning cmd.exe every time)
  const envLabel = process.platform === 'win32' ? 'WSL' : 'Windows';

  if (!crossEnvHomeChecked) {
    crossEnvHomeChecked = true;
    if (process.platform === 'win32') {
      cachedCrossEnvHome = await getWslHomePath();
    } else {
      cachedCrossEnvHome = await getWindowsHomePath();
    }
  }

  const crossEnvHome = cachedCrossEnvHome ?? null;

  if (crossEnvHome) {
    const crossClaudeDir = path.join(crossEnvHome, '.claude');

    // Check agents directory
    const crossAgentsDir = path.join(crossClaudeDir, 'agents');
    if (fs.existsSync(crossAgentsDir)) {
      dirs.push({ path: crossAgentsDir, name: `agents (${envLabel})`, isCustom: false });
    }

    // Check commands directory
    const crossCommandsDir = path.join(crossClaudeDir, 'commands');
    if (fs.existsSync(crossCommandsDir)) {
      dirs.push({ path: crossCommandsDir, name: `commands (${envLabel})`, isCustom: true });
    }

    // Recursively scan plugins
    const crossPluginsRoot = path.join(crossClaudeDir, 'plugins');
    if (fs.existsSync(crossPluginsRoot)) {
      const pluginDirs = findPluginDirs(crossPluginsRoot);
      for (const pluginDir of pluginDirs) {
        dirs.push({
          path: pluginDir.path,
          name: `${pluginDir.name} (${envLabel})`,
          isCustom: pluginDir.name === 'custom-agents',
        });
      }
    }
  }

  return dirs;
}

// Legacy function for backwards compatibility
function getPluginDirs(): string[] {
  return getAgentSourceDirs().map(d => d.path);
}

// Scan a directory for agent .md files
async function scanDirForAgents(dirPath: string, sourceName: string, isCustom: boolean): Promise<ClaudeAgent[]> {
  const agents: ClaudeAgent[] = [];

  // Check for agents in an 'agents' subdirectory first, then root
  const agentsDirs = [
    path.join(dirPath, 'agents'),
    dirPath,
  ];

  for (const dir of agentsDirs) {
    try {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
          const filePath = path.join(dir, entry.name);
          const agent = await parseAgentFile(filePath, sourceName, isCustom);
          if (agent) {
            agents.push(agent);
          }
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return agents;
}

// List all agents from all sources (commands, plugins, custom, WSL)
export async function listAgents(skipCache = false): Promise<ClaudeAgent[]> {
  // Return cached results if fresh enough
  if (!skipCache && cachedAgents && (Date.now() - agentsCacheTime) < AGENTS_CACHE_TTL) {
    return cachedAgents;
  }

  const sources = await getAgentSourceDirsAsync();
  const allAgents: ClaudeAgent[] = [];

  for (const source of sources) {
    const agents = await scanDirForAgents(source.path, source.name, source.isCustom);
    allAgents.push(...agents);
  }

  // Deduplicate by id (first occurrence wins)
  const seen = new Map<string, ClaudeAgent>();
  for (const agent of allAgents) {
    if (!seen.has(agent.id)) {
      seen.set(agent.id, agent);
    }
  }

  cachedAgents = Array.from(seen.values());
  agentsCacheTime = Date.now();
  return cachedAgents;
}

// Invalidate agent cache (call after create/update/delete)
export function invalidateAgentCache(): void {
  cachedAgents = null;
  agentsCacheTime = 0;
}

// Get a specific agent by id
export async function getAgent(id: string): Promise<ClaudeAgent | null> {
  const agents = await listAgents();
  return agents.find(a => a.id === id) || null;
}

// Create a new custom agent
export async function createAgent(agent: Partial<ClaudeAgent>): Promise<ClaudeAgent> {
  invalidateAgentCache();
  await ensureCustomPluginDir();
  const agentsDir = getCustomAgentsDir();

  // Generate filename from name
  const safeName = (agent.name || 'new-agent')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let filename = `${safeName}.md`;
  let filePath = path.join(agentsDir, filename);

  // Avoid collisions
  let counter = 1;
  while (fs.existsSync(filePath)) {
    filename = `${safeName}-${counter}.md`;
    filePath = path.join(agentsDir, filename);
    counter++;
  }

  const content = serializeAgent(agent);
  await fsPromises.writeFile(filePath, content, 'utf-8');

  const created = await parseAgentFile(filePath, 'custom-agents', true);
  if (!created) {
    throw new Error('Failed to parse newly created agent file');
  }
  return created;
}

// Update an existing agent
export async function updateAgent(id: string, updates: Partial<ClaudeAgent>): Promise<ClaudeAgent> {
  invalidateAgentCache();
  const existing = await getAgent(id);
  if (!existing) {
    throw new Error(`Agent not found: ${id}`);
  }

  const merged: Partial<ClaudeAgent> = {
    ...existing,
    ...updates,
  };

  const content = serializeAgent(merged);
  await fsPromises.writeFile(existing.filePath, content, 'utf-8');

  const updated = await parseAgentFile(existing.filePath, existing.pluginName, existing.isCustom);
  if (!updated) {
    throw new Error('Failed to parse updated agent file');
  }
  return updated;
}

// Delete a custom agent
export async function deleteAgent(id: string): Promise<void> {
  invalidateAgentCache();
  const agent = await getAgent(id);
  if (!agent) {
    throw new Error(`Agent not found: ${id}`);
  }
  if (!agent.isCustom) {
    throw new Error('Cannot delete non-custom agents');
  }

  await fsPromises.unlink(agent.filePath);
}

// Get the Windows commands directory path
function getWindowsCommandsDir(): string {
  const homeDir = getHomeDir();
  return path.join(homeDir, '.claude', 'commands');
}

// Get the WSL commands directory path (as Windows UNC path)
async function getWslCommandsDir(): Promise<string | null> {
  const wslHome = await getWslHomePath();
  if (!wslHome) return null;
  return path.join(wslHome, '.claude', 'commands');
}

// Copy an agent to Windows
export async function copyAgentToWindows(id: string): Promise<ClaudeAgent> {
  invalidateAgentCache();
  const agent = await getAgent(id);
  if (!agent) {
    throw new Error(`Agent not found: ${id}`);
  }

  // Check if already on Windows
  if (!agent.pluginName.includes('WSL')) {
    throw new Error('Agent is already on Windows');
  }

  const windowsCommandsDir = getWindowsCommandsDir();

  // Ensure the directory exists
  try {
    await fsPromises.mkdir(windowsCommandsDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  // Create the new file path
  const fileName = path.basename(agent.filePath);
  const newFilePath = path.join(windowsCommandsDir, fileName);

  // Check if file already exists
  try {
    await fsPromises.access(newFilePath);
    throw new Error(`Agent "${agent.name}" already exists on Windows`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
    // File doesn't exist, good to proceed
  }

  // Read the original file content and write to new location
  const content = await fsPromises.readFile(agent.filePath, 'utf-8');
  await fsPromises.writeFile(newFilePath, content, 'utf-8');

  // Return the new agent
  const newAgent = await parseAgentFile(newFilePath, 'commands', true);
  if (!newAgent) {
    throw new Error('Failed to parse copied agent');
  }

  return newAgent;
}

// Copy an agent to WSL
export async function copyAgentToWsl(id: string): Promise<ClaudeAgent> {
  invalidateAgentCache();
  const agent = await getAgent(id);
  if (!agent) {
    throw new Error(`Agent not found: ${id}`);
  }

  // Check if already on WSL
  if (agent.pluginName.includes('WSL')) {
    throw new Error('Agent is already on WSL');
  }

  const wslCommandsDir = await getWslCommandsDir();
  if (!wslCommandsDir) {
    throw new Error('WSL is not available');
  }

  // Ensure the directory exists (via WSL command)
  try {
    await execAsync('wsl.exe -e mkdir -p ~/.claude/commands', { timeout: 5000 });
  } catch {
    // Directory might already exist
  }

  // Create the new file path
  const fileName = path.basename(agent.filePath);
  const newFilePath = path.join(wslCommandsDir, fileName);

  // Check if file already exists
  try {
    await fsPromises.access(newFilePath);
    throw new Error(`Agent "${agent.name}" already exists on WSL`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
    // File doesn't exist, good to proceed
  }

  // Read the original file content and write to new location
  const content = await fsPromises.readFile(agent.filePath, 'utf-8');
  await fsPromises.writeFile(newFilePath, content, 'utf-8');

  // Return the new agent
  const newAgent = await parseAgentFile(newFilePath, 'commands (WSL)', true);
  if (!newAgent) {
    throw new Error('Failed to parse copied agent');
  }

  return newAgent;
}

// Get list of plugins that have agents
export async function getAgentPlugins(): Promise<AgentPlugin[]> {
  const sources = await getAgentSourceDirsAsync();
  const plugins: AgentPlugin[] = [];

  for (const source of sources) {
    const agents = await scanDirForAgents(source.path, source.name, source.isCustom);
    if (agents.length > 0) {
      plugins.push({
        name: source.name,
        path: source.path,
        agentCount: agents.length,
        isCustom: source.isCustom,
      });
    }
  }

  return plugins;
}
