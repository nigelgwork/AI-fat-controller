import { getExecutor } from './executor';
import { captureScreen, analyzeScreenshot } from './screenshot';
import { getMCPManager, WindowsAutomationMCP } from './mcp-client';
import * as fs from 'fs';
import * as path from 'path';
import { getDataDir } from '../utils/paths';
import { broadcast } from '../websocket';
import { createLogger } from '../utils/logger';
import {
  listScenarios as repoListScenarios,
  getScenario as repoGetScenario,
  createScenario as repoCreateScenario,
  updateScenario as repoUpdateScenario,
  deleteScenario as repoDeleteScenario,
  getResults as repoGetResults,
  saveResult as repoSaveResult,
  type TestScenario,
  type TestStep,
  type TestActionType,
  type StepResult,
  type TestResult,
} from '../db/repositories/gui-test-repo';

const log = createLogger('GUITest');

// Re-export types
export type { TestScenario, TestStep, TestActionType, StepResult, TestResult };

// Execution mode for tests
export type TestExecutionMode = 'mcp-direct' | 'claude-assisted' | 'hybrid';

// Configuration for test execution
export interface TestExecutionConfig {
  mode: TestExecutionMode;
  mcpServerName?: string; // Which MCP server to use for direct execution
  takeScreenshotsAfterSteps: boolean;
  stopOnFirstFailure: boolean;
  stepTimeout: number; // ms
}

// Generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Get the test results directory (for file-based result storage backup)
function getResultsDir(): string {
  const resultsDir = path.join(getDataDir(), 'gui-tests', 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  return resultsDir;
}

// Notify renderer of test progress via WebSocket
function notifyTestProgress(data: { scenarioId: string; stepIndex: number; totalSteps: number; status: string }): void {
  broadcast('gui-test:progress', data);
}

function notifyTestComplete(result: TestResult): void {
  broadcast('gui-test:complete', result);
}

// Build the prompt for Claude to execute a test step using Windows MCP
function buildStepPrompt(step: TestStep, context: { appName?: string; previousSteps: string[] }): string {
  const contextInfo = context.previousSteps.length > 0
    ? `Previous steps completed:\n${context.previousSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`
    : '';

  switch (step.action) {
    case 'click':
      return `${contextInfo}Use the Windows MCP click tool to: ${step.description}
Parameters: ${JSON.stringify(step.params)}
After clicking, briefly describe what happened.`;

    case 'type':
      return `${contextInfo}Use the Windows MCP type tool to: ${step.description}
Text to type: "${step.params.text || ''}"
${step.params.clear ? 'Clear existing text first.' : ''}
After typing, briefly describe the result.`;

    case 'scroll':
      return `${contextInfo}Use the Windows MCP scroll tool to: ${step.description}
Direction: ${step.params.direction || 'down'}
Amount: ${step.params.amount || 'moderate'}`;

    case 'shortcut':
      return `${contextInfo}Use the Windows MCP shortcut tool to press: ${step.params.keys}
Purpose: ${step.description}`;

    case 'wait':
      return `${contextInfo}Wait for ${step.params.duration || 1000}ms.
Reason: ${step.description}`;

    case 'app':
      return `${contextInfo}Use the Windows MCP app tool to: ${step.description}
Action: ${step.params.action || 'launch'}
${step.params.appName ? `Application: ${step.params.appName}` : ''}
${step.params.windowAction ? `Window action: ${step.params.windowAction}` : ''}`;

    case 'shell':
      return `${contextInfo}Use the Windows MCP shell tool to execute:
${step.params.command}
Purpose: ${step.description}`;

    case 'snapshot':
      return `${contextInfo}Use the Windows MCP snapshot tool to capture the current state.
${step.params.use_vision ? 'Include screenshot (use_vision=True).' : ''}
${step.params.use_dom ? 'Include DOM content (use_dom=True).' : ''}
Describe what you see.`;

    case 'verify':
      return `${contextInfo}VERIFICATION STEP: ${step.description}

Use the Windows MCP snapshot tool with use_vision=True to capture the current screen state.

Then analyze whether the following assertion is true:
- Type: ${step.assertion?.type}
- Looking for: "${step.assertion?.target}"

Respond with:
VERIFICATION_RESULT: [PASS/FAIL]
EXPECTED: ${step.assertion?.target}
ACTUAL: [what you actually see]
DETAILS: [explanation]`;

    case 'custom':
      return `${contextInfo}${step.description}
${step.params.instructions || ''}`;

    default:
      return `${contextInfo}Execute: ${step.description}`;
  }
}

// Parse verification result from Claude's response
function parseVerificationResult(response: string): { passed: boolean; expected: string; actual: string; details: string } {
  const resultMatch = response.match(/VERIFICATION_RESULT:\s*(PASS|FAIL)/i);
  const expectedMatch = response.match(/EXPECTED:\s*(.+?)(?=\n|ACTUAL:|$)/is);
  const actualMatch = response.match(/ACTUAL:\s*(.+?)(?=\n|DETAILS:|$)/is);
  const detailsMatch = response.match(/DETAILS:\s*(.+)/is);

  return {
    passed: resultMatch?.[1]?.toUpperCase() === 'PASS',
    expected: expectedMatch?.[1]?.trim() || '',
    actual: actualMatch?.[1]?.trim() || '',
    details: detailsMatch?.[1]?.trim() || response,
  };
}

// Execute a single test step via MCP directly (faster, more reliable)
async function executeStepViaMCP(
  step: TestStep,
  mcp: WindowsAutomationMCP
): Promise<StepResult> {
  const startTime = Date.now();
  const stepResult: StepResult = {
    stepId: step.id,
    status: 'passed',
    duration: 0,
  };

  try {
    switch (step.action) {
      case 'click': {
        // If coordinates provided, move and click
        if (step.params.x !== undefined && step.params.y !== undefined) {
          await mcp.mouseMove(step.params.x as number, step.params.y as number);
          await mcp.mouseClick(
            (step.params.button as 'left' | 'right' | 'middle') || 'left',
            (step.params.clicks as number) || 1
          );
        }
        // If control specified, click control
        else if (step.params.control && step.params.window) {
          await mcp.clickControl(
            step.params.window as string,
            step.params.control as string
          );
        }
        stepResult.output = `Clicked ${step.description}`;
        break;
      }

      case 'type': {
        const text = step.params.text as string || '';
        if (step.params.control && step.params.window) {
          await mcp.setControlText(
            step.params.window as string,
            step.params.control as string,
            text
          );
        } else {
          await mcp.typeText(text);
        }
        stepResult.output = `Typed "${text}"`;
        break;
      }

      case 'shortcut': {
        const keys = step.params.keys as string || '';
        await mcp.sendKeys(keys);
        stepResult.output = `Sent keys: ${keys}`;
        break;
      }

      case 'wait': {
        const duration = (step.params.duration as number) || 1000;
        await mcp.sleep(duration);
        stepResult.output = `Waited ${duration}ms`;
        break;
      }

      case 'app': {
        const action = step.params.action as string;
        const appName = step.params.appName as string;

        if (action === 'launch') {
          await mcp.launchApp(appName);
          // Wait for app to start
          await mcp.sleep(2000);
          stepResult.output = `Launched ${appName}`;
        } else if (action === 'close') {
          await mcp.closeProcess(appName);
          stepResult.output = `Closed ${appName}`;
        } else if (action === 'activate') {
          await mcp.activateWindow(appName);
          stepResult.output = `Activated ${appName}`;
        } else if (action === 'wait') {
          const timeout = (step.params.timeout as number) || 10000;
          const found = await mcp.waitForWindow(appName, timeout);
          if (!found) {
            stepResult.status = 'failed';
            stepResult.error = `Window "${appName}" not found within ${timeout}ms`;
          }
          stepResult.output = found ? `Window ${appName} found` : `Window ${appName} not found`;
        }
        break;
      }

      case 'scroll': {
        const direction = step.params.direction as string || 'down';
        const amount = step.params.amount as number || 3;
        const keys = direction === 'up' ? '{WHEELUP}' : '{WHEELDOWN}';
        for (let i = 0; i < amount; i++) {
          await mcp.sendKeys(keys);
        }
        stepResult.output = `Scrolled ${direction} ${amount} times`;
        break;
      }

      case 'snapshot': {
        const screenshotPath = await mcp.captureScreen();
        stepResult.screenshot = screenshotPath;
        stepResult.output = `Captured screenshot: ${screenshotPath}`;
        break;
      }

      case 'verify': {
        // Verification requires Claude to analyze - mark for hybrid execution
        stepResult.status = 'skipped';
        stepResult.output = 'Verification steps require Claude-assisted execution';
        break;
      }

      case 'shell': {
        // Shell commands need Claude or direct execution
        stepResult.status = 'skipped';
        stepResult.output = 'Shell steps require Claude-assisted execution';
        break;
      }

      default:
        stepResult.status = 'skipped';
        stepResult.output = `Unknown action: ${step.action}`;
    }

    stepResult.duration = Date.now() - startTime;
    return stepResult;

  } catch (error) {
    stepResult.duration = Date.now() - startTime;
    stepResult.status = 'error';
    stepResult.error = error instanceof Error ? error.message : String(error);
    return stepResult;
  }
}

// Execute a single test step via Claude (more flexible, handles complex scenarios)
async function executeStepViaClaude(
  step: TestStep,
  context: { appName?: string; previousSteps: string[] }
): Promise<StepResult> {
  const startTime = Date.now();
  const stepResult: StepResult = {
    stepId: step.id,
    status: 'passed',
    duration: 0,
  };

  try {
    const executor = await getExecutor();
    const prompt = buildStepPrompt(step, context);

    const systemPrompt = `You are a GUI test automation assistant with access to Windows MCP tools.
Execute the requested action precisely and report the result.
Available Windows MCP tools: click, type, scroll, shortcut, wait, app, shell, snapshot, scrape.
Be concise in your responses. For verification steps, follow the exact response format requested.`;

    const result = await executor.runClaude(prompt, systemPrompt);

    stepResult.duration = Date.now() - startTime;
    stepResult.output = result.response;

    if (!result.success) {
      stepResult.status = 'error';
      stepResult.error = result.error;
      return stepResult;
    }

    // For verification steps, parse the result
    if (step.action === 'verify' && step.assertion) {
      const verification = parseVerificationResult(result.response || '');
      stepResult.assertion = {
        expected: verification.expected || step.assertion.target,
        actual: verification.actual,
        passed: verification.passed,
      };
      stepResult.status = verification.passed ? 'passed' : 'failed';
    }

    // Capture a screenshot after the step (for evidence)
    const screenshot = await captureScreen();
    if (screenshot.success && screenshot.filePath) {
      stepResult.screenshot = screenshot.filePath;
    }

    return stepResult;

  } catch (error) {
    stepResult.duration = Date.now() - startTime;
    stepResult.status = 'error';
    stepResult.error = error instanceof Error ? error.message : String(error);
    return stepResult;
  }
}

// Execute a single test step - chooses method based on config
async function executeStep(
  step: TestStep,
  context: { appName?: string; previousSteps: string[] },
  config?: TestExecutionConfig
): Promise<StepResult> {
  const mode = config?.mode || 'claude-assisted';

  // For MCP direct or hybrid mode, try MCP first for supported actions
  if (mode === 'mcp-direct' || mode === 'hybrid') {
    const mcpManager = getMCPManager();
    const serverName = config?.mcpServerName || 'windows-desktop-automation';
    const mcp = mcpManager.getServer(serverName);

    if (mcp?.isConnected()) {
      // Actions that MCP can handle directly
      const mcpDirectActions: TestActionType[] = ['click', 'type', 'shortcut', 'wait', 'app', 'scroll', 'snapshot'];

      if (mcpDirectActions.includes(step.action)) {
        const result = await executeStepViaMCP(step, mcp);

        // If MCP succeeded or mode is mcp-direct, return result
        if (result.status !== 'skipped' || mode === 'mcp-direct') {
          // Take screenshot if configured
          if (config?.takeScreenshotsAfterSteps && !result.screenshot) {
            const screenshot = await captureScreen();
            if (screenshot.success && screenshot.filePath) {
              result.screenshot = screenshot.filePath;
            }
          }
          return result;
        }
      }
    }
  }

  // Fall back to Claude-assisted execution
  return executeStepViaClaude(step, context);
}

// Default execution configuration
const DEFAULT_EXECUTION_CONFIG: TestExecutionConfig = {
  mode: 'hybrid',
  takeScreenshotsAfterSteps: true,
  stopOnFirstFailure: true,
  stepTimeout: 30000,
};

// Run a complete test scenario
export async function runTestScenario(
  scenario: TestScenario,
  config?: Partial<TestExecutionConfig>
): Promise<TestResult> {
  const execConfig: TestExecutionConfig = { ...DEFAULT_EXECUTION_CONFIG, ...config };
  const startTime = new Date();
  const stepResults: StepResult[] = [];
  const previousSteps: string[] = [];

  const result: TestResult = {
    id: generateId(),
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: 'passed',
    startedAt: startTime.toISOString(),
    completedAt: '',
    duration: 0,
    stepResults: [],
    summary: { total: scenario.steps.length, passed: 0, failed: 0, skipped: 0 },
  };

  // Try to connect to MCP server if using MCP mode
  if (execConfig.mode === 'mcp-direct' || execConfig.mode === 'hybrid') {
    const mcpManager = getMCPManager();
    const serverName = execConfig.mcpServerName || 'windows-desktop-automation';

    try {
      if (!mcpManager.getServer(serverName)?.isConnected()) {
        await mcpManager.connect(serverName);
        log.info(`[GUI Test] Connected to MCP server: ${serverName}`);
      }
    } catch (error) {
      log.warn(`[GUI Test] Failed to connect to MCP server, falling back to Claude-assisted:`, error);
      if (execConfig.mode === 'mcp-direct') {
        result.status = 'error';
        result.completedAt = new Date().toISOString();
        result.duration = Date.now() - startTime.getTime();
        return result;
      }
    }
  }

  // Launch application if specified
  if (scenario.application) {
    const launchStep: TestStep = {
      id: 'launch-app',
      action: 'app',
      description: `Launch ${scenario.application}`,
      params: { action: 'launch', appName: scenario.application },
    };

    const launchResult = await executeStep(launchStep, { previousSteps: [] }, execConfig);
    if (launchResult.status === 'error') {
      result.status = 'error';
      result.completedAt = new Date().toISOString();
      result.duration = Date.now() - startTime.getTime();
      return result;
    }

    // Wait for app to launch
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Execute each step
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];

    notifyTestProgress({
      scenarioId: scenario.id,
      stepIndex: i,
      totalSteps: scenario.steps.length,
      status: `Executing: ${step.description}`,
    });

    const stepResult = await executeStep(step, {
      appName: scenario.application,
      previousSteps,
    }, execConfig);

    stepResults.push(stepResult);
    previousSteps.push(`${step.action}: ${step.description} - ${stepResult.status}`);

    // Update summary
    switch (stepResult.status) {
      case 'passed':
        result.summary.passed++;
        break;
      case 'failed':
        result.summary.failed++;
        result.status = 'failed';
        break;
      case 'skipped':
        result.summary.skipped++;
        break;
      case 'error':
        result.summary.failed++;
        result.status = 'error';
        break;
    }

    // Stop on first failure if configured
    if (execConfig.stopOnFirstFailure && (stepResult.status === 'failed' || stepResult.status === 'error')) {
      // Mark remaining steps as skipped
      for (let j = i + 1; j < scenario.steps.length; j++) {
        stepResults.push({
          stepId: scenario.steps[j].id,
          status: 'skipped',
          duration: 0,
        });
        result.summary.skipped++;
      }
      break;
    }
  }

  result.stepResults = stepResults;
  result.completedAt = new Date().toISOString();
  result.duration = Date.now() - startTime.getTime();

  // Save result to database
  repoSaveResult(result);

  notifyTestComplete(result);

  return result;
}

// CRUD operations for test scenarios (delegating to repo)
export function createTestScenario(scenario: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'>): TestScenario {
  return repoCreateScenario(scenario);
}

export function getTestScenario(id: string): TestScenario | null {
  return repoGetScenario(id);
}

export function updateTestScenario(id: string, updates: Partial<TestScenario>): TestScenario | null {
  return repoUpdateScenario(id, updates);
}

export function deleteTestScenario(id: string): boolean {
  return repoDeleteScenario(id);
}

export function listTestScenarios(): TestScenario[] {
  return repoListScenarios();
}

// Get test results for a scenario
export function getTestResults(scenarioId: string, limit?: number): TestResult[] {
  return repoGetResults(scenarioId, limit || 10);
}

// Generate a test scenario from natural language description
export async function generateTestScenario(
  description: string,
  appName?: string
): Promise<TestScenario> {
  const executor = await getExecutor();

  const prompt = `Generate a GUI test scenario based on this description:

"${description}"

${appName ? `Application to test: ${appName}` : ''}

Create a structured test with clear steps. For each step, specify:
- action: one of (click, type, scroll, shortcut, wait, app, shell, verify)
- description: what the step does
- params: relevant parameters
- For verify steps, include an assertion

Respond with valid JSON in this exact format:
{
  "name": "Test name",
  "description": "What this test verifies",
  "application": "${appName || 'null'}",
  "steps": [
    {
      "action": "app",
      "description": "Launch the application",
      "params": { "action": "launch", "appName": "..." }
    },
    {
      "action": "click",
      "description": "Click the Settings button",
      "params": { "target": "Settings button" }
    },
    {
      "action": "verify",
      "description": "Verify settings panel is visible",
      "params": {},
      "assertion": { "type": "visible", "target": "Settings panel" }
    }
  ]
}`;

  const result = await executor.runClaude(prompt,
    'You are a QA engineer creating automated GUI tests. Generate precise, executable test steps.');

  if (!result.success) {
    throw new Error(result.error || 'Failed to generate test scenario');
  }

  // Parse the JSON from the response
  const jsonMatch = result.response?.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse test scenario from response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Create the scenario with generated steps
  return createTestScenario({
    name: parsed.name || 'Generated Test',
    description: parsed.description || description,
    application: parsed.application || appName,
    steps: parsed.steps.map((step: Partial<TestStep>, index: number) => ({
      id: `step-${index + 1}`,
      action: step.action || 'custom',
      description: step.description || '',
      params: step.params || {},
      assertion: step.assertion,
    })),
  });
}
