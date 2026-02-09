import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit,
  CheckSquare,
  Monitor,
  History,
  Bot,
  Plug,
  Sparkles,
  Terminal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavSection {
  title: string;
  items: {
    to: string;
    icon: React.ElementType;
    label: string;
    end?: boolean;
  }[];
}

const sections: NavSection[] = [
  {
    title: 'DASHBOARD',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Overview', end: true },
    ],
  },
  {
    title: 'PROJECTS',
    items: [
      { to: '/projects', icon: FolderGit, label: 'Projects', end: true },
      { to: '/projects/tasks', icon: CheckSquare, label: 'Tasks' },
      { to: '/projects/sessions', icon: Monitor, label: 'Sessions' },
      { to: '/projects/history', icon: History, label: 'History' },
    ],
  },
  {
    title: 'RESOURCES',
    items: [
      { to: '/resources/agents', icon: Bot, label: 'Agents' },
      { to: '/resources/mcp', icon: Plug, label: 'MCP' },
      { to: '/resources/skills', icon: Sparkles, label: 'Skills' },
    ],
  },
  {
    title: 'TERMINALS',
    items: [
      { to: '/terminals', icon: Terminal, label: 'Terminals' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-52'
      } bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-200 flex-shrink-0`}
    >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.title} className="mb-2">
            {!collapsed && (
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            {collapsed && <div className="h-1" />}
            {section.items.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={label}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Collapse */}
      <div className="border-t border-slate-700 py-2">
        <button
          onClick={onToggle}
          className={`flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-700/50 hover:text-slate-300 transition-colors w-[calc(100%-1rem)] ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
