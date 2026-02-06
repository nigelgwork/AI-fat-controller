import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDataDir, getTempDir } from '../utils/paths';
import { getExecutor } from './executor';
import { createLogger } from '../utils/logger';

const log = createLogger('Screenshot');
const execAsync = promisify(exec);

export interface CaptureOptions {
  display?: number;
  region?: { x: number; y: number; width: number; height: number };
}

export interface ScreenshotResult {
  success: boolean;
  filePath?: string;
  base64?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface ScreenAnalysis {
  success: boolean;
  analysis?: string;
  error?: string;
}

// Get the screenshots directory path
function getScreenshotsDir(): string {
  const screenshotsDir = path.join(getDataDir(), 'screenshots');

  // Ensure directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  return screenshotsDir;
}

// Generate a unique filename for screenshots
function generateScreenshotFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `screenshot-${timestamp}.png`;
}

/**
 * Detect the available screenshot tool on the system.
 * In Docker/headless environments, this may not be available.
 */
async function detectScreenshotTool(): Promise<'import' | 'scrot' | 'gnome-screenshot' | 'xdotool' | null> {
  const tools = ['import', 'scrot', 'gnome-screenshot'];

  for (const tool of tools) {
    try {
      await execAsync(`which ${tool}`);
      return tool as any;
    } catch {
      // Tool not found, try next
    }
  }

  return null;
}

/**
 * Capture the screen using system tools (replacing Electron's desktopCapturer).
 *
 * In a Docker/server environment, screenshots may require:
 * - A running X server or Xvfb (virtual framebuffer)
 * - Tools like `import` (ImageMagick), `scrot`, or `gnome-screenshot`
 *
 * If no display is available, the function will return an appropriate error.
 */
export async function captureScreen(options?: CaptureOptions): Promise<ScreenshotResult> {
  try {
    const filename = generateScreenshotFilename();
    const filePath = path.join(getScreenshotsDir(), filename);

    // Check if we have a DISPLAY environment variable (X11)
    if (!process.env.DISPLAY) {
      log.warn('No DISPLAY environment variable set. Screenshot capture requires a display server (X11/Xvfb).');
      return {
        success: false,
        error: 'No display server available. Set DISPLAY environment variable or use Xvfb for headless screenshot capture.',
      };
    }

    const tool = await detectScreenshotTool();

    if (!tool) {
      log.warn('No screenshot tool found. Install ImageMagick (import), scrot, or gnome-screenshot.');
      return {
        success: false,
        error: 'No screenshot tool available. Install ImageMagick, scrot, or gnome-screenshot.',
      };
    }

    let command: string;

    switch (tool) {
      case 'import': {
        // ImageMagick's import command
        if (options?.region) {
          const { x, y, width, height } = options.region;
          command = `import -window root -crop ${width}x${height}+${x}+${y} ${filePath}`;
        } else {
          command = `import -window root ${filePath}`;
        }
        break;
      }

      case 'scrot': {
        if (options?.region) {
          const { x, y, width, height } = options.region;
          // scrot doesn't support region directly, capture full then crop with convert
          const tempPath = path.join(getTempDir(), `temp-${Date.now()}.png`);
          command = `scrot ${tempPath} && convert ${tempPath} -crop ${width}x${height}+${x}+${y} ${filePath} && rm -f ${tempPath}`;
        } else {
          command = `scrot ${filePath}`;
        }
        break;
      }

      case 'gnome-screenshot': {
        command = `gnome-screenshot -f ${filePath}`;
        break;
      }

      default:
        return {
          success: false,
          error: 'No supported screenshot tool available.',
        };
    }

    await execAsync(command, { timeout: 10000 });

    // Verify the file was created
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: 'Screenshot file was not created',
      };
    }

    // Read the file to get base64
    const pngBuffer = fs.readFileSync(filePath);
    const base64 = pngBuffer.toString('base64');

    return {
      success: true,
      filePath,
      base64,
    };
  } catch (error) {
    log.error('Screenshot capture failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Capture the active window.
 * In server/Docker mode, this falls back to full screen capture.
 */
export async function captureActiveWindow(): Promise<ScreenshotResult> {
  try {
    // Try xdotool to get active window, then capture it
    if (process.env.DISPLAY) {
      try {
        const { stdout: windowId } = await execAsync('xdotool getactivewindow');
        const filename = generateScreenshotFilename();
        const filePath = path.join(getScreenshotsDir(), filename);

        await execAsync(`import -window ${windowId.trim()} ${filePath}`, { timeout: 10000 });

        if (fs.existsSync(filePath)) {
          const pngBuffer = fs.readFileSync(filePath);
          const base64 = pngBuffer.toString('base64');

          return {
            success: true,
            filePath,
            base64,
          };
        }
      } catch {
        // Fall back to full screen capture
      }
    }

    return captureScreen();
  } catch (error) {
    log.error('Active window capture failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Analyze a screenshot using Claude Vision
export async function analyzeScreenshot(
  screenshotPath: string,
  prompt: string
): Promise<ScreenAnalysis> {
  try {
    // Verify the file exists
    if (!fs.existsSync(screenshotPath)) {
      return {
        success: false,
        error: `Screenshot file not found: ${screenshotPath}`,
      };
    }

    const executor = await getExecutor();

    // Build a prompt that includes the image path
    // Claude Code can handle image paths in prompts
    const fullPrompt = `Please analyze this screenshot and ${prompt}

Image file: ${screenshotPath}

Provide a detailed analysis based on what you can see in the image.`;

    const systemPrompt = `You are a UI analyst. When given a screenshot path, analyze the visual content and provide insights based on the user's request. Be specific about UI elements, text, layout, and any issues you observe.`;

    const result = await executor.runClaude(fullPrompt, systemPrompt);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Claude analysis failed',
      };
    }

    return {
      success: true,
      analysis: result.response,
    };
  } catch (error) {
    log.error('Screenshot analysis failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Verify that a UI element is visible on screen
export async function verifyUIElement(
  description: string,
  screenshotPath?: string
): Promise<{ found: boolean; confidence: string; details: string; error?: string }> {
  try {
    // If no screenshot path provided, take one now
    let imagePath = screenshotPath;
    if (!imagePath) {
      const capture = await captureScreen();
      if (!capture.success || !capture.filePath) {
        return {
          found: false,
          confidence: 'none',
          details: 'Failed to capture screenshot',
          error: capture.error,
        };
      }
      imagePath = capture.filePath;
    }

    const executor = await getExecutor();

    const fullPrompt = `Analyze this screenshot and determine if the following UI element is visible:

"${description}"

Image file: ${imagePath}

Respond with:
1. FOUND or NOT_FOUND
2. Confidence level (high, medium, low)
3. Details about what you see

Format your response as:
STATUS: [FOUND/NOT_FOUND]
CONFIDENCE: [high/medium/low]
DETAILS: [your observations]`;

    const systemPrompt = `You are a UI verification assistant. Analyze screenshots to verify the presence of specific UI elements. Be precise and objective in your assessments.`;

    const result = await executor.runClaude(fullPrompt, systemPrompt);

    if (!result.success) {
      return {
        found: false,
        confidence: 'none',
        details: 'Analysis failed',
        error: result.error,
      };
    }

    // Parse the response
    const response = result.response || '';
    const foundMatch = response.match(/STATUS:\s*(FOUND|NOT_FOUND)/i);
    const confidenceMatch = response.match(/CONFIDENCE:\s*(high|medium|low)/i);
    const detailsMatch = response.match(/DETAILS:\s*(.+)/is);

    return {
      found: foundMatch?.[1]?.toUpperCase() === 'FOUND',
      confidence: confidenceMatch?.[1]?.toLowerCase() || 'unknown',
      details: detailsMatch?.[1]?.trim() || response,
    };
  } catch (error) {
    log.error('UI verification failed:', error);
    return {
      found: false,
      confidence: 'none',
      details: 'Verification error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// List saved screenshots
export function listScreenshots(): string[] {
  const dir = getScreenshotsDir();
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.png'))
    .map(file => path.join(dir, file))
    .sort((a, b) => {
      const statA = fs.statSync(a);
      const statB = fs.statSync(b);
      return statB.mtime.getTime() - statA.mtime.getTime();
    });
}

// Delete a screenshot
export function deleteScreenshot(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Get the most recent screenshot
export function getLatestScreenshot(): string | null {
  const screenshots = listScreenshots();
  return screenshots.length > 0 ? screenshots[0] : null;
}
