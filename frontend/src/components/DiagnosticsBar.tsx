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
  session: { tokens: number; messages: number; limit: number; percent: number };
  week: { tokens: number; limit: number; percent: number };
  totals: { messages: number; sessions: number };
  lastUpdated: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
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
  });

  const { data: usage } = useQuery<ClaudeUsage>({
    queryKey: ['claude-usage'],
    queryFn: () => api.getClaudeUsage(),
    refetchInterval: 60000,
  });

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
              title={`Daily: ${formatTokens(usage.session.tokens)} / ${formatTokens(usage.session.limit)} tokens\n${usage.session.messages} messages\nFrom stats-cache (updated at session end)`}
            >
              <Zap size={11} />
              Daily:
              <span className={usageColor(usage.session.percent)}>~{usage.session.percent}%</span>
            </span>
            <span className="text-slate-600">|</span>
            <span
              className="flex items-center gap-1"
              title={`Weekly: ${formatTokens(usage.week.tokens)} / ${formatTokens(usage.week.limit)} tokens`}
            >
              Weekly:
              <span className={usageColor(usage.week.percent)}>~{usage.week.percent}%</span>
            </span>
          </>
        )}
      </div>
    </footer>
  );
}
