import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { HelpCircle, Settings, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function TopBar() {
  const [version, setVersion] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getVersion().then((data: any) => setVersion(typeof data === 'string' ? data : data.version));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const { data: pendingQuestions } = useQuery({
    queryKey: ['ntfy-pending-questions'],
    queryFn: () => api.getPendingQuestions(),
  });

  const questionCount = Array.isArray(pendingQuestions) ? pendingQuestions.length : 0;

  return (
    <header className="h-12 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium text-slate-300">AI Phat Controller</h1>
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

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors relative"
            title="Notifications"
          >
            <Bell size={16} />
            {questionCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {questionCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Notifications</span>
                <Link
                  to="/settings"
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                  onClick={() => setShowNotifications(false)}
                >
                  Settings
                </Link>
              </div>
              <div className="max-h-64 overflow-auto">
                {questionCount === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No pending notifications
                  </div>
                ) : (
                  (pendingQuestions as any[]).map((q: any) => (
                    <div key={q.id} className="p-3 border-b border-slate-700/50 hover:bg-slate-700/30">
                      <p className="text-sm text-white truncate">{q.question}</p>
                      <p className="text-xs text-slate-500 mt-1">{q.taskTitle}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <ThemeToggle compact />
        <Link
          to="/settings"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </Link>

        {/* Version - always visible */}
        <span className="text-[10px] text-slate-500 font-mono ml-2 select-none">
          {version ? `v${version}` : '...'}
        </span>
      </div>
    </header>
  );
}
