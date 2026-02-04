import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Store from 'electron-store';
import { getExecutor } from './executor';
import { createTask, type TaskPriority } from './tasks';
import { createLogger } from '../utils/logger';

const log = createLogger('ProjectBriefs');

// Types
export interface ProjectBrief {
  id: string;
  projectId: string;
  projectPath: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  techStack: string[];
  keyFiles: Array<{ path: string; purpose: string }>;
  architecture: string;
  recentChanges: Array<{ date: string; summary: string; hash: string }>;
  activeWork: string[];
  suggestedTasks: Array<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }>;
  codeMetrics?: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };
}

export interface DeepDiveTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  estimatedComplexity: 'low' | 'medium' | 'high';
  executionOutput?: string;
  executionError?: string;
  executedAt?: string;
}

export interface DeepDivePlan {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  status: 'draft' | 'approved' | 'in_progress' | 'completed';
  phases: Array<{
    id: string;
    name: string;
    description: string;
    tasks: DeepDiveTask[];
  }>;
  totalTasks: number;
  completedTasks: number;
}

export interface NewProjectSpec {
  name: string;
  description: string;
  type: 'web' | 'cli' | 'library' | 'api' | 'desktop' | 'mobile' | 'other';
  techStack: string[];
  features: string[];
  structure?: Record<string, string>; // path -> description
}

interface BriefsStore {
  briefs: Record<string, ProjectBrief>;
  deepDivePlans: Record<string, DeepDivePlan>;
}

const defaults: BriefsStore = {
  briefs: {},
  deepDivePlans: {},
};

let store: Store<BriefsStore>;

// Generate a simple unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function initBriefsStore(): void {
  store = new Store<BriefsStore>({
    name: 'project-briefs',
    defaults,
  });
}

function getStore(): Store<BriefsStore> {
  if (!store) initBriefsStore();
  return store;
}

// Read file safely
function safeReadFile(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    log.error(`Error reading ${filePath}:`, error);
  }
  return null;
}

// Execute git command safely
function safeGitCommand(projectPath: string, command: string): string | null {
  try {
    const result = execSync(command, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error) {
    return null;
  }
}

// Scan project structure
function scanProjectStructure(projectPath: string): {
  files: string[];
  directories: string[];
  keyFiles: Array<{ path: string; type: string }>;
} {
  const files: string[] = [];
  const directories: string[] = [];
  const keyFiles: Array<{ path: string; type: string }> = [];

  const importantFiles = [
    'package.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'pyproject.toml',
    'CLAUDE.md', 'README.md', 'Dockerfile', 'docker-compose.yml',
    'tsconfig.json', 'vite.config.ts', 'webpack.config.js',
    '.env.example', 'Makefile', 'CMakeLists.txt',
  ];

  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', 'target', '.next', 'vendor'];

  function walk(dir: string, depth: number = 0) {
    if (depth > 5) return; // Limit depth

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);

        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            directories.push(relativePath);
            walk(fullPath, depth + 1);
          }
        } else {
          files.push(relativePath);

          // Check if it's an important file
          if (importantFiles.includes(entry.name)) {
            keyFiles.push({ path: relativePath, type: entry.name });
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  walk(projectPath);
  return { files, directories, keyFiles };
}

// Detect tech stack from files
function detectTechStack(projectPath: string): string[] {
  const techStack: string[] = [];

  // Check package.json
  const packageJson = safeReadFile(path.join(projectPath, 'package.json'));
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['react'] || deps['react-dom']) techStack.push('React');
      if (deps['vue']) techStack.push('Vue');
      if (deps['@angular/core']) techStack.push('Angular');
      if (deps['next']) techStack.push('Next.js');
      if (deps['express']) techStack.push('Express');
      if (deps['typescript']) techStack.push('TypeScript');
      if (deps['electron']) techStack.push('Electron');
      if (deps['tailwindcss']) techStack.push('Tailwind CSS');
      if (deps['prisma'] || deps['@prisma/client']) techStack.push('Prisma');
      if (deps['mongoose']) techStack.push('MongoDB/Mongoose');
      if (deps['sequelize']) techStack.push('Sequelize');

      if (techStack.length === 0 && Object.keys(deps).length > 0) {
        techStack.push('Node.js');
      }
    } catch (e) {
      // Invalid JSON
    }
  }

  // Check for other languages
  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) techStack.push('Rust');
  if (fs.existsSync(path.join(projectPath, 'go.mod'))) techStack.push('Go');
  if (fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
      fs.existsSync(path.join(projectPath, 'pyproject.toml'))) techStack.push('Python');
  if (fs.existsSync(path.join(projectPath, 'Gemfile'))) techStack.push('Ruby');
  if (fs.existsSync(path.join(projectPath, 'pom.xml'))) techStack.push('Java/Maven');
  if (fs.existsSync(path.join(projectPath, 'build.gradle'))) techStack.push('Kotlin/Gradle');

  return [...new Set(techStack)];
}

// Get recent git commits
function getRecentCommits(projectPath: string, limit: number = 10): Array<{ date: string; summary: string; hash: string }> {
  const gitLog = safeGitCommand(
    projectPath,
    `git log --oneline --pretty=format:"%h|%ad|%s" --date=short -n ${limit}`
  );

  if (!gitLog) return [];

  return gitLog.split('\n').filter(line => line.trim()).map(line => {
    const [hash, date, ...messageParts] = line.split('|');
    return {
      hash: hash || '',
      date: date || '',
      summary: messageParts.join('|') || '',
    };
  });
}

// Find TODO/FIXME comments
function findTodoComments(projectPath: string): string[] {
  const todos: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.rb'];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', 'target'];

  function searchFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const match = line.match(/(?:\/\/|#|\/\*)\s*(TODO|FIXME|HACK|XXX)[\s:]+(.+)/i);
        if (match) {
          const relativePath = path.relative(projectPath, filePath);
          todos.push(`${relativePath}:${index + 1}: ${match[1]}: ${match[2].trim()}`);
        }
      });
    } catch (error) {
      // Ignore read errors
    }
  }

  function walk(dir: string, depth: number = 0) {
    if (depth > 5 || todos.length > 50) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            walk(fullPath, depth + 1);
          }
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          searchFile(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  walk(projectPath);
  return todos.slice(0, 20); // Limit to 20
}

// Generate project brief
export async function generateProjectBrief(
  projectId: string,
  projectPath: string,
  projectName: string
): Promise<ProjectBrief> {
  // Scan project
  const structure = scanProjectStructure(projectPath);
  const techStack = detectTechStack(projectPath);
  const recentCommits = getRecentCommits(projectPath);
  const todos = findTodoComments(projectPath);

  // Read key files for context
  const claudeMd = safeReadFile(path.join(projectPath, 'CLAUDE.md'));
  const readmeMd = safeReadFile(path.join(projectPath, 'README.md'));
  const packageJson = safeReadFile(path.join(projectPath, 'package.json'));

  // Build context for Claude
  let context = `Project: ${projectName}\nPath: ${projectPath}\n\n`;

  if (claudeMd) {
    context += `## CLAUDE.md\n${claudeMd.substring(0, 3000)}\n\n`;
  }

  if (readmeMd) {
    context += `## README.md\n${readmeMd.substring(0, 2000)}\n\n`;
  }

  if (packageJson) {
    context += `## package.json\n${packageJson.substring(0, 1500)}\n\n`;
  }

  context += `## Tech Stack Detected\n${techStack.join(', ')}\n\n`;
  context += `## Directory Structure\n${structure.directories.slice(0, 30).join('\n')}\n\n`;
  context += `## Recent Commits\n${recentCommits.map(c => `${c.date}: ${c.summary}`).join('\n')}\n\n`;

  if (todos.length > 0) {
    context += `## TODOs/FIXMEs Found\n${todos.join('\n')}\n\n`;
  }

  // Generate summary and suggestions with Claude
  let summary = '';
  let architecture = '';
  let suggestedTasks: ProjectBrief['suggestedTasks'] = [];
  let keyFilesWithPurpose: ProjectBrief['keyFiles'] = [];

  try {
    const executor = await getExecutor();
    const prompt = `Analyze this project and provide a brief. Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence project summary",
  "architecture": "Brief architecture description",
  "keyFiles": [{"path": "file.ts", "purpose": "What this file does"}],
  "suggestedTasks": [{"title": "Task title", "description": "Description", "priority": "high|medium|low"}]
}

Project Context:
${context}

Return ONLY valid JSON, no markdown or explanation.`;

    const result = await executor.runClaude(prompt, 'You are a code analysis assistant. Analyze projects and return structured JSON.');

    if (result.success && result.response) {
      try {
        // Try to extract JSON from response
        let jsonStr = result.response;
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);
        summary = parsed.summary || '';
        architecture = parsed.architecture || '';
        suggestedTasks = parsed.suggestedTasks || [];
        keyFilesWithPurpose = parsed.keyFiles || [];
      } catch (e) {
        // If JSON parsing fails, use the raw response as summary
        summary = result.response.substring(0, 500);
      }
    }
  } catch (error) {
    log.error('Error generating brief with Claude:', error);
    summary = `${projectName} - ${techStack.join(', ')} project`;
  }

  // Fallback key files
  if (keyFilesWithPurpose.length === 0) {
    keyFilesWithPurpose = structure.keyFiles.map(kf => ({
      path: kf.path,
      purpose: kf.type === 'package.json' ? 'Node.js dependencies and scripts' :
               kf.type === 'CLAUDE.md' ? 'Claude Code instructions' :
               kf.type === 'README.md' ? 'Project documentation' :
               kf.type === 'Dockerfile' ? 'Container configuration' :
               kf.type,
    }));
  }

  const brief: ProjectBrief = {
    id: generateId(),
    projectId,
    projectPath,
    projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: summary || `${projectName} project using ${techStack.join(', ')}`,
    techStack,
    keyFiles: keyFilesWithPurpose,
    architecture: architecture || 'Architecture analysis pending',
    recentChanges: recentCommits,
    activeWork: todos,
    suggestedTasks: suggestedTasks.length > 0 ? suggestedTasks : [
      {
        title: 'Review project structure',
        description: 'Understand the codebase organization',
        priority: 'medium',
      },
    ],
    codeMetrics: {
      totalFiles: structure.files.length,
      totalLines: 0, // Could be calculated but expensive
      languages: {}, // Could detect from extensions
    },
  };

  // Save to store
  const briefs = getStore().get('briefs');
  briefs[projectId] = brief;
  getStore().set('briefs', briefs);

  return brief;
}

// Get existing brief
export function getProjectBrief(projectId: string): ProjectBrief | null {
  const briefs = getStore().get('briefs');
  return briefs[projectId] || null;
}

// Delete brief
export function deleteProjectBrief(projectId: string): boolean {
  const briefs = getStore().get('briefs');
  if (briefs[projectId]) {
    delete briefs[projectId];
    getStore().set('briefs', briefs);
    return true;
  }
  return false;
}

// List all briefs
export function listProjectBriefs(): ProjectBrief[] {
  const briefs = getStore().get('briefs');
  return Object.values(briefs);
}

// Generate deep dive plan
export async function generateDeepDivePlan(
  projectId: string,
  projectPath: string,
  projectName: string,
  focus?: string
): Promise<DeepDivePlan> {
  // Get or generate brief first
  let brief = getProjectBrief(projectId);
  if (!brief) {
    brief = await generateProjectBrief(projectId, projectPath, projectName);
  }

  // Generate plan with Claude
  let phases: DeepDivePlan['phases'] = [];

  try {
    const executor = await getExecutor();
    const prompt = `Create a deep dive implementation plan for this project. ${focus ? `Focus area: ${focus}` : ''}

Project Brief:
- Name: ${brief.projectName}
- Summary: ${brief.summary}
- Tech Stack: ${brief.techStack.join(', ')}
- Architecture: ${brief.architecture}
- Active TODOs: ${brief.activeWork.slice(0, 5).join('; ')}
- Suggested Tasks: ${brief.suggestedTasks.map(t => t.title).join(', ')}

Return a JSON object with phases and tasks:
{
  "phases": [
    {
      "name": "Phase name",
      "description": "What this phase accomplishes",
      "tasks": [
        {
          "title": "Task title",
          "description": "Detailed description",
          "estimatedComplexity": "low|medium|high"
        }
      ]
    }
  ]
}

Create 3-5 phases with 2-4 tasks each. Return ONLY valid JSON.`;

    const result = await executor.runClaude(prompt, 'You are a project planning assistant. Create detailed implementation plans.');

    if (result.success && result.response) {
      try {
        let jsonStr = result.response;
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);
        phases = (parsed.phases || []).map((phase: { name: string; description: string; tasks: Array<{ title: string; description: string; estimatedComplexity: string }> }) => ({
          id: generateId(),
          name: phase.name,
          description: phase.description,
          tasks: (phase.tasks || []).map((task: { title: string; description: string; estimatedComplexity: string }) => ({
            id: generateId(),
            title: task.title,
            description: task.description,
            status: 'pending' as const,
            estimatedComplexity: task.estimatedComplexity as 'low' | 'medium' | 'high',
          })),
        }));
      } catch (e) {
        log.error('Error parsing deep dive plan:', e);
      }
    }
  } catch (error) {
    log.error('Error generating deep dive plan:', error);
  }

  // Fallback phases
  if (phases.length === 0) {
    phases = [
      {
        id: generateId(),
        name: 'Understanding',
        description: 'Understand the existing codebase and architecture',
        tasks: [
          {
            id: generateId(),
            title: 'Review project structure',
            description: 'Analyze directory layout and file organization',
            status: 'pending',
            estimatedComplexity: 'low',
          },
          {
            id: generateId(),
            title: 'Identify key components',
            description: 'Find and document main modules and their responsibilities',
            status: 'pending',
            estimatedComplexity: 'medium',
          },
        ],
      },
      {
        id: generateId(),
        name: 'Implementation',
        description: 'Implement planned features and improvements',
        tasks: brief.suggestedTasks.map(task => ({
          id: generateId(),
          title: task.title,
          description: task.description,
          status: 'pending' as const,
          estimatedComplexity: task.priority === 'high' ? 'high' as const : task.priority === 'low' ? 'low' as const : 'medium' as const,
        })),
      },
    ];
  }

  const totalTasks = phases.reduce((sum, phase) => sum + phase.tasks.length, 0);

  const plan: DeepDivePlan = {
    id: generateId(),
    projectId,
    projectName,
    createdAt: new Date().toISOString(),
    status: 'draft',
    phases,
    totalTasks,
    completedTasks: 0,
  };

  // Save to store
  const plans = getStore().get('deepDivePlans');
  plans[projectId] = plan;
  getStore().set('deepDivePlans', plans);

  return plan;
}

// Get deep dive plan
export function getDeepDivePlan(projectId: string): DeepDivePlan | null {
  const plans = getStore().get('deepDivePlans');
  return plans[projectId] || null;
}

// Update deep dive plan status
export function updateDeepDivePlan(
  projectId: string,
  updates: Partial<Pick<DeepDivePlan, 'status'>> & {
    taskUpdates?: Array<{
      taskId: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      executionOutput?: string;
      executionError?: string;
      executedAt?: string;
    }>;
  }
): DeepDivePlan | null {
  const plans = getStore().get('deepDivePlans');
  const plan = plans[projectId];

  if (!plan) return null;

  if (updates.status) {
    plan.status = updates.status;
  }

  if (updates.taskUpdates) {
    for (const taskUpdate of updates.taskUpdates) {
      for (const phase of plan.phases) {
        const task = phase.tasks.find(t => t.id === taskUpdate.taskId);
        if (task) {
          task.status = taskUpdate.status;
          if (taskUpdate.executionOutput !== undefined) {
            task.executionOutput = taskUpdate.executionOutput;
          }
          if (taskUpdate.executionError !== undefined) {
            task.executionError = taskUpdate.executionError;
          }
          if (taskUpdate.executedAt !== undefined) {
            task.executedAt = taskUpdate.executedAt;
          }
          break;
        }
      }
    }

    // Recalculate completed tasks
    plan.completedTasks = plan.phases.reduce(
      (sum, phase) => sum + phase.tasks.filter(t => t.status === 'completed').length,
      0
    );
  }

  plans[projectId] = plan;
  getStore().set('deepDivePlans', plans);

  return plan;
}

// Delete deep dive plan
export function deleteDeepDivePlan(projectId: string): boolean {
  const plans = getStore().get('deepDivePlans');
  if (plans[projectId]) {
    delete plans[projectId];
    getStore().set('deepDivePlans', plans);
    return true;
  }
  return false;
}

// Action classification for determining if approval is needed
interface ActionClassification {
  requiresApproval: boolean;
  reason?: string;
}

function classifyDeepDiveAction(taskTitle: string, taskDescription: string, claudeResponse: string): ActionClassification {
  // Only check Claude's response for risky operations - not the task title/description
  // The user already approved the task when they clicked Execute
  const responseText = claudeResponse.toLowerCase();

  // Check for actually dangerous operations in Claude's response
  const riskyPatterns = [
    { pattern: /git push(?! --dry-run)|pushed to (?:remote|origin|main|master)/, reason: 'Git push operation' },
    { pattern: /rm -rf|deleted \d+ files|removing directory/, reason: 'Bulk file deletion' },
    { pattern: /drop table|truncate table|delete from .* where 1|deleted.*database/, reason: 'Database modification' },
    { pattern: /deployed to production|pushing to production|released version/, reason: 'Production deployment' },
  ];

  for (const { pattern, reason } of riskyPatterns) {
    if (pattern.test(responseText)) {
      return { requiresApproval: true, reason };
    }
  }

  return { requiresApproval: false };
}

// Execute a deep dive task
export interface ExecuteDeepDiveTaskResult {
  success: boolean;
  output?: string;
  error?: string;
  requiresApproval?: boolean;
  approvalReason?: string;
}

export async function executeDeepDiveTask(
  projectId: string,
  taskId: string
): Promise<ExecuteDeepDiveTaskResult> {
  // Get the plan
  const plan = getDeepDivePlan(projectId);
  if (!plan) {
    return { success: false, error: 'Deep dive plan not found' };
  }

  // Find the task and its phase
  let targetTask: DeepDiveTask | null = null;
  let targetPhase: { id: string; name: string; description: string } | null = null;

  for (const phase of plan.phases) {
    const task = phase.tasks.find(t => t.id === taskId);
    if (task) {
      targetTask = task;
      targetPhase = { id: phase.id, name: phase.name, description: phase.description };
      break;
    }
  }

  if (!targetTask || !targetPhase) {
    return { success: false, error: 'Task not found in plan' };
  }

  // Get project brief for context
  const brief = getProjectBrief(projectId);

  // Update task status to in_progress
  updateDeepDivePlan(projectId, {
    taskUpdates: [{
      taskId,
      status: 'in_progress',
    }],
  });

  try {
    const executor = await getExecutor();

    // Build the prompt with full context
    const prompt = `Execute the following task in this project:

PROJECT: ${plan.projectName}
PATH: ${brief?.projectPath || process.cwd()}
TECH STACK: ${brief?.techStack?.join(', ') || 'Unknown'}

PHASE: ${targetPhase.name}
PHASE GOAL: ${targetPhase.description}

TASK: ${targetTask.title}
DETAILS: ${targetTask.description}

Instructions:
1. Read and understand the relevant code files
2. Make the necessary changes to complete the task
3. Report what you did and what files were modified

Do NOT ask clarifying questions - proceed with the most reasonable interpretation.
Do NOT just describe what should be done - actually do it using the available tools.`;

    const systemPrompt = `You are executing a coding task. Use the Read, Edit, Write, Grep, and Glob tools to complete the task.
Do not engage in conversation - execute the task directly.
If you cannot complete the task, explain why and what blockers exist.`;

    // Generate execution ID for tracking/cancellation
    const executionId = `deepdive-${projectId}-${taskId}`;

    // Execute with Claude
    const result = await executor.runClaude(prompt, systemPrompt, brief?.projectPath, undefined, executionId);

    if (!result.success) {
      // Update task as failed
      updateDeepDivePlan(projectId, {
        taskUpdates: [{
          taskId,
          status: 'failed',
          executionError: result.error || 'Execution failed',
          executedAt: new Date().toISOString(),
        }],
      });

      return {
        success: false,
        error: result.error || 'Task execution failed',
      };
    }

    const response = result.response || '';

    // Check if the action requires approval
    const classification = classifyDeepDiveAction(targetTask.title, targetTask.description, response);

    if (classification.requiresApproval) {
      // Keep task in_progress, return approval needed
      return {
        success: true,
        output: response,
        requiresApproval: true,
        approvalReason: classification.reason,
      };
    }

    // Task completed successfully
    updateDeepDivePlan(projectId, {
      taskUpdates: [{
        taskId,
        status: 'completed',
        executionOutput: response,
        executedAt: new Date().toISOString(),
      }],
    });

    return {
      success: true,
      output: response,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update task as failed
    updateDeepDivePlan(projectId, {
      taskUpdates: [{
        taskId,
        status: 'failed',
        executionError: errorMessage,
        executedAt: new Date().toISOString(),
      }],
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Generate new project structure
export async function generateNewProjectStructure(
  spec: NewProjectSpec
): Promise<{ structure: Record<string, string>; files: Record<string, string> }> {
  const executor = await getExecutor();

  const prompt = `Generate a project structure for:
Name: ${spec.name}
Description: ${spec.description}
Type: ${spec.type}
Tech Stack: ${spec.techStack.join(', ')}
Features: ${spec.features.join(', ')}

Return a JSON object with:
{
  "structure": {
    "path/to/dir": "What this directory contains"
  },
  "files": {
    "path/to/file.ext": "File contents or template"
  }
}

Include essential files like package.json, README.md, CLAUDE.md, etc.
Return ONLY valid JSON.`;

  const result = await executor.runClaude(prompt, 'You are a project scaffolding assistant. Generate well-structured project templates.');

  if (result.success && result.response) {
    try {
      let jsonStr = result.response;
      const jsonMatch = result.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      return {
        structure: parsed.structure || {},
        files: parsed.files || {},
      };
    } catch (e) {
      log.error('Error parsing project structure:', e);
    }
  }

  // Return minimal fallback
  return {
    structure: {
      'src': 'Source code',
      'tests': 'Test files',
    },
    files: {
      'README.md': `# ${spec.name}\n\n${spec.description}`,
      'CLAUDE.md': `# ${spec.name}\n\n## Overview\n${spec.description}\n\n## Tech Stack\n${spec.techStack.join(', ')}`,
    },
  };
}

// Scaffold new project
export async function scaffoldNewProject(
  targetPath: string,
  spec: NewProjectSpec
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate structure
    const { structure, files } = await generateNewProjectStructure(spec);

    // Create target directory
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Create directories
    for (const dir of Object.keys(structure)) {
      const fullPath = path.join(targetPath, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }

    // Create files
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(targetPath, filePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    // Initialize git
    try {
      execSync('git init', { cwd: targetPath, stdio: 'pipe' });
    } catch (e) {
      // Git init failed, not critical
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Convert Deep Dive tasks to project tasks
export interface ConvertToTasksResult {
  success: boolean;
  tasksCreated: number;
  error?: string;
}

export function convertDeepDiveToTasks(
  projectId: string,
  options?: {
    phaseIds?: string[];  // Only convert tasks from these phases (all if not specified)
    taskIds?: string[];   // Only convert these specific tasks (all if not specified)
  }
): ConvertToTasksResult {
  const plan = getDeepDivePlan(projectId);
  if (!plan) {
    return { success: false, tasksCreated: 0, error: 'Deep dive plan not found' };
  }

  const brief = getProjectBrief(projectId);
  let tasksCreated = 0;

  for (const phase of plan.phases) {
    // Skip phases not in the filter (if filter provided)
    if (options?.phaseIds && !options.phaseIds.includes(phase.id)) {
      continue;
    }

    for (const task of phase.tasks) {
      // Skip tasks not in the filter (if filter provided)
      if (options?.taskIds && !options.taskIds.includes(task.id)) {
        continue;
      }

      // Skip already completed tasks
      if (task.status === 'completed') {
        continue;
      }

      // Map complexity to priority
      const priorityMap: Record<string, TaskPriority> = {
        'high': 'high',
        'medium': 'medium',
        'low': 'low',
      };
      const priority = priorityMap[task.estimatedComplexity] || 'medium';

      // Create the task with context from the phase
      const description = `**Phase: ${phase.name}**\n${phase.description}\n\n**Task:**\n${task.description}`;

      createTask({
        title: task.title,
        description,
        status: 'todo',
        priority,
        projectId,
        projectName: brief?.projectName || plan.projectName,
      });

      tasksCreated++;
    }
  }

  return { success: true, tasksCreated };
}

// Convert a single Deep Dive task to a project task
export function convertSingleTaskToProjectTask(
  projectId: string,
  taskId: string
): ConvertToTasksResult {
  return convertDeepDiveToTasks(projectId, { taskIds: [taskId] });
}
