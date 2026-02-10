import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import {
  Plug, RefreshCw, Plus, Trash2, Edit2, Save, X, Power, PowerOff,
  ChevronRight, Terminal, Monitor, AlertCircle,
} from 'lucide-react';

interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'websocket';
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  autoConnect: boolean;
}

interface ConnectedServer {
  name: string;
  connected: boolean;
  tools?: { name: string; description: string }[];
}

const EMPTY_CONFIG: MCPServerConfig = {
  name: '',
  transport: 'stdio',
  command: '',
  args: [],
  enabled: true,
  autoConnect: false,
};

export default function MCP() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<MCPServerConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { data: configs, isLoading } = useQuery({
    queryKey: ['mcp-configs'],
    queryFn: () => api.getMcpConfigs() as Promise<MCPServerConfig[]>,
  });

  const { data: connected } = useQuery({
    queryKey: ['mcp-connected'],
    queryFn: () => api.getConnectedMcpServers() as Promise<ConnectedServer[]>,
  });

  const { data: defaults } = useQuery({
    queryKey: ['mcp-defaults'],
    queryFn: () => api.getMcpDefaultConfigs() as Promise<MCPServerConfig[]>,
  });

  const addMutation = useMutation({
    mutationFn: (config: MCPServerConfig) => api.addMcpConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-configs'] });
      setIsCreating(false);
      setIsEditing(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (name: string) => api.removeMcpConfig(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-configs'] });
      setSelected(null);
    },
  });

  const connectMutation = useMutation({
    mutationFn: (name: string) => api.connectMcpServer(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connected'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (name: string) => api.disconnectMcpServer(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connected'] });
    },
  });

  const isServerConnected = (name: string) =>
    connected?.some(s => s.name === name && s.connected) || false;

  const allConfigs = [...(configs || []), ...(defaults || []).filter(d =>
    !(configs || []).some(c => c.name === d.name)
  )];

  const handleCreateNew = () => {
    setSelected({ ...EMPTY_CONFIG });
    setIsCreating(true);
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">MCP Servers</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage Model Context Protocol server configurations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['mcp-configs'] })}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Server
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Server list */}
        <div className="lg:col-span-1 space-y-4">
          {isLoading ? (
            <div className="p-4 text-center text-slate-400">Loading MCP configs...</div>
          ) : allConfigs.length === 0 ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
              <Plug className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">No MCP servers configured</p>
              <p className="text-sm text-slate-500 mt-1">Add a server to get started</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {allConfigs.map((config) => (
                <button
                  key={config.name}
                  onClick={() => {
                    setSelected(config);
                    setIsEditing(false);
                    setIsCreating(false);
                  }}
                  className={`w-full bg-slate-800 rounded-lg border border-slate-700 p-3 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 ${
                    selected?.name === config.name ? 'bg-slate-700/50 border-cyan-500/50' : ''
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isServerConnected(config.name) ? 'bg-green-400' : 'bg-slate-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{config.name}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {config.transport === 'stdio' ? config.command : config.url}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {config.transport === 'stdio' ? (
                      <Terminal size={12} className="text-slate-500" />
                    ) : (
                      <Monitor size={12} className="text-slate-500" />
                    )}
                    <ChevronRight size={14} className="text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Server detail / editor */}
        <div className="lg:col-span-2">
          {selected ? (
            <MCPEditor
              config={selected}
              isEditing={isEditing}
              isCreating={isCreating}
              isConnected={isServerConnected(selected.name)}
              onEdit={() => setIsEditing(true)}
              onCancel={() => {
                if (isCreating) {
                  setSelected(null);
                  setIsCreating(false);
                }
                setIsEditing(false);
              }}
              onSave={(config) => addMutation.mutate(config)}
              onDelete={() => removeMutation.mutate(selected.name)}
              onConnect={() => connectMutation.mutate(selected.name)}
              onDisconnect={() => disconnectMutation.mutate(selected.name)}
              isSaving={addMutation.isPending}
              isDeleting={removeMutation.isPending}
              isConnecting={connectMutation.isPending}
              isDisconnecting={disconnectMutation.isPending}
              connectedTools={connected?.find(s => s.name === selected.name)?.tools || []}
            />
          ) : (
            <MCPPlaceholder />
          )}
        </div>
      </div>
    </div>
  );
}

function MCPPlaceholder() {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
      <Plug className="w-12 h-12 text-slate-500 mx-auto mb-4" />
      <p className="text-slate-400">Select a server to view details</p>
      <p className="text-sm text-slate-500 mt-2">
        or add a new MCP server configuration
      </p>
      <div className="mt-6 text-left max-w-md mx-auto space-y-3">
        <h4 className="font-medium text-white text-sm">What is MCP?</h4>
        <p className="text-slate-400 text-sm">
          The Model Context Protocol allows Claude Code to connect to external tools
          and data sources. Configure MCP servers here to extend Claude's capabilities.
        </p>
        <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-400">
          <div>Transport: stdio (local process) or websocket (remote)</div>
          <div>Auto-connect: start when the server launches</div>
        </div>
      </div>
    </div>
  );
}

interface MCPEditorProps {
  config: MCPServerConfig;
  isEditing: boolean;
  isCreating: boolean;
  isConnected: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (config: MCPServerConfig) => void;
  onDelete: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  connectedTools: { name: string; description: string }[];
}

function MCPEditor({
  config, isEditing, isCreating, isConnected,
  onEdit, onCancel, onSave, onDelete, onConnect, onDisconnect,
  isSaving, isDeleting, isConnecting, isDisconnecting, connectedTools,
}: MCPEditorProps) {
  const [form, setForm] = useState<MCPServerConfig>({ ...config });
  const [argsText, setArgsText] = useState((config.args || []).join(' '));
  const [envText, setEnvText] = useState(
    Object.entries(config.env || {}).map(([k, v]) => `${k}=${v}`).join('\n')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const args = argsText.trim() ? argsText.trim().split(/\s+/) : [];
    const env: Record<string, string> = {};
    for (const line of envText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
      }
    }
    onSave({ ...form, args, env: Object.keys(env).length > 0 ? env : undefined });
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-slate-500'}`} />
          <h3 className="font-semibold text-white">
            {isCreating ? 'Add MCP Server' : config.name}
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded ${
            config.transport === 'stdio'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-purple-500/20 text-purple-400'
          }`}>
            {config.transport}
          </span>
          {isConnected && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              {isConnected ? (
                <button
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                  className="flex items-center gap-1 px-3 py-1.5 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded text-sm transition-colors"
                >
                  <PowerOff size={14} />
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={onConnect}
                  disabled={isConnecting}
                  className="flex items-center gap-1 px-3 py-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded text-sm transition-colors"
                >
                  <Power size={14} />
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              )}
              <button
                onClick={onEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded text-sm transition-colors"
              >
                <Edit2 size={14} />
                Edit
              </button>
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded text-sm transition-colors"
              >
                <Trash2 size={14} />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onCancel}
                className="flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded text-sm transition-colors"
              >
                <X size={14} />
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || !form.name}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 text-white rounded text-sm hover:bg-cyan-600 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
          {isEditing ? (
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="my-mcp-server"
              required
              disabled={!isCreating}
            />
          ) : (
            <p className="text-white">{config.name}</p>
          )}
        </div>

        {/* Transport */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Transport</label>
          {isEditing ? (
            <select
              value={form.transport}
              onChange={(e) => setForm({ ...form, transport: e.target.value as 'stdio' | 'websocket' })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="stdio">stdio (local process)</option>
              <option value="websocket">websocket (remote)</option>
            </select>
          ) : (
            <p className="text-slate-400">{config.transport}</p>
          )}
        </div>

        {/* Command (stdio) or URL (websocket) */}
        {(isEditing ? form.transport : config.transport) === 'stdio' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Command</label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.command || ''}
                  onChange={(e) => setForm({ ...form, command: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  placeholder="npx"
                />
              ) : (
                <p className="text-slate-400 font-mono text-sm">{config.command || 'Not set'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Arguments</label>
              {isEditing ? (
                <input
                  type="text"
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  placeholder="-y @example/mcp-server"
                />
              ) : (
                <p className="text-slate-400 font-mono text-sm">
                  {(config.args || []).join(' ') || 'None'}
                </p>
              )}
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">URL</label>
            {isEditing ? (
              <input
                type="text"
                value={form.url || ''}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                placeholder="ws://localhost:8080"
              />
            ) : (
              <p className="text-slate-400 font-mono text-sm">{config.url || 'Not set'}</p>
            )}
          </div>
        )}

        {/* Working Directory */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Working Directory</label>
          {isEditing ? (
            <input
              type="text"
              value={form.cwd || ''}
              onChange={(e) => setForm({ ...form, cwd: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="(optional)"
            />
          ) : (
            <p className="text-slate-400 font-mono text-sm">{config.cwd || 'Default'}</p>
          )}
        </div>

        {/* Environment Variables */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Environment Variables</label>
          {isEditing ? (
            <textarea
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              className="w-full h-24 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-y"
              placeholder="KEY=value&#10;ANOTHER_KEY=value"
            />
          ) : (
            <div className="font-mono text-sm text-slate-400">
              {config.env && Object.keys(config.env).length > 0 ? (
                Object.entries(config.env).map(([k, v]) => (
                  <div key={k}>{k}={v}</div>
                ))
              ) : (
                <span>None</span>
              )}
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isEditing ? form.enabled : config.enabled}
              onChange={(e) => isEditing && setForm({ ...form, enabled: e.target.checked })}
              disabled={!isEditing}
              className="rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
            />
            <label className="text-sm text-slate-300">Enabled</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isEditing ? form.autoConnect : config.autoConnect}
              onChange={(e) => isEditing && setForm({ ...form, autoConnect: e.target.checked })}
              disabled={!isEditing}
              className="rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
            />
            <label className="text-sm text-slate-300">Auto-connect on startup</label>
          </div>
        </div>

        {/* Connected tools */}
        {isConnected && connectedTools.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Available Tools ({connectedTools.length})
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {connectedTools.map((tool) => (
                <div key={tool.name} className="p-2 bg-slate-900 rounded flex items-start gap-2">
                  <span className="text-cyan-400 font-mono text-xs">{tool.name}</span>
                  <span className="text-slate-500 text-xs">{tool.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {!isConnected && !isEditing && config.enabled && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
            <AlertCircle size={16} />
            Server is not connected. Click Connect to start.
          </div>
        )}
      </form>
    </div>
  );
}
