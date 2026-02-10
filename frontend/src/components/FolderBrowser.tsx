import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import {
  Folder, FolderOpen, ChevronUp, X, Home, HardDrive, FolderGit,
  Loader2, AlertCircle,
} from 'lucide-react';
import type { FolderListResult, FolderRoot } from '@shared/types';

interface FolderBrowserProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

function getRootIcon(type: FolderRoot['type']) {
  switch (type) {
    case 'home': return <Home size={14} />;
    case 'drive': return <HardDrive size={14} />;
    case 'project': return <FolderGit size={14} />;
  }
}

export default function FolderBrowser({ initialPath, onSelect, onClose }: FolderBrowserProps) {
  const [browsePath, setBrowsePath] = useState(initialPath || '');
  const [inputValue, setInputValue] = useState(initialPath || '');

  const { data, isLoading, isError, error } = useQuery<FolderListResult>({
    queryKey: ['filesystem-browse', browsePath],
    queryFn: () => api.browseFilesystem(browsePath || undefined),
    staleTime: 30000,
  });

  // Sync inputValue when browsePath changes via navigation
  useEffect(() => {
    if (data?.currentPath) {
      setInputValue(data.currentPath);
    }
  }, [data?.currentPath]);

  const handleGo = () => {
    setBrowsePath(inputValue.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGo();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <FolderOpen size={18} className="text-cyan-400" />
            Browse Folders
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Path input */}
        <div className="p-3 border-b border-slate-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a path..."
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleGo}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
            >
              Go
            </button>
          </div>

          {/* Quick roots */}
          {data?.roots && data.roots.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.roots.map((root) => (
                <button
                  key={root.path}
                  onClick={() => setBrowsePath(root.path)}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 transition-colors"
                >
                  {getRootIcon(root.type)}
                  {root.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Directory listing */}
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading...
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center p-8 text-red-400 gap-2">
              <AlertCircle size={16} />
              {(error as Error).message || 'Failed to browse'}
            </div>
          ) : data ? (
            <div className="divide-y divide-slate-700/50">
              {/* Go up */}
              {data.parentPath && (
                <button
                  onClick={() => setBrowsePath(data.parentPath!)}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 text-slate-300"
                >
                  <ChevronUp size={16} className="text-slate-500" />
                  <span className="text-sm">..</span>
                </button>
              )}
              {data.entries.length === 0 && !data.parentPath ? (
                <div className="p-8 text-center text-slate-500 text-sm">No subdirectories</div>
              ) : data.entries.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No subdirectories</div>
              ) : (
                data.entries.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => setBrowsePath(entry.path)}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 group"
                  >
                    <Folder size={16} className="text-cyan-400/70 group-hover:text-cyan-400" />
                    <span className="text-sm text-slate-300 group-hover:text-white truncate">{entry.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 truncate flex-1 min-w-0">
            {data?.currentPath || browsePath || '~'}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => data?.currentPath && onSelect(data.currentPath)}
              disabled={!data?.currentPath}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 rounded text-sm font-medium text-white transition-colors"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
