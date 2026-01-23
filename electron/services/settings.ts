import Store from 'electron-store';

export interface AppSettings {
  executionMode: 'windows' | 'wsl';
  defaultMode: 'windows' | 'wsl' | 'auto';
  windows: {
    claudePath?: string;
  };
  wsl: {
    distro?: string;
  };
  gastownPath: string;
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
}

const defaults: AppSettings = {
  executionMode: 'windows',
  defaultMode: 'auto',
  windows: {},
  wsl: {},
  gastownPath: '',
  theme: 'dark',
  startMinimized: false,
  minimizeToTray: true,
  showModeToggle: true,
  autoCheckUpdates: true,
  updateChannel: 'stable',
  hasCompletedSetup: false,
};

// Create store instance (will be initialized in main process)
export let settings: Store<AppSettings>;

export function initSettings(): void {
  settings = new Store<AppSettings>({
    name: 'settings',
    defaults,
    // Migrations for future version upgrades
    migrations: {
      '0.2.0': (store) => {
        // Migration from older versions if needed
        if (!store.has('executionMode')) {
          store.set('executionMode', 'windows');
        }
      },
    },
  });
}

export function getSettings(): AppSettings {
  return settings.store;
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return settings.get(key);
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  settings.set(key, value);
}

export function resetSettings(): void {
  settings.clear();
  Object.entries(defaults).forEach(([key, value]) => {
    settings.set(key as keyof AppSettings, value);
  });
}
