import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { Cpu, Clock, TrendingUp, DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';

// Claude pricing per 1M tokens (approximate for Claude 3.5 Sonnet)
const PRICING = {
  input: 3.00, // $3 per 1M input tokens
  output: 15.00, // $15 per 1M output tokens
};

interface TokenUsageDisplayProps {
  compact?: boolean;
}

export default function TokenUsageDisplay({ compact = false }: TokenUsageDisplayProps) {
  const { data: controllerState } = useQuery({
    queryKey: ['controller-state'],
    queryFn: () => api.getControllerState(),
    refetchInterval: 30000,
  });

  const { data: percentages } = useQuery({
    queryKey: ['usage-percentages'],
    queryFn: () => api.getUsagePercentages(),
    refetchInterval: 30000,
  });

  const { data: tokenHistory } = useQuery({
    queryKey: ['token-history', 7],
    queryFn: () => api.getTokenHistory?.(7),
    refetchInterval: 30000,
  });

  if (!controllerState?.tokenUsage) {
    return null;
  }

  const { tokenUsage, dailyTokenUsage, usageLimitConfig, pausedDueToLimit } = controllerState;

  // Calculate costs
  const hourlyCost = calculateCost(tokenUsage.inputTokens, tokenUsage.outputTokens);
  const dailyCost = calculateCost(dailyTokenUsage.input, dailyTokenUsage.output);

  // Calculate weekly total from history
  const weeklyTotal = tokenHistory?.reduce(
    (acc: { input: number; output: number }, day: { dailyTotal: { input: number; output: number } }) => ({
      input: acc.input + day.dailyTotal.input,
      output: acc.output + day.dailyTotal.output,
    }),
    { input: 0, output: 0 }
  ) || { input: 0, output: 0 };
  const weeklyCost = calculateCost(weeklyTotal.input, weeklyTotal.output);

  // Time until hourly reset
  const resetTime = new Date(tokenUsage.resetAt);
  const now = new Date();
  const minutesUntilReset = Math.max(0, Math.ceil((resetTime.getTime() - now.getTime()) / 60000));

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return 'text-red-400';
    if (percentage >= 60) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusBg = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
        <Cpu className="w-4 h-4 text-slate-400" />
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${getStatusColor(percentages?.hourly || 0)}`}>
            {formatTokens(tokenUsage.inputTokens + tokenUsage.outputTokens)}
          </span>
          <span className="text-xs text-slate-500">/ {formatTokens(usageLimitConfig.maxTokensPerHour)}</span>
        </div>
        {pausedDueToLimit && (
          <span title="Paused due to token limit">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </span>
        )}
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <RefreshCw className="w-3 h-3" />
          {minutesUntilReset}m
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white">Token Usage</h3>
        </div>
        {pausedDueToLimit && (
          <div className="flex items-center gap-2 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            Paused - Limit Reached
          </div>
        )}
      </div>

      {/* Usage Bars */}
      <div className="space-y-4 mb-4">
        {/* Hourly Usage */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Hourly</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${getStatusColor(percentages?.hourly || 0)}`}>
                {formatTokens(tokenUsage.inputTokens + tokenUsage.outputTokens)}
              </span>
              <span className="text-xs text-slate-500">/ {formatTokens(usageLimitConfig.maxTokensPerHour)}</span>
              <span className="text-xs text-slate-500">({percentages?.hourly || 0}%)</span>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getStatusBg(percentages?.hourly || 0)}`}
              style={{ width: `${Math.min(percentages?.hourly || 0, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-500">
              Resets in {minutesUntilReset} min
            </span>
            <span className="text-xs text-green-400">{formatCost(hourlyCost)}</span>
          </div>
        </div>

        {/* Daily Usage */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Daily</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${getStatusColor(percentages?.daily || 0)}`}>
                {formatTokens(dailyTokenUsage.input + dailyTokenUsage.output)}
              </span>
              <span className="text-xs text-slate-500">/ {formatTokens(usageLimitConfig.maxTokensPerDay)}</span>
              <span className="text-xs text-slate-500">({percentages?.daily || 0}%)</span>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getStatusBg(percentages?.daily || 0)}`}
              style={{ width: `${Math.min(percentages?.daily || 0, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-end mt-1">
            <span className="text-xs text-green-400">{formatCost(dailyCost)}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Input</div>
          <div className="text-sm font-medium text-green-400">
            {formatTokens(tokenUsage.inputTokens)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Output</div>
          <div className="text-sm font-medium text-blue-400">
            {formatTokens(tokenUsage.outputTokens)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Weekly</div>
          <div className="flex items-center justify-center gap-1">
            <DollarSign className="w-3 h-3 text-green-400" />
            <span className="text-sm font-medium text-white">{formatCost(weeklyCost)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000000) * PRICING.input + (outputTokens / 1000000) * PRICING.output;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return tokens.toString();
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}
