import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Home,
  Cpu,
  FolderGit,
  CheckSquare,
  Monitor,
  Bot,
  Settings,
  Plus,
  Terminal,
  X,
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Define all available commands
  const commands: CommandItem[] = [
    {
      id: 'dashboard',
      title: 'Go to Dashboard',
      description: 'View town overview',
      icon: <Home size={18} />,
      action: () => navigate('/'),
      keywords: ['home', 'overview'],
    },
    {
      id: 'controller',
      title: 'Go to Controller',
      description: 'AI project manager',
      icon: <Cpu size={18} />,
      action: () => navigate('/controller'),
      keywords: ['phat', 'mayor', 'ai'],
    },
    {
      id: 'projects',
      title: 'Go to Projects',
      description: 'Manage projects',
      icon: <FolderGit size={18} />,
      action: () => navigate('/projects'),
      keywords: ['repos', 'folders'],
    },
    {
      id: 'new-project',
      title: 'Create New Project',
      description: 'Scaffold a new project',
      icon: <Plus size={18} />,
      action: () => navigate('/projects/new'),
      keywords: ['scaffold', 'init'],
    },
    {
      id: 'tasks',
      title: 'Go to Tasks',
      description: 'View and manage tasks',
      icon: <CheckSquare size={18} />,
      action: () => navigate('/tasks'),
      keywords: ['todo', 'beads', 'work'],
    },
    {
      id: 'sessions',
      title: 'Go to Sessions',
      description: 'Claude session history',
      icon: <Monitor size={18} />,
      action: () => navigate('/sessions'),
      keywords: ['history', 'conversations'],
    },
    {
      id: 'agents',
      title: 'Go to Agents',
      description: 'Manage Claude agents',
      icon: <Bot size={18} />,
      action: () => navigate('/agents'),
      keywords: ['bots', 'custom'],
    },
    {
      id: 'tmux',
      title: 'Go to Tmux Sessions',
      description: 'Manage tmux sessions',
      icon: <Terminal size={18} />,
      action: () => navigate('/tmux'),
      keywords: ['terminal', 'shell'],
    },
    {
      id: 'settings',
      title: 'Go to Settings',
      description: 'Configure the app',
      icon: <Settings size={18} />,
      action: () => navigate('/settings'),
      keywords: ['preferences', 'config'],
    },
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter((cmd) => {
        const searchText = query.toLowerCase();
        const titleMatch = cmd.title.toLowerCase().includes(searchText);
        const descMatch = cmd.description?.toLowerCase().includes(searchText);
        const keywordMatch = cmd.keywords?.some((k) => k.includes(searchText));
        return titleMatch || descMatch || keywordMatch;
      })
    : commands;

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedItem = list.children[selectedIndex] as HTMLElement;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white placeholder-slate-400 outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-cyan-500/20 text-white'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <span
                  className={`p-1.5 rounded ${
                    index === selectedIndex
                      ? 'bg-cyan-500/30 text-cyan-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {cmd.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{cmd.title}</div>
                  {cmd.description && (
                    <div className="text-sm text-slate-400 truncate">
                      {cmd.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer with hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">
                ↵
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">
                Esc
              </kbd>{' '}
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
