import { useState, useEffect } from 'react';
import { Monitor, Terminal } from 'lucide-react';

type Mode = 'windows' | 'wsl';

export default function ModeToggle() {
  const [mode, setMode] = useState<Mode>('windows');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get current mode on mount
    window.electronAPI?.getMode().then(setMode).catch(() => {
      // Default to windows if electronAPI not available
    });

    // Listen for mode changes
    const cleanup = window.electronAPI?.onModeChanged((newMode) => {
      setMode(newMode);
    });

    return cleanup;
  }, []);

  const handleToggle = async (newMode: Mode) => {
    if (newMode === mode || loading) return;

    setLoading(true);
    try {
      await window.electronAPI?.setMode(newMode);
      setMode(newMode);
    } catch (error) {
      console.error('Failed to switch mode:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center bg-slate-700 rounded-lg p-1">
      <button
        onClick={() => handleToggle('windows')}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'windows'
            ? 'bg-cyan-500 text-white'
            : 'text-slate-300 hover:text-white'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Windows Mode - Use Windows Claude + bundled gt/bd"
      >
        <Monitor size={14} />
        <span>Windows</span>
      </button>
      <button
        onClick={() => handleToggle('wsl')}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'wsl'
            ? 'bg-cyan-500 text-white'
            : 'text-slate-300 hover:text-white'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="WSL Mode - Use WSL Claude + WSL gt/bd"
      >
        <Terminal size={14} />
        <span>WSL</span>
      </button>
    </div>
  );
}
