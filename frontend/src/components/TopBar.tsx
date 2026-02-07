import { useState, useEffect } from 'react';
import { api } from '@/api';
import { HelpCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function TopBar() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    api.getVersion().then(setVersion);
  }, []);

  return (
    <header className="h-12 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium text-slate-300">AI Phat Controller</h1>
        {version && (
          <span className="text-[10px] text-slate-600 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
            v{version}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <a
          href="https://github.com/anthropics/claude-code"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
          title="Help"
        >
          <HelpCircle size={16} />
        </a>
        <ThemeToggle compact />
        <Link
          to="/settings"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </Link>
      </div>
    </header>
  );
}
