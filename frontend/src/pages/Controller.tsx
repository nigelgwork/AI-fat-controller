import { useState, useEffect, useRef } from 'react';
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
  Send,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  Cpu,
} from 'lucide-react';
import type { ControllerState, ApprovalRequest, ActionLog } from '../types/gastown';
import ApprovalModal from '../components/ApprovalModal';
import SpeechInput from '../components/SpeechInput';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: { input: number; output: number };
}

export default function Controller() {
  const queryClient = useQueryClient();
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'approvals' | 'logs'>('chat');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Controller state
  const { data: controllerState, isLoading: stateLoading } = useQuery({
    queryKey: ['controller-state'],
    queryFn: () => window.electronAPI?.getControllerState(),
    refetchInterval: 2000,
  });

  // Fetch approval queue
  const { data: approvalQueue = [] } = useQuery({
    queryKey: ['approval-queue'],
    queryFn: () => window.electronAPI?.getApprovalQueue(),
    refetchInterval: 2000,
  });

  // Fetch action logs
  const { data: actionLogs = [] } = useQuery({
    queryKey: ['action-logs'],
    queryFn: () => window.electronAPI?.getActionLogs(50),
    refetchInterval: 5000,
  });

  // Fetch conversation sessions
  const { data: conversationSessions = [] } = useQuery({
    queryKey: ['conversation-sessions'],
    queryFn: () => window.electronAPI?.listConversationSessions(),
    refetchInterval: 10000,
  });

  // Mutations
  const activateMutation = useMutation({
    mutationFn: () => window.electronAPI!.activateController(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['controller-state'] }),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => window.electronAPI!.deactivateController(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['controller-state'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => window.electronAPI!.pauseController(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['controller-state'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => window.electronAPI!.resumeController(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['controller-state'] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => window.electronAPI!.approveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['controller-state'] });
      queryClient.invalidateQueries({ queryKey: ['action-logs'] });
      setSelectedApproval(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      window.electronAPI!.rejectRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['controller-state'] });
      queryClient.invalidateQueries({ queryKey: ['action-logs'] });
      setSelectedApproval(null);
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: () => window.electronAPI!.createConversationSession('general', 'General'),
    onSuccess: (session) => {
      setSelectedSessionId(session.id);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['conversation-sessions'] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => window.electronAPI!.deleteConversationSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-sessions'] });
      if (selectedSessionId) {
        setSelectedSessionId(null);
        setMessages([]);
      }
    },
  });

  // Load conversation when session changes
  useEffect(() => {
    if (selectedSessionId) {
      window.electronAPI?.loadConversation(selectedSessionId).then((entries) => {
        const msgs: Message[] = entries.map((e) => ({
          id: e.id,
          role: e.role,
          content: e.content,
          timestamp: new Date(e.timestamp),
          tokens: e.tokens,
        }));
        setMessages(msgs);
      });
    }
  }, [selectedSessionId]);

  // Listen for real-time updates
  useEffect(() => {
    const unsubState = window.electronAPI?.onControllerStateChanged?.(() => {
      queryClient.invalidateQueries({ queryKey: ['controller-state'] });
    });

    const unsubApproval = window.electronAPI?.onApprovalRequired?.(() => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
    });

    const unsubAction = window.electronAPI?.onActionCompleted?.(() => {
      queryClient.invalidateQueries({ queryKey: ['action-logs'] });
    });

    return () => {
      unsubState?.();
      unsubApproval?.();
      unsubAction?.();
    };
  }, [queryClient]);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle chat submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Save to conversation if session exists
    if (selectedSessionId) {
      await window.electronAPI?.appendConversationEntry(selectedSessionId, {
        role: 'user',
        content: userMessage.content,
      });
    }

    try {
      // Check if it's a direct command
      const isDirectCommand = input.trim().startsWith('gt ') || input.trim().startsWith('bd ');

      let result;
      if (isDirectCommand) {
        const parts = input.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        if (cmd === 'gt') {
          result = await window.electronAPI?.executeGt(args);
        } else {
          result = await window.electronAPI?.executeBd(args);
        }
      } else {
        result = await window.electronAPI?.executeClaudeCode(input.trim());
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result?.response || result?.error || 'No response',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save to conversation if session exists
      if (selectedSessionId) {
        await window.electronAPI?.appendConversationEntry(selectedSessionId, {
          role: 'assistant',
          content: assistantMessage.content,
        });
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ControllerState['status'] | undefined) => {
    switch (status) {
      case 'running':
        return 'text-green-400';
      case 'winding_down':
        return 'text-orange-400';
      case 'paused':
        return 'text-yellow-400';
      case 'waiting_approval':
        return 'text-cyan-400';
      case 'waiting_input':
        return 'text-purple-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: ControllerState['status'] | undefined) => {
    switch (status) {
      case 'running':
        return <Activity className="w-5 h-5 animate-pulse" />;
      case 'winding_down':
        return <Clock className="w-5 h-5 animate-pulse" />;
      case 'paused':
        return <Pause className="w-5 h-5" />;
      case 'waiting_approval':
        return <Clock className="w-5 h-5" />;
      case 'waiting_input':
        return <MessageSquare className="w-5 h-5" />;
      default:
        return <Square className="w-5 h-5" />;
    }
  };

  const getStatusLabel = (status: ControllerState['status'] | undefined) => {
    switch (status) {
      case 'running':
        return 'Running';
      case 'winding_down':
        return 'Winding Down';
      case 'paused':
        return 'Paused';
      case 'waiting_approval':
        return 'Waiting for Approval';
      case 'waiting_input':
        return 'Waiting for Input';
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

  const formatTokens = (tokens: { inputTokens: number; outputTokens: number; limit: number }) => {
    const total = tokens.inputTokens + tokens.outputTokens;
    const percentage = Math.round((total / tokens.limit) * 100);
    return `${total.toLocaleString()} / ${tokens.limit.toLocaleString()} (${percentage}%)`;
  };

  const getUsageStatusColor = (status?: string) => {
    switch (status) {
      case 'at_limit': return 'text-red-400';
      case 'approaching_limit': return 'text-orange-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  const getUsageStatusBg = (status?: string) => {
    switch (status) {
      case 'at_limit': return 'bg-red-500/20';
      case 'approaching_limit': return 'bg-orange-500/20';
      case 'warning': return 'bg-yellow-500/20';
      default: return '';
    }
  };

  if (stateLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const isActive = controllerState?.status !== 'idle';
  const isPaused = controllerState?.status === 'paused';
  const isWindingDown = controllerState?.status === 'winding_down';
  const pendingApprovals = approvalQueue.filter((r) => r.status === 'pending');

  return (
    <div className="flex h-full gap-4">
      {/* Left sidebar - Conversation Sessions */}
      <div className="w-64 bg-slate-800 rounded-lg border border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Conversations</h3>
          <button
            onClick={() => createSessionMutation.mutate()}
            disabled={createSessionMutation.isPending}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversationSessions.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No conversations yet
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {conversationSessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 cursor-pointer hover:bg-slate-700/50 transition-colors group ${
                    selectedSessionId === session.id ? 'bg-slate-700/50' : ''
                  }`}
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{session.projectName}</div>
                      <div className="text-xs text-slate-400">
                        {session.entryCount} messages
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(session.lastActivityAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSessionMutation.mutate(session.id);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header with status and controls */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-cyan-400" />
              <div>
                <h2 className="text-xl font-bold text-white">Phat Controller</h2>
                <span className="text-sm text-slate-400">AI Project Manager</span>
              </div>
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
                  ) : isWindingDown ? (
                    <button
                      disabled
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600/50 text-white/70 rounded-lg cursor-not-allowed"
                      title="Will auto-resume when token limit resets"
                    >
                      <Clock className="w-4 h-4 animate-pulse" />
                      Auto-resuming...
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

          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className={`flex items-center gap-2 ${getStatusColor(controllerState?.status)}`}>
                {getStatusIcon(controllerState?.status)}
                <span className="font-medium">{getStatusLabel(controllerState?.status)}</span>
              </span>
              {controllerState?.currentAction && (
                <span className="text-sm text-slate-400">
                  {controllerState.currentAction}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              {pendingApprovals.length > 0 && (
                <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded">
                  {pendingApprovals.length} pending
                </span>
              )}
              {controllerState?.tokenUsage && (
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${getUsageStatusColor(controllerState.usageLimitStatus)} ${getUsageStatusBg(controllerState.usageLimitStatus)}`}>
                  <Cpu className="w-4 h-4" />
                  {formatTokens(controllerState.tokenUsage)}
                  {controllerState.pausedDueToLimit && (
                    <AlertTriangle className="w-4 h-4 ml-1" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {controllerState?.currentProgress && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-400">
                  {controllerState.currentProgress.stepDescription}
                </span>
                <span className="text-sm text-slate-500">
                  Step {controllerState.currentProgress.step} of {controllerState.currentProgress.totalSteps}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{
                    width: `${(controllerState.currentProgress.step / controllerState.currentProgress.totalSteps) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'chat'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'approvals'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Approvals
            {pendingApprovals.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded">
                {pendingApprovals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'logs'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Activity className="w-4 h-4 inline mr-2" />
            Activity Log
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
          {activeTab === 'chat' && (
            <>
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-slate-500 py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Send a message to the Phat Controller</p>
                    <p className="text-sm mt-2">
                      Try: "What commands are available?" or "gt rig list"
                    </p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-cyan-500 text-white'
                          : msg.role === 'system'
                          ? 'bg-slate-900 text-slate-300 border border-slate-600'
                          : 'bg-slate-700 text-slate-100'
                      }`}
                    >
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {msg.content}
                      </pre>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700 rounded-lg p-3">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat input */}
              <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                  <SpeechInput
                    onFinalTranscript={(text) => setInput((prev) => prev ? `${prev} ${text}` : text)}
                    onCommand={(command) => {
                      // Handle voice commands
                      if (command === 'pause') pauseMutation.mutate();
                      else if (command === 'resume') resumeMutation.mutate();
                      else if (command === 'approve' && pendingApprovals.length > 0) approveMutation.mutate(pendingApprovals[0].id);
                      else if (command === 'reject' && pendingApprovals.length > 0) rejectMutation.mutate({ id: pendingApprovals[0].id });
                      else if (command === 'clear') setInput('');
                    }}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask the controller or run a command..."
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === 'approvals' && (
            <div className="flex-1 overflow-y-auto">
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
          )}

          {activeTab === 'logs' && (
            <div className="flex-1 overflow-y-auto">
              {actionLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No actions recorded yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
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
          )}
        </div>
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
