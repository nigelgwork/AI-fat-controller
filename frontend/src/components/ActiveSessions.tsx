import React, { useState, useEffect } from 'react';
import { api } from '@/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Terminal,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Square,
  Activity,
} from 'lucide-react';
import type { ExecutionSession, SessionLogEntry, ExecutionSessionSummary } from '@shared/types';

interface Props {
  showHistory?: boolean;
  maxHistoryItems?: number;
}

export default function ActiveSessions({ showHistory = false, maxHistoryItems = 5 }: Props) {
  const queryClient = useQueryClient();
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionLogs, setSessionLogs] = useState<Record<string, SessionLogEntry[]>>({});

  // Query active sessions
  const { data: activeSessions } = useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: () => api.getActiveSessions?.() ?? Promise.resolve([]),
  });

  // Query session history
  const { data: sessionHistory } = useQuery({
    queryKey: ['sessions', 'history', maxHistoryItems],
    queryFn: () => api.getSessionHistory?.(maxHistoryItems) ?? Promise.resolve([]),
    enabled: showHistory,
  });

  // Cancel session mutation
  const cancelMutation = useMutation({
    mutationFn: (sessionId: string) => api.cancelSession?.(sessionId) ?? Promise.resolve({ success: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  // Listen for real-time session updates
  useEffect(() => {
    const unsubUpdate = api.onSessionUpdate?.(() => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    });

    return () => {
      unsubUpdate?.();
    };
  }, [queryClient]);

  // Listen for real-time log updates
  useEffect(() => {
    const unsubLog = api.onSessionLog?.((data) => {
      setSessionLogs((prev) => ({
        ...prev,
        [data.sessionId]: [...(prev[data.sessionId] || []), data.entry].slice(-50), // Keep last 50
      }));
    });

    return () => {
      unsubLog?.();
    };
  }, []);

  // Load logs when expanding a session
  const loadSessionLogs = async (sessionId: string) => {
    if (!api.getSessionLogs) return;
    try {
      const logs = await api.getSessionLogs(sessionId, 50);
      setSessionLogs((prev) => ({ ...prev, [sessionId]: logs }));
    } catch (e) {
      console.error('Failed to load session logs:', e);
    }
  };

  const toggleExpand = (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
    } else {
      setExpandedSession(sessionId);
      if (!sessionLogs[sessionId]) {
        loadSessionLogs(sessionId);
      }
    }
  };

  const getStatusIcon = (status: ExecutionSession['status']) => {
    switch (status) {
      case 'starting':
        return <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />;
      case 'running':
        return <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />;
      case 'waiting_input':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-slate-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: ExecutionSession['status']) => {
    switch (status) {
      case 'starting':
      case 'running':
        return 'border-cyan-500/50 bg-cyan-500/10';
      case 'waiting_input':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'completed':
        return 'border-green-500/50 bg-green-500/10';
      case 'failed':
        return 'border-red-500/50 bg-red-500/10';
      case 'cancelled':
        return 'border-slate-500/50 bg-slate-500/10';
      default:
        return 'border-slate-700 bg-slate-800/50';
    }
  };

  const formatDuration = (startedAt: string, endedAt?: string) => {
    const start = new Date(startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    const durationSec = Math.floor((end - start) / 1000);

    if (durationSec < 60) return `${durationSec}s`;
    if (durationSec < 3600) return `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
    return `${Math.floor(durationSec / 3600)}h ${Math.floor((durationSec % 3600) / 60)}m`;
  };

  const getLogTypeColor = (type: SessionLogEntry['type']) => {
    switch (type) {
      case 'tool-call':
        return 'text-cyan-400';
      case 'tool-result':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'complete':
        return 'text-green-300';
      case 'info':
        return 'text-slate-400';
      default:
        return 'text-white';
    }
  };

  const hasActiveSessions = activeSessions && activeSessions.length > 0;
  const hasHistory = sessionHistory && sessionHistory.length > 0;

  if (!hasActiveSessions && (!showHistory || !hasHistory)) {
    return null; // Don't render if nothing to show
  }

  return (
    <div className="space-y-4">
      {/* Active Sessions */}
      {hasActiveSessions && (
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Active Claude Code Sessions</h3>
            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-sm">
              {activeSessions.length} running
            </span>
          </div>

          <div className="space-y-2">
            {activeSessions.map((session: ExecutionSessionSummary) => (
              <SessionCard
                key={session.id}
                session={session}
                isExpanded={expandedSession === session.id}
                onToggle={() => toggleExpand(session.id)}
                logs={sessionLogs[session.id]}
                onCancel={() => cancelMutation.mutate(session.id)}
                isCancelling={cancelMutation.isPending && cancelMutation.variables === session.id}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                formatDuration={formatDuration}
                getLogTypeColor={getLogTypeColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Session History */}
      {showHistory && hasHistory && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-white">Recent Sessions</h3>
          </div>

          <div className="space-y-2">
            {sessionHistory.map((session: ExecutionSessionSummary) => (
              <SessionCard
                key={session.id}
                session={session}
                isExpanded={expandedSession === session.id}
                onToggle={() => toggleExpand(session.id)}
                logs={sessionLogs[session.id]}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                formatDuration={formatDuration}
                getLogTypeColor={getLogTypeColor}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SessionCardProps {
  session: ExecutionSessionSummary;
  isExpanded: boolean;
  onToggle: () => void;
  logs?: SessionLogEntry[];
  onCancel?: () => void;
  isCancelling?: boolean;
  getStatusIcon: (status: ExecutionSession['status']) => React.ReactNode;
  getStatusColor: (status: ExecutionSession['status']) => string;
  formatDuration: (startedAt: string, endedAt?: string) => string;
  getLogTypeColor: (type: SessionLogEntry['type']) => string;
}

function SessionCard({
  session,
  isExpanded,
  onToggle,
  logs,
  onCancel,
  isCancelling,
  getStatusIcon,
  getStatusColor,
  formatDuration,
  getLogTypeColor,
}: SessionCardProps) {
  const isActive = ['starting', 'running', 'waiting_input'].includes(session.status);

  return (
    <div className={`border rounded-lg overflow-hidden ${getStatusColor(session.status)}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button className="text-slate-400 hover:text-white">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {getStatusIcon(session.status)}

          <div className="flex-1 min-w-0">
            <div className="text-white font-medium truncate">{session.taskTitle}</div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>{formatDuration(session.startedAt, session.endedAt)}</span>
              {session.toolCalls > 0 && <span>{session.toolCalls} tool calls</span>}
              {(session.inputTokens > 0 || session.outputTokens > 0) && (
                <span>{(session.inputTokens + session.outputTokens).toLocaleString()} tokens</span>
              )}
              {session.logCount > 0 && <span>{session.logCount} log entries</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isActive && onCancel && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content - Logs */}
      {isExpanded && (
        <div className="border-t border-slate-700 bg-slate-900/50 p-3">
          {session.error && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {session.error}
            </div>
          )}

          {logs && logs.length > 0 ? (
            <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-500 w-20 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`${getLogTypeColor(log.type)} flex-1`}>
                    {log.type === 'tool-call' && '> '}
                    {log.type === 'tool-result' && '< '}
                    {log.content}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">No log entries yet...</div>
          )}
        </div>
      )}
    </div>
  );
}
