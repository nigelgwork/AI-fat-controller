import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getHomeDir } from '../utils/paths';
import { createLogger } from '../utils/logger';

const log = createLogger('ClaudeAgents');

const fsPromises = fs.promises;
const execAsync = promisify(exec);

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

  // Check ~/.claude/plugins directory (plugin subdirectories)
  const pluginsRoot = path.join(homeDir, '.claude', 'plugins');
  try {
    if (fs.existsSync(pluginsRoot)) {
      const entries = fs.readdirSync(pluginsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirs.push({
            path: path.join(pluginsRoot, entry.name),
            name: entry.name,
            isCustom: entry.name === 'custom-agents'
          });
        }
      }
    }
  } catch {
    // Plugins directory doesn't exist yet
  }

  // Custom agents directory (inside plugins)
  const customAgentsDir = getCustomAgentsDir();
  if (fs.existsSync(customAgentsDir)) {
    dirs.push({ path: customAgentsDir, name: 'custom-agents', isCustom: true });
  }

  return dirs;
}

// Get agent source directories including WSL (async version)
async function getAgentSourceDirsAsync(): Promise<{ path: string; name: string; isCustom: boolean }[]> {
  const dirs = getAgentSourceDirs();

  // Also check WSL paths on Windows
  if (process.platform === 'win32') {
    try {
      const wslHome = await getWslHomePath();
      if (wslHome) {
        // Check WSL agents directory
        const wslAgentsDir = path.join(wslHome, '.claude', 'agents');
        if (fs.existsSync(wslAgentsDir)) {
          dirs.push({ path: wslAgentsDir, name: 'agents (WSL)', isCustom: false });
        }

        // Check WSL commands directory
        const wslCommandsDir = path.join(wslHome, '.claude', 'commands');
        if (fs.existsSync(wslCommandsDir)) {
          dirs.push({ path: wslCommandsDir, name: 'commands (WSL)', isCustom: true });
        }

        // Check WSL plugins directory
        const wslPluginsRoot = path.join(wslHome, '.claude', 'plugins');
        try {
          if (fs.existsSync(wslPluginsRoot)) {
            const entries = fs.readdirSync(wslPluginsRoot, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                dirs.push({
                  path: path.join(wslPluginsRoot, entry.name),
                  name: `${entry.name} (WSL)`,
                  isCustom: entry.name === 'custom-agents'
                });
              }
            }
          }
        } catch {
          // Ignore
        }
      }
    } catch {
      // WSL not available
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
export async function listAgents(): Promise<ClaudeAgent[]> {
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

  return Array.from(seen.values());
}

// Get a specific agent by id
export async function getAgent(id: string): Promise<ClaudeAgent | null> {
  const agents = await listAgents();
  return agents.find(a => a.id === id) || null;
}

// Create a new custom agent
export async function createAgent(agent: Partial<ClaudeAgent>): Promise<ClaudeAgent> {
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
