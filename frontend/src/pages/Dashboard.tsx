import { useQuery } from '@tanstack/react-query';
import { Circle, Users, Boxes, Activity, RefreshCw, FolderGit, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SystemStatus {
  projects: { id: string; name: string; path: string; hasBeads: boolean }[];
  sessions: { pid: number; workingDir: string; projectName?: string }[];
  discovered: { id: string; name: string; path: string }[];
}

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['beads-stats'],
    queryFn: () => window.electronAPI?.getBeadsStats(),
    refetchInterval: 30000,
  });

  const { data: modeStatus, refetch: refetchModeStatus, isRefetching } = useQuery({
    queryKey: ['mode-status'],
    queryFn: () => window.electronAPI?.getModeStatus(),
  });

  const { data: systemStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => window.electronAPI?.getSystemStatus() as Promise<SystemStatus>,
    refetchInterval: 10000,
  });

  const projectCount = systemStatus?.projects?.length || 0;
  const sessionCount = systemStatus?.sessions?.length || 0;
  const discoveredCount = systemStatus?.discovered?.length || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Town Overview</h2>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/projects">
          <StatCard
            icon={FolderGit}
            label="Projects"
            value={projectCount}
            color="text-cyan-400"
            subtitle={discoveredCount > 0 ? `${discoveredCount} more found` : undefined}
          />
        </Link>
        <Link to="/agents">
          <StatCard
            icon={Terminal}
            label="Claude Sessions"
            value={sessionCount}
            color={sessionCount > 0 ? "text-green-400" : "text-slate-400"}
            subtitle={sessionCount > 0 ? "Active" : "None running"}
          />
        </Link>
        <Link to="/beads">
          <StatCard
            icon={Circle}
            label="Beads"
            value={stats?.total || 0}
            color="text-purple-400"
            subtitle={stats?.byStatus?.active ? `${stats.byStatus.active} active` : undefined}
          />
        </Link>
        <Link to="/convoys">
          <StatCard
            icon={Boxes}
            label="Convoys"
            value="-"
            color="text-orange-400"
          />
        </Link>
      </div>

      {/* Active Sessions Quick View */}
      {sessionCount > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Active Claude Sessions</h3>
          <div className="space-y-2">
            {systemStatus?.sessions?.slice(0, 3).map((session) => (
              <div key={session.pid} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white">{session.projectName || 'Claude Code'}</span>
                <span className="text-slate-500 text-xs">PID: {session.pid}</span>
              </div>
            ))}
            {sessionCount > 3 && (
              <Link to="/agents" className="text-xs text-cyan-400 hover:text-cyan-300">
                +{sessionCount - 3} more sessions →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Mode Status */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Execution Mode Status</h3>
          <button
            onClick={() => refetchModeStatus()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-900 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  modeStatus?.windows?.available ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              <span className="font-medium">Windows</span>
              {modeStatus?.current === 'windows' && (
                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                  Active
                </span>
              )}
            </div>
            {modeStatus?.windows?.available ? (
              <p className="text-sm text-slate-400">
                Claude: {modeStatus.windows.version || 'Available'}
              </p>
            ) : (
              <p className="text-sm text-slate-500">Not detected</p>
            )}
          </div>
          <div className="p-4 bg-slate-900 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  modeStatus?.wsl?.available ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              <span className="font-medium">WSL</span>
              {modeStatus?.current === 'wsl' && (
                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                  Active
                </span>
              )}
            </div>
            {modeStatus?.wsl?.available ? (
              <p className="text-sm text-slate-400">
                {modeStatus.wsl.distro}: {modeStatus.wsl.version || 'Available'}
              </p>
            ) : (
              <p className="text-sm text-slate-500">Not detected</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer h-full">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-slate-900 ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-slate-500 h-4">{subtitle || '\u00A0'}</p>
        </div>
      </div>
    </div>
  );
}
