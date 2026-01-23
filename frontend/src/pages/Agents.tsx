import { useQuery } from '@tanstack/react-query';
import { Users, Bot, Eye, Factory, Zap, Terminal, ArrowRight, Crown, RefreshCw, Activity, FolderGit } from 'lucide-react';

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

interface ClaudeSession {
  pid: number;
  workingDir: string;
  projectName?: string;
  command: string;
  startTime?: string;
}

export default function Agents() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const result = await window.electronAPI?.executeGt(['status', '--json']);
      if (result?.success && result.response) {
        try {
          return JSON.parse(result.response);
        } catch {
          return null;
        }
      }
      return null;
    },
    refetchInterval: 10000,
  });

  const { data: sessions, isLoading: isLoadingSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['claude-sessions'],
    queryFn: () => window.electronAPI?.getClaudeSessions() as Promise<ClaudeSession[]>,
    refetchInterval: 5000,
  });

  const hasActiveSessions = sessions && sessions.length > 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Agents</h2>

      {/* Active Claude Sessions */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Activity size={18} className="text-green-400" />
            Active Claude Code Sessions
            {hasActiveSessions && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                {sessions.length} running
              </span>
            )}
          </h3>
          <button
            onClick={() => refetchSessions()}
            disabled={isLoadingSessions}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <RefreshCw size={14} className={isLoadingSessions ? 'animate-spin' : ''} />
          </button>
        </div>

        {isLoadingSessions ? (
          <div className="p-6 text-center text-slate-400">Detecting sessions...</div>
        ) : !hasActiveSessions ? (
          <div className="p-6 text-center">
            <Terminal className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">No active Claude Code sessions detected</p>
            <p className="text-sm text-slate-500 mt-1">
              Start Claude Code in a project to see it here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {sessions.map((session) => (
              <div key={session.pid} className="p-4 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                      <span className="font-medium text-white">
                        {session.projectName || 'Claude Code Session'}
                      </span>
                      <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                        PID: {session.pid}
                      </span>
                      {session.startTime && (
                        <span className="text-xs text-slate-500">
                          Started: {formatStartTime(session.startTime)}
                        </span>
                      )}
                    </div>
                    {session.workingDir && (
                      <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                        <FolderGit size={12} className="flex-shrink-0" />
                        <span className="truncate">{session.workingDir}</span>
                      </p>
                    )}
                    {session.command && (
                      <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                        {session.command}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gas Town Agents */}
      {isLoading ? (
        <div className="text-slate-400">Loading Gas Town agents...</div>
      ) : !result ? (
        <EmptyState />
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <pre className="text-sm text-slate-300 whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const agentTypes = [
    {
      icon: Crown,
      name: 'Mayor',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
      description: 'The coordinator. Assigns beads to workers, monitors progress, and handles cross-project decisions.',
    },
    {
      icon: Zap,
      name: 'Polecat',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20',
      description: 'Ephemeral workers. Spawn to complete a bead, create a PR, then disappear. Your AI coding agents.',
    },
    {
      icon: Eye,
      name: 'Witness',
      color: 'text-purple-400',
      bg: 'bg-purple-500/20',
      description: 'Monitors each project (rig). Watches for completed work and reports status.',
    },
    {
      icon: Factory,
      name: 'Refinery',
      color: 'text-orange-400',
      bg: 'bg-orange-500/20',
      description: 'The merge queue. Reviews PRs, runs tests, and merges approved work.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* What are Agents */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-cyan-500/20 rounded-lg">
            <Users className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">What are Agents?</h3>
            <p className="text-slate-400">
              Agents are <strong className="text-white">autonomous AI workers</strong> powered by Claude Code.
              They work together to process your beads (work items), creating branches, writing code,
              and submitting pull requests — all without manual intervention.
            </p>
          </div>
        </div>
      </div>

      {/* Agent Types */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-400" />
          Agent Types
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {agentTypes.map((agent) => (
            <div key={agent.name} className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${agent.bg}`}>
                  <agent.icon className={`w-5 h-5 ${agent.color}`} />
                </div>
                <span className={`font-semibold ${agent.color}`}>{agent.name}</span>
              </div>
              <p className="text-sm text-slate-400">{agent.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works with Claude Code */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          How Agents Use Claude Code
        </h3>
        <div className="space-y-4 text-slate-400">
          <p>
            Each agent runs a Claude Code session with specific tools and permissions:
          </p>
          <div className="bg-slate-900 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <ArrowRight size={16} className="text-cyan-400 mt-1" />
              <div>
                <span className="text-white font-medium">Polecat picks a bead</span>
                <span className="text-slate-500"> → Creates branch → Writes code → Commits → Opens PR</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight size={16} className="text-cyan-400 mt-1" />
              <div>
                <span className="text-white font-medium">Witness monitors</span>
                <span className="text-slate-500"> → Reports progress → Updates bead status</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRight size={16} className="text-cyan-400 mt-1" />
              <div>
                <span className="text-white font-medium">Refinery reviews</span>
                <span className="text-slate-500"> → Runs tests → Merges approved PRs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-gradient-to-br from-cyan-500/10 to-slate-800 rounded-lg p-6 border border-cyan-500/30">
        <h3 className="text-lg font-semibold text-white mb-4">Start the Agent System</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <p className="text-white font-medium">Set up Gas Town workspace first</p>
              <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block mt-1">
                gt install ~/gt
              </code>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <p className="text-white font-medium">Add your git repos to Gas Town</p>
              <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block mt-1">
                gt rig add myproject https://github.com/you/repo.git
              </code>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">3</div>
            <div>
              <p className="text-white font-medium">Start the Mayor (orchestrator)</p>
              <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block mt-1">
                gt prime
              </code>
              <p className="text-sm text-slate-400 mt-1">
                This starts the agent system. The Mayor will spawn Polecats to work on beads.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
        <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">No agents currently running</p>
        <p className="text-sm text-slate-500 mt-2">
          Start the agent system with <code className="text-cyan-400">gt prime</code> in your terminal
        </p>
      </div>
    </div>
  );
}
