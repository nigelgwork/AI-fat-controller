import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { createLogger } from './logger';

const log = createLogger('SecureDelete');

/**
 * Securely delete a file by overwriting its contents before unlinking.
 * This provides defense-in-depth against data recovery, though SSDs
 * may still retain data in wear-leveling blocks.
 *
 * @param filePath - Absolute path to the file to securely delete
 * @param passes - Number of overwrite passes (default: 1)
 * @returns true if successful, false otherwise
 */
export async function secureDelete(filePath: string, passes: number = 1): Promise<boolean> {
  try {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      log.warn(`File does not exist: ${filePath}`);
      return false;
    }

    // Get file size
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    if (fileSize === 0) {
      // Empty file, just delete it
      fs.unlinkSync(filePath);
      return true;
    }

    // Open file for writing
    const fd = fs.openSync(filePath, 'r+');

    try {
      // Perform overwrite passes
      for (let pass = 0; pass < passes; pass++) {
        // Generate random data
        const randomData = crypto.randomBytes(fileSize);

        // Write random data at the beginning of the file
        fs.writeSync(fd, randomData, 0, fileSize, 0);

        // Sync to disk
        fs.fsyncSync(fd);
      }
    } finally {
      // Close the file descriptor
      fs.closeSync(fd);
    }

    // Finally, unlink the file
    fs.unlinkSync(filePath);

    log.info(`Securely deleted: ${filePath}`);
    return true;
  } catch (error) {
    log.error(`Failed to securely delete ${filePath}:`, error);
    return false;
  }
}

/**
 * Securely delete all files in a directory (non-recursive).
 *
 * @param dirPath - Absolute path to the directory
 * @param passes - Number of overwrite passes per file
 * @returns Number of files successfully deleted
 */
export async function secureDeleteDirectory(dirPath: string, passes: number = 1): Promise<number> {
  try {
    if (!fs.existsSync(dirPath)) {
      log.warn(`Directory does not exist: ${dirPath}`);
      return 0;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let deletedCount = 0;

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(dirPath, entry.name);
        const success = await secureDelete(filePath, passes);
        if (success) {
          deletedCount++;
        }
      }
    }

    return deletedCount;
  } catch (error) {
    log.error(`Failed to securely delete directory ${dirPath}:`, error);
    return 0;
  }
}

/**
 * Securely delete files matching a pattern in a directory.
 *
 * @param dirPath - Absolute path to the directory
 * @param pattern - RegExp pattern to match file names
 * @param passes - Number of overwrite passes per file
 * @returns Number of files successfully deleted
 */
export async function secureDeleteMatching(
  dirPath: string,
  pattern: RegExp,
  passes: number = 1
): Promise<number> {
  try {
    if (!fs.existsSync(dirPath)) {
      log.warn(`Directory does not exist: ${dirPath}`);
      return 0;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let deletedCount = 0;

    for (const entry of entries) {
      if (entry.isFile() && pattern.test(entry.name)) {
        const filePath = path.join(dirPath, entry.name);
        const success = await secureDelete(filePath, passes);
        if (success) {
          deletedCount++;
        }
      }
    }

    return deletedCount;
  } catch (error) {
    log.error(`Failed to securely delete matching files in ${dirPath}:`, error);
    return 0;
  }
}

/**
 * Overwrite a string in memory before letting it be garbage collected.
 * Note: This is best-effort due to JavaScript string immutability.
 *
 * @param str - The string to clear
 * @returns An empty string
 */
export function clearSensitiveString(str: string): string {
  // JavaScript strings are immutable, so we can't actually overwrite them.
  // This is a best-effort approach that helps by:
  // 1. Returning an empty string for the caller to use
  // 2. The original string will be eligible for GC if no other references exist
  return '';
}

/**
 * Overwrite a Buffer's contents with zeros.
 *
 * @param buffer - The buffer to clear
 */
export function clearSensitiveBuffer(buffer: Buffer): void {
  buffer.fill(0);
}
