import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api';
import {
  History as HistoryIcon, MessageSquare, FolderGit, Clock,
  Copy, Check, Search,
} from 'lucide-react';
import RefreshButton from '../components/RefreshButton';
import type { ClaudeCodeSession } from '@shared/types';

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

function groupByDate(sessions: ClaudeCodeSession[]): { label: string; sessions: ClaudeCodeSession[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; sessions: ClaudeCodeSession[] }[] = [
    { label: 'Today', sessions: [] },
    { label: 'Yesterday', sessions: [] },
    { label: 'This Week', sessions: [] },
    { label: 'Older', sessions: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.lastModifiedAt);
    if (d >= today) groups[0].sessions.push(s);
    else if (d >= yesterday) groups[1].sessions.push(s);
    else if (d >= weekAgo) groups[2].sessions.push(s);
    else groups[3].sessions.push(s);
  }

  return groups.filter(g => g.sessions.length > 0);
}

export default function History() {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: sessions, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['resumable-claude-sessions'],
    queryFn: () => api.getRecentClaudeSessions(50) as Promise<ClaudeCodeSession[]>,
    staleTime: 30000,
  });

  const filtered = sessions?.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.projectName?.toLowerCase().includes(q) ||
      s.projectPath?.toLowerCase().includes(q) ||
      s.lastMessagePreview?.toLowerCase().includes(q)
    );
  }) || [];

  const groups = groupByDate(filtered);

  const handleCopy = async (sessionId: string) => {
    try {
      await navigator.clipboard.writeText(`claude --resume ${sessionId}`);
      setCopiedId(sessionId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Session History</h2>
          <p className="text-sm text-slate-400 mt-1">
            Past Claude Code sessions on this machine
          </p>
        </div>
        <RefreshButton onRefresh={() => refetch()} isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Loading sessions...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <HistoryIcon className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">
            {searchQuery ? 'No matching sessions found' : 'No past sessions found'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Sessions from ~/.claude/projects/ will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                {group.label}
              </h3>
              <div className="bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700">
                {group.sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="p-4 hover:bg-slate-700/30 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-cyan-500/10 flex-shrink-0">
                        <MessageSquare size={16} className="text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white truncate">
                            {session.projectName || 'Claude Session'}
                          </span>
                          {session.messageCount && (
                            <span className="text-xs text-slate-500 flex-shrink-0">
                              {session.messageCount} messages
                            </span>
                          )}
                          <span className="text-xs text-slate-600 flex-shrink-0 ml-auto">
                            {formatTimeAgo(session.lastModifiedAt)}
                          </span>
                        </div>

                        {/* Preview */}
                        {session.lastMessagePreview && (
                          <p className="text-sm text-slate-400 truncate mb-2">
                            {session.lastMessagePreview}
                          </p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {session.projectPath && (
                            <span className="flex items-center gap-1 truncate">
                              <FolderGit size={12} />
                              {session.projectPath}
                            </span>
                          )}
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <Clock size={12} />
                            {new Date(session.lastModifiedAt).toLocaleString([], {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Resume action */}
                        <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <code className="px-2 py-1 bg-slate-900 rounded text-xs font-mono text-cyan-400 truncate">
                            claude --resume {session.sessionId}
                          </code>
                          <button
                            onClick={() => handleCopy(session.sessionId)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors flex-shrink-0 ${
                              copiedId === session.sessionId
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                            title="Copy resume command"
                          >
                            {copiedId === session.sessionId ? (
                              <><Check size={12} /> Copied</>
                            ) : (
                              <><Copy size={12} /> Copy</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
