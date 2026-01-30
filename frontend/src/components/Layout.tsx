import { Outlet, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Terminal,
  Monitor,
  Bot,
  CheckSquare,
  Settings,
  FolderGit,
} from 'lucide-react';
import ModeToggle from './ModeToggle';
import UpdateBanner from './UpdateBanner';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/terminal', icon: Terminal, label: 'Controller' },
  { to: '/projects', icon: FolderGit, label: 'Projects' },
  { to: '/sessions', icon: Monitor, label: 'Sessions' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersion);
  }, []);

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar */}
      <aside className="w-16 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4">
        <div className="mb-8">
          <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center text-white font-bold">
            AI
          </div>
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`
              }
              title={label}
            >
              <Icon size={20} />
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
          <h1 className="text-lg font-semibold text-white">AI Controller</h1>
          <div className="flex items-center gap-4">
            <UpdateBanner />
            <ModeToggle />
            {version && (
              <span className="text-xs text-slate-500 font-mono">v{version}</span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
