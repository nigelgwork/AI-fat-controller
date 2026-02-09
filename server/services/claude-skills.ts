import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getHomeDir } from '../utils/paths';
import { createLogger } from '../utils/logger';

const log = createLogger('ClaudeSkills');

const fsPromises = fs.promises;
const execAsync = promisify(exec);

export interface ClaudeSkill {
  id: string;             // source:filename (e.g., "commands:review-pr")
  name: string;           // from filename or frontmatter
  description: string;    // from frontmatter
  content: string;        // full markdown body (prompt)
  filePath: string;       // absolute path to .md file
  sourceName: string;     // which directory/plugin it belongs to
  isCustom: boolean;      // true if user-created (in ~/.claude/commands/)
}

// Parse YAML-like frontmatter
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
    if (typeof value === 'string' && /^["'].*["']$/.test(value)) {
      value = (value as string).slice(1, -1);
    }
    meta[key] = value;
  }

  return { meta, body };
}

// Serialize skill to frontmatter + markdown
function serializeSkill(skill: Partial<ClaudeSkill>): string {
  const lines: string[] = ['---'];
  if (skill.name) lines.push(`name: ${skill.name}`);
  if (skill.description) lines.push(`description: "${skill.description}"`);
  lines.push('---');
  lines.push('');
  lines.push(skill.content || '');
  return lines.join('\n');
}

// Parse a single skill .md file
async function parseSkillFile(filePath: string, sourceName: string, isCustom: boolean): Promise<ClaudeSkill | null> {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);
    const basename = path.basename(filePath, '.md');

    return {
      id: `${sourceName}:${basename}`,
      name: (meta.name as string) || basename,
      description: (meta.description as string) || '',
      content: body.trim(),
      filePath,
      sourceName,
      isCustom,
    };
  } catch (err) {
    log.error(`Error parsing skill file ${filePath}:`, err);
    return null;
  }
}

// Recursively find directories containing commands/
function findCommandDirs(rootDir: string): { path: string; name: string }[] {
  const results: { path: string; name: string }[] = [];
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(rootDir, entry.name);
      if (entry.name === 'commands') {
        // parent is the plugin name
        const parentName = path.basename(rootDir);
        results.push({ path: fullPath, name: parentName });
      }
      // Recurse into marketplace structure
      if (['marketplaces', 'plugins', 'external_plugins'].includes(entry.name) ||
          fullPath.includes('marketplaces')) {
        results.push(...findCommandDirs(fullPath));
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return results;
}

// Get all directories that may contain skill/command definitions
function getSkillSourceDirs(): { path: string; name: string; isCustom: boolean }[] {
  const homeDir = getHomeDir();
  const dirs: { path: string; name: string; isCustom: boolean }[] = [];

  // User's custom commands directory
  const commandsDir = path.join(homeDir, '.claude', 'commands');
  if (fs.existsSync(commandsDir)) {
    dirs.push({ path: commandsDir, name: 'commands', isCustom: true });
  }

  // Project-level commands (from cwd)
  const projectCommandsDir = path.join(process.cwd(), '.claude', 'commands');
  if (fs.existsSync(projectCommandsDir)) {
    dirs.push({ path: projectCommandsDir, name: 'project-commands', isCustom: true });
  }

  // Scan plugins for commands directories
  const pluginsRoot = path.join(homeDir, '.claude', 'plugins');
  if (fs.existsSync(pluginsRoot)) {
    const commandDirs = findCommandDirs(pluginsRoot);
    for (const dir of commandDirs) {
      dirs.push({
        path: dir.path,
        name: dir.name,
        isCustom: false,
      });
    }
  }

  return dirs;
}

// Get skill source directories including cross-environment
async function getSkillSourceDirsAsync(): Promise<{ path: string; name: string; isCustom: boolean }[]> {
  const dirs = getSkillSourceDirs();

  // Check cross-environment (WSL <-> Windows)
  let crossEnvHome: string | null = null;
  const envLabel = process.platform === 'win32' ? 'WSL' : 'Windows';

  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync('wsl.exe -e bash -c "echo $HOME"', { timeout: 5000 });
      const wslHome = stdout.trim();
      if (wslHome) {
        const { stdout: distroOut } = await execAsync('wsl.exe -l -q', { timeout: 5000 });
        const distro = distroOut.trim().split('\n')[0].replace(/\0/g, '').trim();
        if (distro) {
          crossEnvHome = `\\\\wsl$\\${distro}${wslHome.replace(/\//g, '\\')}`;
        }
      }
    } catch {
      // WSL not available
    }
  } else {
    try {
      const versionInfo = fs.readFileSync('/proc/version', 'utf-8');
      if (versionInfo.toLowerCase().includes('microsoft')) {
        const { stdout } = await execAsync('cmd.exe /c "echo %USERPROFILE%" 2>/dev/null', { timeout: 5000 });
        const winPath = stdout.trim();
        if (winPath && winPath !== '%USERPROFILE%') {
          const { stdout: wslPath } = await execAsync(`wslpath "${winPath}"`, { timeout: 5000 });
          crossEnvHome = wslPath.trim();
        }
      }
    } catch {
      // Not WSL or cmd.exe not available
    }
  }

  if (crossEnvHome) {
    const crossCommandsDir = path.join(crossEnvHome, '.claude', 'commands');
    if (fs.existsSync(crossCommandsDir)) {
      dirs.push({ path: crossCommandsDir, name: `commands (${envLabel})`, isCustom: true });
    }

    const crossPluginsRoot = path.join(crossEnvHome, '.claude', 'plugins');
    if (fs.existsSync(crossPluginsRoot)) {
      const commandDirs = findCommandDirs(crossPluginsRoot);
      for (const dir of commandDirs) {
        dirs.push({
          path: dir.path,
          name: `${dir.name} (${envLabel})`,
          isCustom: false,
        });
      }
    }
  }

  return dirs;
}

// Scan a directory for skill .md files
async function scanDirForSkills(dirPath: string, sourceName: string, isCustom: boolean): Promise<ClaudeSkill[]> {
  const skills: ClaudeSkill[] = [];
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
        const filePath = path.join(dirPath, entry.name);
        const skill = await parseSkillFile(filePath, sourceName, isCustom);
        if (skill) skills.push(skill);
      }
    }
  } catch {
    // Directory doesn't exist, skip
  }
  return skills;
}

// List all skills from all sources
export async function listSkills(): Promise<ClaudeSkill[]> {
  const sources = await getSkillSourceDirsAsync();
  const allSkills: ClaudeSkill[] = [];

  for (const source of sources) {
    const skills = await scanDirForSkills(source.path, source.name, source.isCustom);
    allSkills.push(...skills);
  }

  // Deduplicate by id
  const seen = new Map<string, ClaudeSkill>();
  for (const skill of allSkills) {
    if (!seen.has(skill.id)) {
      seen.set(skill.id, skill);
    }
  }

  return Array.from(seen.values());
}

// Get a specific skill by id
export async function getSkill(id: string): Promise<ClaudeSkill | null> {
  const skills = await listSkills();
  return skills.find(s => s.id === id) || null;
}

// Ensure the user commands directory exists
async function ensureCommandsDir(): Promise<string> {
  const homeDir = getHomeDir();
  const commandsDir = path.join(homeDir, '.claude', 'commands');
  await fsPromises.mkdir(commandsDir, { recursive: true });
  return commandsDir;
}

// Create a new custom skill
export async function createSkill(skill: Partial<ClaudeSkill>): Promise<ClaudeSkill> {
  const commandsDir = await ensureCommandsDir();

  const safeName = (skill.name || 'new-skill')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let filename = `${safeName}.md`;
  let filePath = path.join(commandsDir, filename);

  let counter = 1;
  while (fs.existsSync(filePath)) {
    filename = `${safeName}-${counter}.md`;
    filePath = path.join(commandsDir, filename);
    counter++;
  }

  const content = serializeSkill(skill);
  await fsPromises.writeFile(filePath, content, 'utf-8');

  const created = await parseSkillFile(filePath, 'commands', true);
  if (!created) throw new Error('Failed to parse newly created skill file');
  return created;
}

// Update an existing skill
export async function updateSkill(id: string, updates: Partial<ClaudeSkill>): Promise<ClaudeSkill> {
  const existing = await getSkill(id);
  if (!existing) throw new Error(`Skill not found: ${id}`);

  const merged: Partial<ClaudeSkill> = { ...existing, ...updates };
  const content = serializeSkill(merged);
  await fsPromises.writeFile(existing.filePath, content, 'utf-8');

  const updated = await parseSkillFile(existing.filePath, existing.sourceName, existing.isCustom);
  if (!updated) throw new Error('Failed to parse updated skill file');
  return updated;
}

// Delete a custom skill
export async function deleteSkill(id: string): Promise<void> {
  const skill = await getSkill(id);
  if (!skill) throw new Error(`Skill not found: ${id}`);
  if (!skill.isCustom) throw new Error('Cannot delete non-custom skills');
  await fsPromises.unlink(skill.filePath);
}

// Copy a skill to the Windows commands directory
export async function copySkillToWindows(id: string): Promise<ClaudeSkill> {
  const skill = await getSkill(id);
  if (!skill) throw new Error(`Skill not found: ${id}`);

  const homeDir = getHomeDir();
  const windowsCommandsDir = path.join(homeDir, '.claude', 'commands');
  await fsPromises.mkdir(windowsCommandsDir, { recursive: true });

  const fileName = path.basename(skill.filePath);
  const newFilePath = path.join(windowsCommandsDir, fileName);

  try {
    await fsPromises.access(newFilePath);
    throw new Error(`Skill "${skill.name}" already exists at target`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const content = await fsPromises.readFile(skill.filePath, 'utf-8');
  await fsPromises.writeFile(newFilePath, content, 'utf-8');

  const newSkill = await parseSkillFile(newFilePath, 'commands', true);
  if (!newSkill) throw new Error('Failed to parse copied skill');
  return newSkill;
}

// Copy a skill to WSL commands directory
export async function copySkillToWsl(id: string): Promise<ClaudeSkill> {
  const skill = await getSkill(id);
  if (!skill) throw new Error(`Skill not found: ${id}`);

  try {
    await execAsync('wsl.exe -e mkdir -p ~/.claude/commands', { timeout: 5000 });
  } catch {
    throw new Error('WSL is not available');
  }

  const { stdout: homeOut } = await execAsync('wsl.exe -e bash -c "echo $HOME"', { timeout: 5000 });
  const wslHome = homeOut.trim();
  const { stdout: distroOut } = await execAsync('wsl.exe -l -q', { timeout: 5000 });
  const distro = distroOut.trim().split('\n')[0].replace(/\0/g, '').trim();
  const wslCommandsDir = `\\\\wsl$\\${distro}${wslHome.replace(/\//g, '\\')}/.claude/commands`;

  const fileName = path.basename(skill.filePath);
  const newFilePath = path.join(wslCommandsDir, fileName);

  const content = await fsPromises.readFile(skill.filePath, 'utf-8');
  await fsPromises.writeFile(newFilePath, content, 'utf-8');

  const newSkill = await parseSkillFile(newFilePath, 'commands (WSL)', true);
  if (!newSkill) throw new Error('Failed to parse copied skill');
  return newSkill;
}
