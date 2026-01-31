import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings,
  Plug,
  PlugZap,
  ChevronDown,
  ChevronRight,
  Terminal,
  Globe,
} from 'lucide-react';
import type { MCPServerConfig, MCPTool } from '../types/gastown';

interface MCPServerConfigPanelProps {
  className?: string;
}

export default function MCPServerConfigPanel({ className = '' }: MCPServerConfigPanelProps) {
  const queryClient = useQueryClient();
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConfig, setNewConfig] = useState<Partial<MCPServerConfig>>({
    name: '',
    transport: 'stdio',
    enabled: true,
    autoConnect: false,
  });

  // Fetch MCP server configs
  const { data: configs = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['mcp-configs'],
    queryFn: () => window.electronAPI?.getMcpConfigs() as Promise<MCPServerConfig[]>,
  });

  // Fetch connected servers
  const { data: connectedServers = [] } = useQuery({
    queryKey: ['mcp-connected'],
    queryFn: () => window.electronAPI?.getConnectedMcpServers() as Promise<string[]>,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch default configs
  const { data: defaultConfigs = [] } = useQuery({
    queryKey: ['mcp-default-configs'],
    queryFn: () => window.electronAPI?.getMcpDefaultConfigs() as Promise<MCPServerConfig[]>,
  });

  // Add config mutation
  const addConfigMutation = useMutation({
    mutationFn: (config: MCPServerConfig) =>
      window.electronAPI?.addMcpConfig(config) as Promise<MCPServerConfig[]>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-configs'] });
      setShowAddForm(false);
      setNewConfig({ name: '', transport: 'stdio', enabled: true, autoConnect: false });
    },
  });

  // Remove config mutation
  const removeConfigMutation = useMutation({
    mutationFn: (name: string) =>
      window.electronAPI?.removeMcpConfig(name) as Promise<MCPServerConfig[]>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-configs'] });
      queryClient.invalidateQueries({ queryKey: ['mcp-connected'] });
    },
  });

  // Connect server mutation
  const connectMutation = useMutation({
    mutationFn: (name: string) =>
      window.electronAPI?.connectMcpServer(name) as Promise<{ connected: boolean; tools: MCPTool[] }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connected'] });
    },
  });

  // Disconnect server mutation
  const disconnectMutation = useMutation({
    mutationFn: (name: string) =>
      window.electronAPI?.disconnectMcpServer(name) as Promise<boolean>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connected'] });
    },
  });

  // Server tools query
  const getServerTools = async (name: string): Promise<MCPTool[]> => {
    return window.electronAPI?.getMcpServerTools(name) as Promise<MCPTool[]>;
  };

  const isConnected = (name: string) => connectedServers.includes(name);

  const handleAddDefaultConfig = (defaultConfig: MCPServerConfig) => {
    addConfigMutation.mutate({ ...defaultConfig });
  };

  const handleAddConfig = () => {
    if (!newConfig.name) return;

    const config: MCPServerConfig = {
      name: newConfig.name,
      transport: newConfig.transport || 'stdio',
      enabled: newConfig.enabled ?? true,
      autoConnect: newConfig.autoConnect ?? false,
      ...(newConfig.transport === 'stdio' && {
        command: newConfig.command,
        args: newConfig.args,
        cwd: newConfig.cwd,
      }),
      ...(newConfig.transport === 'websocket' && {
        url: newConfig.url,
      }),
    };

    addConfigMutation.mutate(config);
  };

  if (loadingConfigs) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-700 p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white">MCP Servers</h3>
          <span className="text-xs text-slate-400">
            ({connectedServers.length} connected)
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 rounded text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Add Server
        </button>
      </div>

      {/* Add Server Form */}
      {showAddForm && (
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          <div className="space-y-3">
            {/* Quick add from defaults */}
            {defaultConfigs.filter(d => !configs.find(c => c.name === d.name)).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">Quick Add:</p>
                <div className="flex flex-wrap gap-2">
                  {defaultConfigs
                    .filter(d => !configs.find(c => c.name === d.name))
                    .map(dc => (
                      <button
                        key={dc.name}
                        onClick={() => handleAddDefaultConfig(dc)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                      >
                        {dc.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Custom config form */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Server Name</label>
                <input
                  type="text"
                  value={newConfig.name || ''}
                  onChange={e => setNewConfig({ ...newConfig, name: e.target.value })}
                  placeholder="my-mcp-server"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Transport</label>
                <select
                  value={newConfig.transport || 'stdio'}
                  onChange={e => setNewConfig({ ...newConfig, transport: e.target.value as 'stdio' | 'websocket' })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="stdio">stdio (local process)</option>
                  <option value="websocket">WebSocket (remote)</option>
                </select>
              </div>
            </div>

            {newConfig.transport === 'stdio' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Command</label>
                  <input
                    type="text"
                    value={newConfig.command || ''}
                    onChange={e => setNewConfig({ ...newConfig, command: e.target.value })}
                    placeholder="npx mcp-server"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Working Directory</label>
                  <input
                    type="text"
                    value={newConfig.cwd || ''}
                    onChange={e => setNewConfig({ ...newConfig, cwd: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-400 mb-1">WebSocket URL</label>
                <input
                  type="text"
                  value={newConfig.url || ''}
                  onChange={e => setNewConfig({ ...newConfig, url: e.target.value })}
                  placeholder="ws://localhost:3000"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={newConfig.enabled ?? true}
                  onChange={e => setNewConfig({ ...newConfig, enabled: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={newConfig.autoConnect ?? false}
                  onChange={e => setNewConfig({ ...newConfig, autoConnect: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                Auto-connect on startup
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddConfig}
                disabled={!newConfig.name || addConfigMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
              >
                {addConfigMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server List */}
      <div className="divide-y divide-slate-700">
        {configs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No MCP servers configured</p>
            <p className="text-sm mt-1">Add a server to enable direct UI automation</p>
          </div>
        ) : (
          configs.map(config => (
            <ServerConfigItem
              key={config.name}
              config={config}
              isConnected={isConnected(config.name)}
              isExpanded={expandedServer === config.name}
              onToggleExpand={() => setExpandedServer(expandedServer === config.name ? null : config.name)}
              onConnect={() => connectMutation.mutate(config.name)}
              onDisconnect={() => disconnectMutation.mutate(config.name)}
              onRemove={() => removeConfigMutation.mutate(config.name)}
              isConnecting={connectMutation.isPending && connectMutation.variables === config.name}
              isDisconnecting={disconnectMutation.isPending && disconnectMutation.variables === config.name}
              getTools={() => getServerTools(config.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ServerConfigItemProps {
  config: MCPServerConfig;
  isConnected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  getTools: () => Promise<MCPTool[]>;
}

function ServerConfigItem({
  config,
  isConnected,
  isExpanded,
  onToggleExpand,
  onConnect,
  onDisconnect,
  onRemove,
  isConnecting,
  isDisconnecting,
  getTools,
}: ServerConfigItemProps) {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);

  useEffect(() => {
    if (isExpanded && isConnected) {
      setLoadingTools(true);
      getTools()
        .then(setTools)
        .finally(() => setLoadingTools(false));
    }
  }, [isExpanded, isConnected, getTools]);

  return (
    <div className="p-4">
      {/* Server Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 text-left flex-1"
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
          <div className="flex items-center gap-2">
            {config.transport === 'stdio' ? (
              <Terminal size={16} className="text-slate-400" />
            ) : (
              <Globe size={16} className="text-slate-400" />
            )}
            <div>
              <h4 className="font-medium text-white">{config.name}</h4>
              <p className="text-xs text-slate-400">
                {config.transport === 'stdio' ? config.command : config.url}
                {config.autoConnect && ' · Auto-connect'}
              </p>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <>
                <CheckCircle2 size={14} className="text-green-400" />
                <span className="text-xs text-green-400">Connected</span>
              </>
            ) : (
              <>
                <XCircle size={14} className="text-slate-500" />
                <span className="text-xs text-slate-500">Disconnected</span>
              </>
            )}
          </div>

          {/* Connect/Disconnect button */}
          {isConnected ? (
            <button
              onClick={onDisconnect}
              disabled={isDisconnecting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-sm transition-colors"
            >
              {isDisconnecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plug size={14} />
              )}
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting || !config.enabled}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
            >
              {isConnecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlugZap size={14} />
              )}
              Connect
            </button>
          )}

          {/* Remove button */}
          <button
            onClick={onRemove}
            disabled={isConnected}
            className="p-1.5 text-slate-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={isConnected ? 'Disconnect first' : 'Remove server'}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 ml-6">
          {/* Config details */}
          <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
            <h5 className="text-xs text-slate-400 uppercase mb-2">Configuration</h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Transport:</span>{' '}
                <span className="text-white">{config.transport}</span>
              </div>
              {config.transport === 'stdio' && (
                <>
                  <div>
                    <span className="text-slate-500">Command:</span>{' '}
                    <span className="text-white font-mono">{config.command}</span>
                  </div>
                  {config.cwd && (
                    <div className="col-span-2">
                      <span className="text-slate-500">Working Dir:</span>{' '}
                      <span className="text-white font-mono">{config.cwd}</span>
                    </div>
                  )}
                </>
              )}
              {config.transport === 'websocket' && (
                <div className="col-span-2">
                  <span className="text-slate-500">URL:</span>{' '}
                  <span className="text-white font-mono">{config.url}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tools list (if connected) */}
          {isConnected && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <h5 className="text-xs text-slate-400 uppercase mb-2">
                Available Tools ({tools.length})
              </h5>
              {loadingTools ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-sm">Loading tools...</span>
                </div>
              ) : tools.length === 0 ? (
                <p className="text-sm text-slate-500">No tools available</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tools.map(tool => (
                    <div key={tool.name} className="text-sm">
                      <span className="text-cyan-400 font-mono">{tool.name}</span>
                      {tool.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{tool.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
