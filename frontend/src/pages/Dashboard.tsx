import { useQuery } from '@tanstack/react-query';
import { Circle, Users, Boxes, Activity, RefreshCw } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Town Overview</h2>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Circle}
          label="Total Beads"
          value={stats?.total || 0}
          color="text-cyan-400"
        />
        <StatCard
          icon={Activity}
          label="Active"
          value={stats?.byStatus?.active || 0}
          color="text-green-400"
        />
        <StatCard
          icon={Users}
          label="Agents"
          value="-"
          color="text-purple-400"
        />
        <StatCard
          icon={Boxes}
          label="Convoys"
          value="-"
          color="text-orange-400"
        />
      </div>

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
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-slate-900 ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
