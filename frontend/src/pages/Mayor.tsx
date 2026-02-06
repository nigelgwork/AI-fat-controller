import { useState, useEffect } from 'react';
import { api } from '@/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Crown,
  Play,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Check,
  X,
  Activity,
  RefreshCw,
} from 'lucide-react';
import type { MayorState, ApprovalRequest, ActionLog } from '../types/gastown';
import ApprovalModal from '../components/ApprovalModal';

export default function Mayor() {
  const queryClient = useQueryClient();
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);

  // Fetch Mayor state
  const { data: mayorState, isLoading: stateLoading } = useQuery({
    queryKey: ['mayor-state'],
    queryFn: () => api.getMayorState(),
    refetchInterval: 2000,
  });

  // Fetch approval queue
  const { data: approvalQueue = [] } = useQuery({
    queryKey: ['approval-queue'],
    queryFn: () => api.getApprovalQueue(),
    refetchInterval: 2000,
  });

  // Fetch action logs
  const { data: actionLogs = [] } = useQuery({
    queryKey: ['action-logs'],
    queryFn: () => api.getActionLogs(50),
    refetchInterval: 5000,
  });

  // Mutations
  const activateMutation = useMutation({
    mutationFn: () => api.activateMayor(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mayor-state'] }),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => api.deactivateMayor(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mayor-state'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.pauseMayor(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mayor-state'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.resumeMayor(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mayor-state'] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['mayor-state'] });
      queryClient.invalidateQueries({ queryKey: ['action-logs'] });
      setSelectedApproval(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.rejectRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['mayor-state'] });
      queryClient.invalidateQueries({ queryKey: ['action-logs'] });
      setSelectedApproval(null);
    },
  });

  // Listen for real-time updates
  useEffect(() => {
    const unsubState = api.onMayorStateChanged?.(() => {
      queryClient.invalidateQueries({ queryKey: ['mayor-state'] });
    });

    const unsubApproval = api.onApprovalRequired?.(() => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
    });

    const unsubAction = api.onActionCompleted?.(() => {
      queryClient.invalidateQueries({ queryKey: ['action-logs'] });
    });

    return () => {
      unsubState?.();
      unsubApproval?.();
      unsubAction?.();
    };
  }, [queryClient]);

  const getStatusColor = (status: MayorState['status'] | undefined) => {
    switch (status) {
      case 'running':
        return 'text-green-400';
      case 'paused':
        return 'text-yellow-400';
      case 'waiting_approval':
        return 'text-cyan-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: MayorState['status'] | undefined) => {
    switch (status) {
      case 'running':
        return <Activity className="w-5 h-5 animate-pulse" />;
      case 'paused':
        return <Pause className="w-5 h-5" />;
      case 'waiting_approval':
        return <Clock className="w-5 h-5" />;
      default:
        return <Square className="w-5 h-5" />;
    }
  };

  const getStatusLabel = (status: MayorState['status'] | undefined) => {
    switch (status) {
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'waiting_approval':
        return 'Waiting for Approval';
      default:
        return 'Idle';
    }
  };

  const getLogResultIcon = (result: ActionLog['result']) => {
    switch (result) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failure':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'skipped':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (stateLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const isActive = mayorState?.status !== 'idle';
  const isPaused = mayorState?.status === 'paused';
  const pendingApprovals = approvalQueue.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-8 h-8 text-cyan-400" />
          <h2 className="text-2xl font-bold text-white">Mayor</h2>
          <span className="text-sm text-slate-400">AI Project Manager</span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          {!isActive ? (
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Activate
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              ) : (
                <button
                  onClick={() => pauseMutation.mutate()}
                  disabled={pauseMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              )}
              <button
                onClick={() => deactivateMutation.mutate()}
                disabled={deactivateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Dashboard */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-2 ${getStatusColor(mayorState?.status)}`}>
              {getStatusIcon(mayorState?.status)}
              <span className="font-medium">{getStatusLabel(mayorState?.status)}</span>
            </span>
          </div>
          {mayorState?.startedAt && (
            <span className="text-sm text-slate-400">
              Started: {new Date(mayorState.startedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {mayorState?.currentAction && (
          <div className="mb-4 p-3 bg-slate-900 rounded-lg">
            <span className="text-sm text-slate-400">Current: </span>
            <span className="text-white">{mayorState.currentAction}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{mayorState?.processedCount || 0}</div>
            <div className="text-xs text-slate-400">Processed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{mayorState?.approvedCount || 0}</div>
            <div className="text-xs text-slate-400">Approved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{mayorState?.rejectedCount || 0}</div>
            <div className="text-xs text-slate-400">Rejected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{mayorState?.errorCount || 0}</div>
            <div className="text-xs text-slate-400">Errors</div>
          </div>
        </div>
      </div>

      {/* Approval Queue */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Approval Queue
            {pendingApprovals.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-sm rounded">
                {pendingApprovals.length} pending
              </span>
            )}
          </h3>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No pending approvals</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {pendingApprovals.map((request) => (
              <div key={request.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded capitalize">
                        {request.actionType.replace('_', ' ')}
                      </span>
                      <span className="text-white font-medium">{request.taskTitle}</span>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2">{request.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedApproval(request)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                    <button
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white text-sm rounded transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ id: request.id })}
                      disabled={rejectMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white text-sm rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Log */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Action Log</h3>
        </div>

        {actionLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No actions recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
            {actionLogs.map((log) => (
              <div key={log.id} className="p-3 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-14">{formatTime(log.timestamp)}</span>
                  {getLogResultIcon(log.result)}
                  <span className="text-sm text-white flex-1 truncate">{log.taskTitle}</span>
                  <span className="text-xs text-slate-400">{log.description}</span>
                  {log.autoApproved && (
                    <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">
                      auto
                    </span>
                  )}
                  <span className="text-xs text-slate-500 w-12 text-right">
                    {formatDuration(log.duration)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {selectedApproval && (
        <ApprovalModal
          request={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onApprove={() => approveMutation.mutate(selectedApproval.id)}
          onReject={(reason) => rejectMutation.mutate({ id: selectedApproval.id, reason })}
          isApproving={approveMutation.isPending}
          isRejecting={rejectMutation.isPending}
        />
      )}
    </div>
  );
}
