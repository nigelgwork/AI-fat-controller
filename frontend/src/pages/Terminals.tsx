import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import {
  Terminal, Plus, X, Send, Play, Square, FolderGit,
  ChevronDown, ChevronRight, Shield, ShieldOff,
} from 'lucide-react';
import RefreshButton from '../components/RefreshButton';

interface TerminalSession {
  id: string;
  pid: number;
  status: 'running' | 'exited';
  workingDir: string;
  claudeArgs: string[];
  startedAt: string;
  exitCode?: number;
  outputLines: string[];
}

export default function Terminals() {
  const queryClient = useQueryClient();
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [showLauncher, setShowLauncher] = useState(false);

  const { data: terminals, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<TerminalSession[]>({
    queryKey: ['terminals'],
    queryFn: () => api.listTerminals(),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.closeTerminal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
    },
  });

  const runningTerminals = terminals?.filter(t => t.status === 'running') || [];
  const exitedTerminals = terminals?.filter(t => t.status === 'exited') || [];
  const selected = terminals?.find(t => t.id === selectedTerminal) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Terminal Sessions</h2>
          <p className="text-sm text-slate-400 mt-1">
            Launch and manage Claude Code terminal sessions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
          <button
            onClick={() => setShowLauncher(true)}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Terminal
          </button>
        </div>
      </div>

      {showLauncher && (
        <TerminalLauncher
          onClose={() => setShowLauncher(false)}
          onLaunched={(id) => {
            setShowLauncher(false);
            setSelectedTerminal(id);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Terminal list */}
        <div className="lg:col-span-1 space-y-4">
          {isLoading ? (
            <div className="p-4 text-center text-slate-400">Loading terminals...</div>
          ) : runningTerminals.length === 0 && exitedTerminals.length === 0 ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
              <Terminal className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">No terminal sessions</p>
              <p className="text-sm text-slate-500 mt-1">Launch a new Claude Code session</p>
            </div>
          ) : (
            <>
              {runningTerminals.length > 0 && (
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-3 border-b border-slate-700 flex items-center gap-2">
                    <Play size={14} className="text-green-400" />
                    <span className="text-sm font-medium text-slate-300">Running</span>
                    <span className="text-xs text-slate-500">({runningTerminals.length})</span>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {runningTerminals.map((t) => (
                      <TerminalListItem
                        key={t.id}
                        terminal={t}
                        isSelected={selectedTerminal === t.id}
                        onSelect={() => setSelectedTerminal(t.id)}
                        onClose={() => closeMutation.mutate(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {exitedTerminals.length > 0 && (
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-3 border-b border-slate-700 flex items-center gap-2">
                    <Square size={14} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">Exited</span>
                    <span className="text-xs text-slate-500">({exitedTerminals.length})</span>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {exitedTerminals.map((t) => (
                      <TerminalListItem
                        key={t.id}
                        terminal={t}
                        isSelected={selectedTerminal === t.id}
                        onSelect={() => setSelectedTerminal(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Terminal output */}
        <div className="lg:col-span-2">
          {selected ? (
            <TerminalOutput terminal={selected} />
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
              <Terminal className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">Select a terminal to view output</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TerminalListItemProps {
  terminal: TerminalSession;
  isSelected: boolean;
  onSelect: () => void;
  onClose?: () => void;
}

function TerminalListItem({ terminal, isSelected, onSelect, onClose }: TerminalListItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 ${
        isSelected ? 'bg-slate-700/50' : ''
      }`}
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        terminal.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm truncate">{terminal.id}</div>
        <div className="text-xs text-slate-400 truncate">{terminal.workingDir}</div>
      </div>
      {onClose && terminal.status === 'running' && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          title="Close terminal"
        >
          <X size={14} />
        </button>
      )}
    </button>
  );
}

interface TerminalOutputProps {
  terminal: TerminalSession;
}

function TerminalOutput({ terminal }: TerminalOutputProps) {
  const [input, setInput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  const { data: outputData } = useQuery({
    queryKey: ['terminal-output', terminal.id],
    queryFn: () => api.getTerminalOutput(terminal.id),
    refetchInterval: terminal.status === 'running' ? 2000 : undefined,
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.sendTerminalInput(terminal.id, text),
  });

  const lines = outputData?.lines || terminal.outputLines || [];

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMutation.mutate(input);
    setInput('');
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col h-[calc(100vh-280px)]">
      {/* Header */}
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            terminal.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'
          }`} />
          <span className="font-medium text-white text-sm">{terminal.id}</span>
          <span className="text-xs text-slate-500">PID: {terminal.pid}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FolderGit size={12} />
          <span className="truncate max-w-48">{terminal.workingDir}</span>
        </div>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto p-4 font-mono text-sm text-slate-300 bg-slate-900"
      >
        {lines.length === 0 ? (
          <p className="text-slate-500 italic">Waiting for output...</p>
        ) : (
          lines.map((line: string, i: number) => (
            <div key={i} className="whitespace-pre-wrap break-all leading-relaxed">
              {line}
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      {terminal.status === 'running' && (
        <div className="p-3 border-t border-slate-700 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Send input to Claude..."
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 rounded transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      )}

      {/* Exit status */}
      {terminal.status === 'exited' && (
        <div className={`p-3 border-t text-sm text-center ${
          terminal.exitCode === 0
            ? 'border-green-500/30 text-green-400 bg-green-500/10'
            : 'border-red-500/30 text-red-400 bg-red-500/10'
        }`}>
          Process exited with code {terminal.exitCode ?? 'unknown'}
        </div>
      )}
    </div>
  );
}

interface TerminalLauncherProps {
  onClose: () => void;
  onLaunched: (id: string) => void;
}

function TerminalLauncher({ onClose, onLaunched }: TerminalLauncherProps) {
  const queryClient = useQueryClient();
  const [workingDir, setWorkingDir] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [resumeId, setResumeId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.listProjects(),
  });

  const launchMutation = useMutation({
    mutationFn: (config: any) => api.launchTerminal(config),
    onSuccess: (session: any) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      onLaunched(session.id);
    },
  });

  const handleLaunch = () => {
    launchMutation.mutate({
      workingDir: workingDir || undefined,
      systemPrompt: systemPrompt || undefined,
      dangerouslySkipPermissions: skipPermissions,
      sessionId: resumeId || undefined,
    });
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-cyan-500/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Terminal size={18} className="text-cyan-400" />
          Launch Claude Code Terminal
        </h3>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Working directory */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Working Directory</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={workingDir}
            onChange={(e) => setWorkingDir(e.target.value)}
            placeholder="Leave empty for server root"
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
          />
        </div>
        {projects && (projects as any[]).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {(projects as any[]).slice(0, 5).map((p: any) => (
              <button
                key={p.id}
                onClick={() => setWorkingDir(p.path)}
                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 transition-colors flex items-center gap-1"
              >
                <FolderGit size={12} />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Permissions toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSkipPermissions(!skipPermissions)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            skipPermissions
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-slate-700 text-slate-300 border border-slate-600'
          }`}
        >
          {skipPermissions ? <ShieldOff size={16} /> : <Shield size={16} />}
          {skipPermissions ? 'Auto-accept all (dangerous)' : 'Normal permissions'}
        </button>
      </div>

      {/* Advanced options */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
      >
        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Advanced Options
      </button>

      {showAdvanced && (
        <div className="space-y-3 pl-4 border-l-2 border-slate-700">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Custom system prompt..."
              className="w-full h-20 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Resume Session ID</label>
            <input
              type="text"
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              placeholder="Session ID to resume..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      )}

      {/* Launch button */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleLaunch}
          disabled={launchMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          <Play size={16} />
          {launchMutation.isPending ? 'Launching...' : 'Launch'}
        </button>
      </div>

      {launchMutation.isError && (
        <p className="text-sm text-red-400">
          Failed to launch: {(launchMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
