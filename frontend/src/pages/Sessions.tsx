import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api';
import {
  Terminal, RefreshCw, Activity, FolderGit, Clock, Cpu, FileCode, Bot,
  History, Copy, Check, MessageSquare, RotateCcw
} from 'lucide-react';
import type { ClaudeSession, Project, ClaudeCodeSession } from '@shared/types';
import CollapsibleHelp from '../components/CollapsibleHelp';

function formatStartTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

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
  const { data: sessions, isLoading: isLoadingSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['claude-sessions'],
    queryFn: () => api.getClaudeSessions() as Promise<ClaudeSession[]>,
    refetchInterval: 5000,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.listProjects() as Promise<Project[]>,
  });

  // Resumable sessions from ~/.claude/projects/
  const { data: resumableSessions, refetch: refetchResumable } = useQuery({
    queryKey: ['resumable-claude-sessions'],
    queryFn: () => api.getRecentClaudeSessions(10) as Promise<ClaudeCodeSession[]>,
    staleTime: 60000, // Refresh every minute
  });

  const runningSessions = sessions?.filter(s => s.status === 'running') || [];
  const recentSessions = sessions?.filter(s => s.status === 'recent') || [];
  const claudeProjects = projects?.filter(p => p.hasClaude) || [];

  // Group running sessions by environment
  const runningWsl = runningSessions.filter(s => s.source === 'wsl');
  const runningWindows = runningSessions.filter(s => s.source === 'windows');
  const runningOther = runningSessions.filter(s => s.source !== 'wsl' && s.source !== 'windows');
  const hasMultipleEnvs = (runningWsl.length > 0 ? 1 : 0) + (runningWindows.length > 0 ? 1 : 0) + (runningOther.length > 0 ? 1 : 0) > 1;

  // Group recent sessions by environment
  const recentWsl = recentSessions.filter(s => s.source === 'wsl');
  const recentWindows = recentSessions.filter(s => s.source === 'windows');
  const recentOther = recentSessions.filter(s => s.source !== 'wsl' && s.source !== 'windows');
  const hasMultipleRecentEnvs = (recentWsl.length > 0 ? 1 : 0) + (recentWindows.length > 0 ? 1 : 0) + (recentOther.length > 0 ? 1 : 0) > 1;

  const handleRefresh = () => {
    refetchSessions();
    refetchResumable();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Claude Code Sessions</h2>
        <button
          onClick={handleRefresh}
          disabled={isLoadingSessions}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={16} className={isLoadingSessions ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Running Sessions */}
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

        {isLoadingSessions ? (
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

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Clock size={18} className="text-slate-400" />
              Recent Sessions
              <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded">
                Last 24 hours
              </span>
            </h3>
          </div>
          {hasMultipleRecentEnvs ? (
            <div>
              {recentWsl.length > 0 && (
                <EnvironmentGroup label="WSL" color="orange" sessions={recentWsl} isRecent />
              )}
              {recentWindows.length > 0 && (
                <EnvironmentGroup label="Windows" color="blue" sessions={recentWindows} isRecent />
              )}
              {recentOther.length > 0 && (
                <EnvironmentGroup label="Other" color="slate" sessions={recentOther} isRecent />
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {recentSessions.map((session) => (
                <SessionCard key={`${session.sessionId || session.pid}-${session.source}`} session={session} isRecent />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resumable Sessions */}
      {resumableSessions && resumableSessions.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <History size={18} className="text-cyan-400" />
              Resumable Sessions
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded">
                {resumableSessions.length} sessions
              </span>
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Past conversations that can be resumed with <code className="bg-slate-700 px-1 rounded">--resume</code>
            </p>
          </div>
          <div className="divide-y divide-slate-700">
            {resumableSessions.map((session) => (
              <ResumableSessionCard key={session.sessionId} session={session} />
            ))}
          </div>
        </div>
      )}

      {/* Claude-Enabled Projects */}
      {claudeProjects.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Bot size={18} className="text-purple-400" />
              Claude-Enabled Projects
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                {claudeProjects.length} with CLAUDE.md
              </span>
            </h3>
          </div>
          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {claudeProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <div className="p-2 bg-purple-500/20 rounded">
                  <FolderGit size={16} className="text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{project.name}</div>
                  <div className="text-xs text-slate-400 truncate">{project.path}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help */}
      <CollapsibleHelp title="About Claude Code Sessions">
        <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-400">
          <div>
            <p className="text-white font-medium mb-1">Running Instances</p>
            <p>Active Claude Code CLI processes detected on your system. These are interactive coding sessions.</p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">Recent Sessions</p>
            <p>Sessions from the last 24 hours based on ~/.claude/projects/ history.</p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">Resumable Sessions</p>
            <p>Past conversations stored in ~/.claude/projects/ that can be resumed with <code className="bg-slate-700 px-1 rounded">claude --resume &lt;id&gt;</code>. Context is preserved.</p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">CLAUDE.md Projects</p>
            <p>Projects with a CLAUDE.md file have custom instructions for Claude Code.</p>
          </div>
        </div>
      </CollapsibleHelp>
    </div>
  );
}

interface SessionCardProps {
  session: ClaudeSession;
  isRecent?: boolean;
}

function SessionCard({ session, isRecent }: SessionCardProps) {
  return (
    <div className="p-4 hover:bg-slate-700/30 transition-colors">
      <div className="flex items-start gap-4">
        {/* Status indicator */}
        <div className={`mt-1 p-2 rounded-lg ${isRecent ? 'bg-slate-700' : 'bg-green-500/20'}`}>
          {isRecent ? (
            <FileCode size={20} className="text-slate-400" />
          ) : (
            <Terminal size={20} className="text-green-400" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {!isRecent && (
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
            )}
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
                {session.source === 'wsl' ? 'WSL' : session.source === 'windows' ? 'Windows' : 'History'}
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {session.workingDir && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <FolderGit size={14} className="flex-shrink-0 text-slate-500" />
                <span className="truncate">{session.workingDir}</span>
              </div>
            )}

            {!isRecent && session.pid > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Cpu size={14} className="flex-shrink-0 text-slate-500" />
                <span>PID: {session.pid}</span>
              </div>
            )}

            {session.startTime && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock size={14} className="flex-shrink-0 text-slate-500" />
                <span>
                  {isRecent
                    ? `Last active: ${formatStartTime(session.startTime)}`
                    : `Running for ${formatDuration(session.startTime)}`
                  }
                </span>
              </div>
            )}

            {session.command && session.command !== 'Recent session' && (
              <div className="flex items-center gap-2 text-sm text-slate-400 sm:col-span-2">
                <Terminal size={14} className="flex-shrink-0 text-slate-500" />
                <span className="truncate font-mono text-xs">{session.command}</span>
              </div>
            )}
          </div>

          {session.sessionId && (
            <div className="mt-2 text-xs text-slate-500 font-mono truncate">
              Session: {session.sessionId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EnvironmentGroupProps {
  label: string;
  color: 'orange' | 'blue' | 'slate';
  sessions: ClaudeSession[];
  isRecent?: boolean;
}

function EnvironmentGroup({ label, color, sessions, isRecent }: EnvironmentGroupProps) {
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
          <SessionCard
            key={`${session.sessionId || session.pid}-${session.source}`}
            session={session}
            isRecent={isRecent}
          />
        ))}
      </div>
    </div>
  );
}

interface ResumableSessionCardProps {
  session: ClaudeCodeSession;
}

function ResumableSessionCard({ session }: ResumableSessionCardProps) {
  const [copied, setCopied] = useState(false);

  const resumeCommand = `claude --resume ${session.sessionId}`;

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(resumeCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-4 hover:bg-slate-700/30 transition-colors">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="mt-1 p-2 rounded-lg bg-cyan-500/20">
          <RotateCcw size={20} className="text-cyan-400" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-white">
              {session.projectName || 'Claude Session'}
            </span>
            {session.messageCount && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-600 text-slate-300">
                <MessageSquare size={12} />
                {session.messageCount} messages
              </span>
            )}
          </div>

          {/* Preview */}
          {session.lastMessagePreview && (
            <p className="text-sm text-slate-400 truncate mt-1">
              {session.lastMessagePreview}
            </p>
          )}

          {/* Details */}
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
            {session.projectPath && (
              <div className="flex items-center gap-1 truncate">
                <FolderGit size={14} />
                <span className="truncate">{session.projectPath}</span>
              </div>
            )}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock size={14} />
              <span>{formatStartTime(session.lastModifiedAt)}</span>
            </div>
          </div>

          {/* Resume command */}
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 px-3 py-1.5 bg-slate-900 rounded text-xs font-mono text-cyan-400 truncate">
              {resumeCommand}
            </code>
            <button
              onClick={handleCopyCommand}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors ${
                copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="Copy resume command"
            >
              {copied ? (
                <>
                  <Check size={14} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
