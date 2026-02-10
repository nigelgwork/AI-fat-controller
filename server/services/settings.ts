/**
 * Settings Service - Adapted from electron/services/settings.ts
 * Replaces electron-store with SQLite via settings-repo
 */

import * as settingsRepo from '../db/repositories/settings-repo';

export interface AppSettings {
  executionMode: 'windows' | 'wsl' | 'linux';
  defaultMode: 'windows' | 'wsl' | 'linux' | 'auto';
  windows: {
    claudePath?: string;
  };
  wsl: {
    distro?: string;
  };
  logFilePath: string;
  theme: 'dark' | 'light' | 'system';
  startMinimized: boolean;
  minimizeToTray: boolean;
  showModeToggle: boolean;
  autoCheckUpdates: boolean;
  updateChannel: 'stable' | 'beta';
  hasCompletedSetup: boolean;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
  };
  // Git clone settings
  projectsDirectory: string;     // Default directory for cloned projects
  autoRunSetup: boolean;         // Auto-run detected setup commands
}

const defaults: AppSettings = {
  executionMode: 'windows',
  defaultMode: 'auto',
  windows: {},
  wsl: {},
  logFilePath: '',
  theme: 'dark',
  startMinimized: false,
  minimizeToTray: true,
  showModeToggle: true,
  autoCheckUpdates: true,
  updateChannel: 'stable',
  hasCompletedSetup: false,
  projectsDirectory: '',        // Empty means use ~/projects default
  autoRunSetup: false,          // Show confirmation by default
};

/**
 * Initialize settings with defaults if not already present.
 * Replaces electron-store constructor with migration logic.
 */
export function initSettings(): void {
  // Apply defaults for any keys that don't already exist
  for (const [key, value] of Object.entries(defaults)) {
    if (!settingsRepo.has(key)) {
      settingsRepo.set(key, value);
    }
  }

  // Migration: ensure executionMode exists (was in electron-store migration '0.2.0')
  if (!settingsRepo.has('executionMode')) {
    settingsRepo.set('executionMode', 'windows');
  }
}

/**
 * Get all settings as an AppSettings object
 */
export function getSettings(): AppSettings {
  const result: Partial<AppSettings> = {};

  for (const key of Object.keys(defaults) as Array<keyof AppSettings>) {
    const value = settingsRepo.getTyped<AppSettings[typeof key]>(key);
    if (value !== null) {
      (result as any)[key] = value;
    } else {
      (result as any)[key] = defaults[key];
    }
  }

  return { ...defaults, ...result };
}

/**
 * Get a single setting by key
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const value = settingsRepo.getTyped<AppSettings[K]>(key);
  if (value !== null) {
    return value;
  }
  return defaults[key];
}

/**
 * Set a single setting
 */
export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  settingsRepo.set(key, value as string | number | boolean | object);
}

/**
 * Alias for getSettings()
 */
export function getAllSettings(): AppSettings {
  return getSettings();
}

/**
 * Reset all settings to defaults
 */
export function resetSettings(): void {
  settingsRepo.clear();
  for (const [key, value] of Object.entries(defaults)) {
    settingsRepo.set(key, value);
  }
}
