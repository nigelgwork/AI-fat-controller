import { app, desktopCapturer, screen, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getExecutor } from './executor';
import { createLogger } from '../utils/logger';

const log = createLogger('Screenshot');

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
  const userDataPath = app.getPath('userData');
  const screenshotsDir = path.join(userDataPath, 'screenshots');

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

// Capture the screen using Electron's desktopCapturer
export async function captureScreen(options?: CaptureOptions): Promise<ScreenshotResult> {
  try {
    // Get all displays
    const displays = screen.getAllDisplays();
    const targetDisplay = options?.display !== undefined
      ? displays[options.display] || displays[0]
      : screen.getPrimaryDisplay();

    // Get screen sources
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: targetDisplay.size.width * targetDisplay.scaleFactor,
        height: targetDisplay.size.height * targetDisplay.scaleFactor,
      },
    });

    // Find the source for our target display
    const source = sources.find(s => s.display_id === targetDisplay.id.toString()) || sources[0];

    if (!source) {
      return {
        success: false,
        error: 'No screen source found',
      };
    }

    // Get the thumbnail image
    const image = source.thumbnail;

    // Apply region crop if specified
    let finalImage = image;
    if (options?.region) {
      const { x, y, width, height } = options.region;
      finalImage = image.crop({
        x: Math.round(x * targetDisplay.scaleFactor),
        y: Math.round(y * targetDisplay.scaleFactor),
        width: Math.round(width * targetDisplay.scaleFactor),
        height: Math.round(height * targetDisplay.scaleFactor),
      });
    }

    // Convert to PNG buffer
    const pngBuffer = finalImage.toPNG();

    // Save to file
    const filename = generateScreenshotFilename();
    const filePath = path.join(getScreenshotsDir(), filename);
    fs.writeFileSync(filePath, pngBuffer);

    // Also return base64 for direct use
    const base64 = pngBuffer.toString('base64');

    return {
      success: true,
      filePath,
      base64,
      width: finalImage.getSize().width,
      height: finalImage.getSize().height,
    };
  } catch (error) {
    log.error('Screenshot capture failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Capture the active window
export async function captureActiveWindow(): Promise<ScreenshotResult> {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow();

    if (!focusedWindow) {
      // Fallback to capturing the whole screen
      return captureScreen();
    }

    // Get the window bounds
    const bounds = focusedWindow.getBounds();

    // Capture with the window's region
    return captureScreen({
      region: bounds,
    });
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
