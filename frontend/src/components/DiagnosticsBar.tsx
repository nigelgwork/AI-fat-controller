import { useQuery } from '@tanstack/react-query';
import { Cpu, HardDrive, Clock, Zap } from 'lucide-react';
import { api } from '@/api';

interface SystemMetrics {
  system: { cpuPercent: number; cpuCores: number; memTotal: number; memUsed: number; memPercent: number };
  app: { memRss: number; memHeapUsed: number; memHeapTotal: number; uptime: number };
}

interface ClaudeUsage {
  subscription: string;
  rateLimitTier: string;
  source: 'api' | 'stats-cache';
  session: { percent: number; resetsAt: string | null };
  week: { percent: number; resetsAt: string | null };
  weekOpus: { utilization: number; resetsAt: string | null } | null;
  weekSonnet: { utilization: number; resetsAt: string | null } | null;
  extraUsage: { isEnabled: boolean; monthlyLimit: number | null; usedCredits: number | null; utilization: number | null } | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatResetTime(iso: string | null): string {
  if (!iso) return '';
  const reset = new Date(iso);
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();
  if (diffMs <= 0) return 'now';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffHr < 24) return `${diffHr}h ${remMin}m`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ${diffHr % 24}h`;
}

function usageColor(percent: number): string {
  if (percent >= 80) return 'text-red-400';
  if (percent >= 50) return 'text-yellow-400';
  return 'text-green-400';
}

function subscriptionLabel(sub: string): string {
  if (sub === 'max') return 'Max';
  if (sub === 'pro') return 'Pro';
  if (sub === 'team') return 'Team';
  return sub;
}

export default function DiagnosticsBar() {
  const { data: metrics } = useQuery<SystemMetrics>({
    queryKey: ['system-metrics'],
    queryFn: () => api.getSystemMetrics(),
    refetchInterval: 30000,
    refetchOnMount: true,
    staleTime: 15000,
  });

  const { data: usage } = useQuery<ClaudeUsage>({
    queryKey: ['claude-usage'],
    queryFn: () => api.getClaudeUsage(),
    refetchInterval: 60000,
    refetchOnMount: true,
    staleTime: 30000,
  });

  const isLive = usage?.source === 'api';

  return (
    <footer className="h-7 bg-slate-800 border-t border-slate-700 flex items-center justify-between px-4 text-[11px] text-slate-500 flex-shrink-0 font-mono">
      <div className="flex items-center gap-4">
        {metrics && (
          <>
            <span className="flex items-center gap-1" title={`${metrics.system.cpuCores} cores`}>
              <Cpu size={11} />
              CPU: {metrics.system.cpuPercent}%
            </span>
            <span className="flex items-center gap-1" title={`${formatBytes(metrics.system.memUsed)} / ${formatBytes(metrics.system.memTotal)}`}>
              <HardDrive size={11} />
              RAM: {metrics.system.memPercent}%
            </span>
            <span className="text-slate-600">|</span>
            <span title="Server process memory">
              App: {formatBytes(metrics.app.memRss)}
            </span>
            <span className="flex items-center gap-1" title="Server uptime">
              <Clock size={11} />
              {formatUptime(metrics.app.uptime)}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {usage && (
          <>
            {usage.subscription !== 'unknown' && (
              <>
                <span className="text-slate-400">
                  Claude {subscriptionLabel(usage.subscription)}
                </span>
                <span className="text-slate-600">|</span>
              </>
            )}
            <span
              className="flex items-center gap-1"
              title={`5-hour rolling session limit${!isLive ? ' (estimated)' : ''}`}
            >
              <Zap size={11} />
              Session:
              <span className={usageColor(usage.session.percent)}>{isLive ? '' : '~'}{usage.session.percent}%</span>
              {usage.session.resetsAt && (
                <span className="text-slate-600 ml-0.5">({formatResetTime(usage.session.resetsAt)})</span>
              )}
            </span>
            <span className="text-slate-600">|</span>
            <span
              className="flex items-center gap-1"
              title={`7-day rolling weekly limit${!isLive ? ' (estimated)' : ''}`}
            >
              Weekly:
              <span className={usageColor(usage.week.percent)}>{isLive ? '' : '~'}{usage.week.percent}%</span>
              {usage.week.resetsAt && (
                <span className="text-slate-600 ml-0.5">({formatResetTime(usage.week.resetsAt)})</span>
              )}
            </span>
          </>
        )}
      </div>
    </footer>
  );
}
