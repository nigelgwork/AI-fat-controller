import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Terminal,
  Users,
  Circle,
  Boxes,
  Settings,
} from 'lucide-react';
import ModeToggle from './ModeToggle';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/terminal', icon: Terminal, label: 'Controller' },
  { to: '/agents', icon: Users, label: 'Agents' },
  { to: '/beads', icon: Circle, label: 'Beads' },
  { to: '/convoys', icon: Boxes, label: 'Convoys' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
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
            <ModeToggle />
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
