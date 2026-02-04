import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock data store
const mockData = new Map<string, unknown>();

// Mock electron-store with a class-based mock
vi.mock('electron-store', () => {
  class MockStore {
    defaults: Record<string, unknown>;

    constructor(options?: { defaults?: Record<string, unknown> }) {
      this.defaults = options?.defaults || {};
      // Initialize with defaults
      Object.entries(this.defaults).forEach(([key, value]) => {
        mockData.set(key, value);
      });
    }

    get(key: string) {
      return mockData.get(key);
    }

    set(key: string | Record<string, unknown>, value?: unknown) {
      if (typeof key === 'object') {
        Object.entries(key).forEach(([k, v]) => mockData.set(k, v));
      } else {
        mockData.set(key, value);
      }
    }

    has(key: string) {
      return mockData.has(key);
    }

    delete(key: string) {
      return mockData.delete(key);
    }

    clear() {
      mockData.clear();
    }

    get store() {
      const obj: Record<string, unknown> = {};
      mockData.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
  }

  return { default: MockStore };
});

describe('Settings Module', () => {
  beforeEach(() => {
    vi.resetModules();
    mockData.clear();
  });

  it('should have default settings schema', async () => {
    const { initSettings, getSettings } = await import('../settings');
    initSettings();
    const settings = getSettings();

    // Verify defaults exist
    expect(settings).toBeDefined();
    expect(settings.executionMode).toBe('windows');
    expect(settings.theme).toBe('dark');
  });

  it('should get individual setting', async () => {
    const { initSettings, getSetting, setSetting } = await import('../settings');
    initSettings();

    // Set a value
    setSetting('theme', 'light');

    // Get it back
    const theme = getSetting('theme');
    expect(theme).toBe('light');
  });

  it('should reset settings to defaults', async () => {
    const { initSettings, setSetting, resetSettings, getSetting } = await import('../settings');
    initSettings();

    // Change a setting
    setSetting('theme', 'light');
    expect(getSetting('theme')).toBe('light');

    // Reset
    resetSettings();

    // Verify reset occurred - theme should be back to default 'dark'
    expect(getSetting('theme')).toBe('dark');
  });
});
