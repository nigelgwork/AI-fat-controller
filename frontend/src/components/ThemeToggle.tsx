import { useState, useEffect } from 'react';
import { api } from '@/api';
import { Moon, Sun, Monitor } from 'lucide-react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Load theme from settings
    api.getSetting('theme').then((savedTheme) => {
      if (savedTheme) {
        setTheme(savedTheme);
        applyTheme(savedTheme);
      }
    });
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;

    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('light-theme', !prefersDark);
    } else {
      root.classList.toggle('light-theme', newTheme === 'light');
    }
  };

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    await api.setSetting('theme', newTheme);
  };

  const cycleTheme = () => {
    const themes: Theme[] = ['dark', 'light', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    handleThemeChange(nextTheme);
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun size={compact ? 16 : 18} />;
      case 'system':
        return <Monitor size={compact ? 16 : 18} />;
      default:
        return <Moon size={compact ? 16 : 18} />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'system':
        return 'System';
      default:
        return 'Dark';
    }
  };

  if (compact) {
    return (
      <button
        onClick={cycleTheme}
        className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
        title={`Theme: ${getLabel()}`}
      >
        {getIcon()}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400">Theme:</span>
      <div className="flex bg-slate-700 rounded-lg p-1">
        <button
          onClick={() => handleThemeChange('dark')}
          className={`p-1.5 rounded transition-colors ${
            theme === 'dark'
              ? 'bg-slate-600 text-cyan-400'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Dark theme"
        >
          <Moon size={16} />
        </button>
        <button
          onClick={() => handleThemeChange('light')}
          className={`p-1.5 rounded transition-colors ${
            theme === 'light'
              ? 'bg-slate-600 text-cyan-400'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Light theme"
        >
          <Sun size={16} />
        </button>
        <button
          onClick={() => handleThemeChange('system')}
          className={`p-1.5 rounded transition-colors ${
            theme === 'system'
              ? 'bg-slate-600 text-cyan-400'
              : 'text-slate-400 hover:text-white'
          }`}
          title="System theme"
        >
          <Monitor size={16} />
        </button>
      </div>
    </div>
  );
}
