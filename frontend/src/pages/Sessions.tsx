import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import {
  Terminal, RefreshCw, Activity, FolderGit, Clock, Cpu,
} from 'lucide-react';
import type { ClaudeSession } from '@shared/types';

function formatDuration(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (diffHours > 0) {
      return `${diffHours}h ${mins}m`;
    }
    return `${diffMins}m`;
  } catch {
    return '';
  }
}

export default function Sessions() {
  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['claude-sessions'],
    queryFn: () => api.getClaudeSessions() as Promise<ClaudeSession[]>,
    refetchInterval: 30000,
  });

  const runningSessions = sessions?.filter(s => s.status === 'running') || [];

  // Group by environment
  const runningWsl = runningSessions.filter(s => s.source === 'wsl');
  const runningWindows = runningSessions.filter(s => s.source === 'windows');
  const runningOther = runningSessions.filter(s => s.source !== 'wsl' && s.source !== 'windows');
  const hasMultipleEnvs = (runningWsl.length > 0 ? 1 : 0) + (runningWindows.length > 0 ? 1 : 0) + (runningOther.length > 0 ? 1 : 0) > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Active Sessions</h2>
          <p className="text-sm text-slate-400 mt-1">
            Running Claude Code instances on this machine
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Activity size={18} className="text-green-400" />
            Running Instances
            {runningSessions.length > 0 && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                {runningSessions.length} active
              </span>
            )}
          </h3>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-slate-400">Detecting sessions...</div>
        ) : runningSessions.length === 0 ? (
          <div className="p-8 text-center">
            <Terminal className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">No active Claude Code instances</p>
            <p className="text-sm text-slate-500 mt-1">
              Start Claude Code in a terminal to see it here
            </p>
          </div>
        ) : hasMultipleEnvs ? (
          <div>
            {runningWsl.length > 0 && (
              <EnvironmentGroup label="WSL" color="orange" sessions={runningWsl} />
            )}
            {runningWindows.length > 0 && (
              <EnvironmentGroup label="Windows" color="blue" sessions={runningWindows} />
            )}
            {runningOther.length > 0 && (
              <EnvironmentGroup label="Other" color="slate" sessions={runningOther} />
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {runningSessions.map((session) => (
              <SessionCard key={`${session.pid}-${session.source}`} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: ClaudeSession }) {
  return (
    <div className="p-4 hover:bg-slate-700/30 transition-colors">
      <div className="flex items-start gap-4">
        <div className="mt-1 p-2 rounded-lg bg-green-500/20">
          <Terminal size={20} className="text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
            <span className="font-medium text-white">
              {session.projectName || 'Claude Code Session'}
            </span>
            {session.source && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                session.source === 'wsl'
                  ? 'bg-orange-500/20 text-orange-400'
                  : session.source === 'windows'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-slate-600 text-slate-300'
              }`}>
                {session.source === 'wsl' ? 'WSL' : session.source === 'windows' ? 'Windows' : session.source}
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {session.workingDir && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <FolderGit size={14} className="flex-shrink-0 text-slate-500" />
                <span className="truncate">{session.workingDir}</span>
              </div>
            )}
            {session.pid > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Cpu size={14} className="flex-shrink-0 text-slate-500" />
                <span>PID: {session.pid}</span>
              </div>
            )}
            {session.startTime && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock size={14} className="flex-shrink-0 text-slate-500" />
                <span>Running for {formatDuration(session.startTime)}</span>
              </div>
            )}
            {session.command && (
              <div className="flex items-center gap-2 text-sm text-slate-400 sm:col-span-2">
                <Terminal size={14} className="flex-shrink-0 text-slate-500" />
                <span className="truncate font-mono text-xs">{session.command}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EnvironmentGroupProps {
  label: string;
  color: 'orange' | 'blue' | 'slate';
  sessions: ClaudeSession[];
}

function EnvironmentGroup({ label, color, sessions }: EnvironmentGroupProps) {
  const colorMap = {
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    slate: 'bg-slate-600 text-slate-300 border-slate-500/30',
  };

  return (
    <div>
      <div className={`px-4 py-2 border-b border-slate-700 flex items-center gap-2 ${colorMap[color].split(' ').slice(0, 1).join(' ')}`}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${colorMap[color].split(' ').slice(1, 2).join(' ')}`}>
          {label}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${colorMap[color]}`}>
          {sessions.length}
        </span>
      </div>
      <div className="divide-y divide-slate-700">
        {sessions.map((session) => (
          <SessionCard key={`${session.pid}-${session.source}`} session={session} />
        ))}
      </div>
    </div>
  );
}
