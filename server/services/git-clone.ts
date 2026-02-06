import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { getHomeDir } from '../utils/paths';
import { createLogger } from '../utils/logger';
import * as settingsRepo from '../db/repositories/settings-repo';
import { broadcast } from '../websocket';

const log = createLogger('GitClone');
const execAsync = promisify(exec);
const fsPromises = fs.promises;

export interface CloneOptions {
  repoUrl: string;
  targetDir?: string;      // Default: projectsDirectory/repoName
  branch?: string;
  runSetup?: boolean;
}

export interface SetupCommand {
  command: string;
  args: string[];
  description: string;
  packageManager: string;  // npm, pip, cargo, etc.
}

export interface CloneResult {
  success: boolean;
  projectPath?: string;
  projectId?: string;
  error?: string;
  detectedSetup?: SetupCommand[];
}

export interface SetupResult {
  success: boolean;
  completedCommands: string[];
  failedCommands: { command: string; error: string }[];
}

export interface CloneProgress {
  stage: 'cloning' | 'detecting' | 'setup' | 'complete' | 'error';
  message: string;
  percentage?: number;
}

/**
 * Extract repository name from a git URL
 */
function extractRepoName(repoUrl: string): string {
  // Handle various git URL formats:
  // https://github.com/user/repo.git
  // git@github.com:user/repo.git
  // https://github.com/user/repo
  // git://github.com/user/repo.git

  let url = repoUrl.trim();

  // Remove .git suffix
  if (url.endsWith('.git')) {
    url = url.slice(0, -4);
  }

  // Remove trailing slash
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // Extract the last path segment
  const lastSlash = url.lastIndexOf('/');
  const lastColon = url.lastIndexOf(':');
  const lastSeparator = Math.max(lastSlash, lastColon);

  if (lastSeparator >= 0) {
    return url.slice(lastSeparator + 1);
  }

  return url;
}

/**
 * Get the default projects directory
 */
export function getProjectsDirectory(): string {
  const configured = settingsRepo.get('projectsDirectory');
  if (configured) {
    return configured;
  }

  // Default to ~/projects
  const homeDir = getHomeDir();
  return path.join(homeDir, 'projects');
}

/**
 * Ensure the projects directory exists
 */
async function ensureProjectsDirectory(): Promise<string> {
  const projectsDir = getProjectsDirectory();

  try {
    await fsPromises.mkdir(projectsDir, { recursive: true });
  } catch (err) {
    log.error('Failed to create projects directory:', err);
  }

  return projectsDir;
}

/**
 * Clone a git repository
 */
export async function cloneRepository(options: CloneOptions): Promise<CloneResult> {
  const { repoUrl, branch, runSetup = false } = options;

  // Validate URL
  if (!repoUrl || typeof repoUrl !== 'string') {
    return { success: false, error: 'Invalid repository URL' };
  }

  // Extract repo name and determine target directory
  const repoName = extractRepoName(repoUrl);
  if (!repoName) {
    return { success: false, error: 'Could not determine repository name from URL' };
  }

  const projectsDir = await ensureProjectsDirectory();
  const targetDir = options.targetDir || path.join(projectsDir, repoName);

  // Check if directory already exists
  try {
    await fsPromises.access(targetDir);
    return {
      success: false,
      error: `Directory already exists: ${targetDir}`
    };
  } catch {
    // Directory doesn't exist, good to proceed
  }

  // Broadcast progress via WebSocket
  broadcast('clone:progress', {
    stage: 'cloning',
    message: `Cloning ${repoName}...`,
    percentage: 10
  } as CloneProgress);

  // Build git clone command
  const cloneArgs = ['clone'];
  if (branch) {
    cloneArgs.push('--branch', branch);
  }
  cloneArgs.push('--progress');
  cloneArgs.push(repoUrl);
  cloneArgs.push(targetDir);

  try {
    // Use spawn for better progress handling
    await new Promise<void>((resolve, reject) => {
      const gitProcess = spawn('git', cloneArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      gitProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;

        // Parse git clone progress
        // Git outputs progress to stderr
        if (output.includes('Receiving objects:')) {
          const match = output.match(/Receiving objects:\s+(\d+)%/);
          if (match) {
            const percentage = Math.min(10 + parseInt(match[1]) * 0.6, 70);
            broadcast('clone:progress', {
              stage: 'cloning',
              message: `Cloning ${repoName}... ${match[1]}%`,
              percentage
            } as CloneProgress);
          }
        } else if (output.includes('Resolving deltas:')) {
          const match = output.match(/Resolving deltas:\s+(\d+)%/);
          if (match) {
            const percentage = Math.min(70 + parseInt(match[1]) * 0.2, 90);
            broadcast('clone:progress', {
              stage: 'cloning',
              message: `Resolving deltas... ${match[1]}%`,
              percentage
            } as CloneProgress);
          }
        }
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed: ${stderr}`));
        }
      });

      gitProcess.on('error', (err) => {
        reject(err);
      });
    });

    log.info(`Successfully cloned ${repoUrl} to ${targetDir}`);

    // Detect setup commands
    broadcast('clone:progress', {
      stage: 'detecting',
      message: 'Detecting setup commands...',
      percentage: 92
    } as CloneProgress);

    const detectedSetup = await detectSetupCommands(targetDir);

    // Run setup if requested
    if (runSetup && detectedSetup.length > 0) {
      broadcast('clone:progress', {
        stage: 'setup',
        message: 'Running setup commands...',
        percentage: 95
      } as CloneProgress);

      await runSetupCommands(targetDir, detectedSetup);
    }

    broadcast('clone:progress', {
      stage: 'complete',
      message: 'Clone complete!',
      percentage: 100
    } as CloneProgress);

    // Generate a simple project ID
    const projectId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

    return {
      success: true,
      projectPath: targetDir,
      projectId,
      detectedSetup,
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error('Clone failed:', errorMessage);

    broadcast('clone:progress', {
      stage: 'error',
      message: `Clone failed: ${errorMessage}`,
    } as CloneProgress);

    // Clean up partial clone
    try {
      await fsPromises.rm(targetDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Detect setup commands based on project files
 */
export async function detectSetupCommands(projectPath: string): Promise<SetupCommand[]> {
  const commands: SetupCommand[] = [];

  try {
    const files = await fsPromises.readdir(projectPath);
    const fileSet = new Set(files.map(f => f.toLowerCase()));

    // Node.js projects
    if (files.includes('package.json')) {
      if (files.includes('pnpm-lock.yaml')) {
        commands.push({
          command: 'pnpm',
          args: ['install'],
          description: 'Install Node.js dependencies with pnpm',
          packageManager: 'pnpm',
        });
      } else if (files.includes('yarn.lock')) {
        commands.push({
          command: 'yarn',
          args: ['install'],
          description: 'Install Node.js dependencies with Yarn',
          packageManager: 'yarn',
        });
      } else if (files.includes('bun.lockb')) {
        commands.push({
          command: 'bun',
          args: ['install'],
          description: 'Install Node.js dependencies with Bun',
          packageManager: 'bun',
        });
      } else {
        // Default to npm
        commands.push({
          command: 'npm',
          args: ['install'],
          description: 'Install Node.js dependencies with npm',
          packageManager: 'npm',
        });
      }
    }

    // Python projects
    if (files.includes('requirements.txt')) {
      commands.push({
        command: 'pip',
        args: ['install', '-r', 'requirements.txt'],
        description: 'Install Python dependencies from requirements.txt',
        packageManager: 'pip',
      });
    } else if (files.includes('pyproject.toml')) {
      // Check if it's a poetry project or standard pip
      try {
        const pyproject = await fsPromises.readFile(
          path.join(projectPath, 'pyproject.toml'),
          'utf-8'
        );

        if (pyproject.includes('[tool.poetry]')) {
          commands.push({
            command: 'poetry',
            args: ['install'],
            description: 'Install Python dependencies with Poetry',
            packageManager: 'poetry',
          });
        } else if (pyproject.includes('[tool.uv]') || files.includes('uv.lock')) {
          commands.push({
            command: 'uv',
            args: ['sync'],
            description: 'Install Python dependencies with uv',
            packageManager: 'uv',
          });
        } else {
          commands.push({
            command: 'pip',
            args: ['install', '-e', '.'],
            description: 'Install Python package in editable mode',
            packageManager: 'pip',
          });
        }
      } catch {
        commands.push({
          command: 'pip',
          args: ['install', '-e', '.'],
          description: 'Install Python package in editable mode',
          packageManager: 'pip',
        });
      }
    } else if (files.includes('setup.py')) {
      commands.push({
        command: 'pip',
        args: ['install', '-e', '.'],
        description: 'Install Python package in editable mode',
        packageManager: 'pip',
      });
    } else if (files.includes('Pipfile')) {
      commands.push({
        command: 'pipenv',
        args: ['install'],
        description: 'Install Python dependencies with Pipenv',
        packageManager: 'pipenv',
      });
    }

    // Rust projects
    if (files.includes('Cargo.toml')) {
      commands.push({
        command: 'cargo',
        args: ['build'],
        description: 'Build Rust project',
        packageManager: 'cargo',
      });
    }

    // Go projects
    if (files.includes('go.mod')) {
      commands.push({
        command: 'go',
        args: ['mod', 'download'],
        description: 'Download Go module dependencies',
        packageManager: 'go',
      });
    }

    // Ruby projects
    if (files.includes('Gemfile')) {
      commands.push({
        command: 'bundle',
        args: ['install'],
        description: 'Install Ruby dependencies with Bundler',
        packageManager: 'bundler',
      });
    }

    // PHP projects
    if (files.includes('composer.json')) {
      commands.push({
        command: 'composer',
        args: ['install'],
        description: 'Install PHP dependencies with Composer',
        packageManager: 'composer',
      });
    }

    // .NET projects
    const hasDotnet = files.some(f =>
      f.endsWith('.csproj') || f.endsWith('.fsproj') || f.endsWith('.sln')
    );
    if (hasDotnet) {
      commands.push({
        command: 'dotnet',
        args: ['restore'],
        description: 'Restore .NET dependencies',
        packageManager: 'dotnet',
      });
    }

    // Elixir projects
    if (files.includes('mix.exs')) {
      commands.push({
        command: 'mix',
        args: ['deps.get'],
        description: 'Fetch Elixir dependencies',
        packageManager: 'mix',
      });
    }

    // Swift/iOS projects
    if (files.includes('Package.swift')) {
      commands.push({
        command: 'swift',
        args: ['package', 'resolve'],
        description: 'Resolve Swift package dependencies',
        packageManager: 'swift',
      });
    }

    // Gradle (Java/Kotlin)
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
      commands.push({
        command: './gradlew',
        args: ['build', '--no-daemon'],
        description: 'Build with Gradle',
        packageManager: 'gradle',
      });
    }

    // Maven (Java)
    if (files.includes('pom.xml')) {
      commands.push({
        command: 'mvn',
        args: ['install', '-DskipTests'],
        description: 'Build with Maven',
        packageManager: 'maven',
      });
    }

  } catch (err) {
    log.error('Error detecting setup commands:', err);
  }

  return commands;
}

/**
 * Run setup commands in a project directory
 */
export async function runSetupCommands(
  projectPath: string,
  commands: SetupCommand[]
): Promise<SetupResult> {
  const result: SetupResult = {
    success: true,
    completedCommands: [],
    failedCommands: [],
  };

  for (const cmd of commands) {
    const fullCommand = `${cmd.command} ${cmd.args.join(' ')}`;

    broadcast('setup:progress', {
      command: fullCommand,
      status: 'running',
      description: cmd.description,
    });

    try {
      log.info(`Running: ${fullCommand} in ${projectPath}`);

      await execAsync(fullCommand, {
        cwd: projectPath,
        timeout: 5 * 60 * 1000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      result.completedCommands.push(fullCommand);

      broadcast('setup:progress', {
        command: fullCommand,
        status: 'completed',
        description: cmd.description,
      });

      log.info(`Completed: ${fullCommand}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      result.failedCommands.push({
        command: fullCommand,
        error: errorMessage,
      });
      result.success = false;

      broadcast('setup:progress', {
        command: fullCommand,
        status: 'failed',
        error: errorMessage,
        description: cmd.description,
      });

      log.error(`Failed: ${fullCommand}`, errorMessage);

      // Continue with other commands even if one fails
    }
  }

  return result;
}

/**
 * Validate a git URL
 */
export function isValidGitUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();

  // HTTPS URLs
  if (/^https?:\/\/.+\/.+/.test(trimmed)) {
    return true;
  }

  // SSH URLs (git@host:user/repo.git)
  if (/^git@[\w.-]+:.+\/.+/.test(trimmed)) {
    return true;
  }

  // Git protocol URLs
  if (/^git:\/\/.+\/.+/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Get repository info from URL without cloning
 */
export async function getRepoInfo(repoUrl: string): Promise<{
  name: string;
  defaultBranch?: string;
  size?: string;
  error?: string;
}> {
  const name = extractRepoName(repoUrl);

  try {
    // Try to get remote info using git ls-remote
    const { stdout } = await execAsync(
      `git ls-remote --symref ${repoUrl} HEAD`,
      { timeout: 10000 }
    );

    // Parse default branch from symref output
    // Format: ref: refs/heads/main  HEAD
    const match = stdout.match(/ref: refs\/heads\/(\S+)/);
    const defaultBranch = match ? match[1] : undefined;

    return {
      name,
      defaultBranch,
    };
  } catch (err) {
    return {
      name,
      error: err instanceof Error ? err.message : 'Failed to fetch repository info',
    };
  }
}
