import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api';
import {
  Activity,
  Search,
  Download,
  Trash2,
  Filter,
  Calendar,
  Cpu,
  User,
  Settings,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  DollarSign,
  Clock,
  FileText,
  FolderGit,
} from 'lucide-react';
import type { ActivityCategory, ActivityLogEntry } from '@shared/types';

const CATEGORY_CONFIG: Record<ActivityCategory, { label: string; icon: typeof Activity; color: string }> = {
  execution: { label: 'Execution', icon: Cpu, color: 'text-cyan-400 bg-cyan-500/20' },
  user_action: { label: 'User Action', icon: User, color: 'text-green-400 bg-green-500/20' },
  system: { label: 'System', icon: Settings, color: 'text-blue-400 bg-blue-500/20' },
  error: { label: 'Error', icon: AlertTriangle, color: 'text-red-400 bg-red-500/20' },
  project: { label: 'Project', icon: FolderGit, color: 'text-purple-400 bg-purple-500/20' },
};

export default function ActivityLog() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | 'all'>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Fetch activity logs
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['activity-logs', categoryFilter, dateRange],
    queryFn: () =>
      api.getActivityLogs({
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
        limit: 100,
      }),
  });

  // Fetch activity summary
  const { data: summary } = useQuery({
    queryKey: ['activity-summary', dateRange],
    queryFn: () =>
      api.getActivitySummary({
        start: dateRange.start || undefined,
        end: dateRange.end || undefined,
      }),
  });

  // Search logs
  const { data: searchResults } = useQuery({
    queryKey: ['activity-search', searchQuery, categoryFilter],
    queryFn: () =>
      searchQuery
        ? api.searchActivityLogs(searchQuery, {
            category: categoryFilter === 'all' ? undefined : categoryFilter,
            limit: 100,
          })
        : null,
    enabled: searchQuery.length > 0,
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (format: 'json' | 'csv') => {
      const data = await api.exportActivityLogs(format, {
        start: dateRange.start || undefined,
        end: dateRange.end || undefined,
      });
      if (data) {
        const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-log-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
  });

  // Clear mutation
  const clearMutation = useMutation({
    mutationFn: () => api.clearActivityLogs() ?? Promise.resolve({ success: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
    },
  });

  const displayLogs = searchQuery ? searchResults : logs;

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatCost = (cost: number | undefined) => {
    if (cost === undefined) return '-';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  };

  const formatDuration = (ms: number | undefined) => {
    if (ms === undefined) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Activity Log
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => exportMutation.mutate('csv')}
            disabled={exportMutation.isPending}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => exportMutation.mutate('json')}
            disabled={exportMutation.isPending}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <FileText size={16} />
            Export JSON
          </button>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear all activity logs?')) {
                clearMutation.mutate();
              }
            }}
            disabled={clearMutation.isPending}
            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 size={16} />
            Clear All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Activity size={14} />
              Total Entries
            </div>
            <div className="text-2xl font-bold text-white">{summary.totalEntries.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <DollarSign size={14} />
              Total Cost
            </div>
            <div className="text-2xl font-bold text-green-400">{formatCost(summary.totalCostUsd)}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Cpu size={14} />
              Total Tokens
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              {formatTokens(summary.totalTokens.input + summary.totalTokens.output)}
            </div>
            <div className="text-xs text-slate-500">
              In: {formatTokens(summary.totalTokens.input)} / Out: {formatTokens(summary.totalTokens.output)}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Clock size={14} />
              Avg Duration
            </div>
            <div className="text-2xl font-bold text-blue-400">{formatDuration(summary.averageDuration)}</div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {summary && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">By Category</h3>
          <div className="flex gap-4 flex-wrap">
            {(Object.entries(summary.byCategory) as [ActivityCategory, number][]).map(([category, count]) => {
              const config = CATEGORY_CONFIG[category];
              const Icon = config.icon;
              return (
                <div key={category} className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${config.color.split(' ')[1]}`}>
                    <Icon size={14} className={config.color.split(' ')[0]} />
                  </div>
                  <span className="text-slate-300">{config.label}</span>
                  <span className="text-slate-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search activity logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ActivityCategory | 'all')}
            className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* Toggle Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showFilters ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Filter size={16} />
            Filters
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-sm text-slate-400">Date Range:</span>
            </div>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({ start: '', end: '' })}
                className="text-sm text-slate-400 hover:text-white"
              >
                Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Activity Log List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading activity logs...</div>
        ) : !displayLogs || displayLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {searchQuery ? 'No matching activity logs found' : 'No activity logs yet'}
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {displayLogs.map((entry: ActivityLogEntry) => {
              const config = CATEGORY_CONFIG[entry.category];
              const Icon = config.icon;
              const isExpanded = expandedEntries.has(entry.id);

              return (
                <div key={entry.id} className="hover:bg-slate-700/50 transition-colors">
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer"
                    onClick={() => toggleExpanded(entry.id)}
                  >
                    {/* Category Icon */}
                    <div className={`p-2 rounded-lg ${config.color.split(' ')[1]}`}>
                      <Icon size={18} className={config.color.split(' ')[0]} />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{entry.action}</span>
                        {entry.taskId && (
                          <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">
                            Task: {entry.taskId}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 mt-0.5">{formatTimestamp(entry.timestamp)}</div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      {entry.tokens && (
                        <div className="text-cyan-400" title="Tokens">
                          <Cpu size={14} className="inline mr-1" />
                          {formatTokens(entry.tokens.input + entry.tokens.output)}
                        </div>
                      )}
                      {entry.costUsd !== undefined && (
                        <div className="text-green-400" title="Cost">
                          {formatCost(entry.costUsd)}
                        </div>
                      )}
                      {entry.duration !== undefined && (
                        <div className="text-blue-400" title="Duration">
                          {formatDuration(entry.duration)}
                        </div>
                      )}
                    </div>

                    {/* Expand/Collapse */}
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && Object.keys(entry.details).length > 0 && (
                    <div className="px-4 pb-4 pl-16">
                      <div className="bg-slate-900 rounded-lg p-3 text-sm">
                        <pre className="text-slate-300 whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
