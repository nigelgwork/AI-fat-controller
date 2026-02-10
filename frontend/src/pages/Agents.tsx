import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import {
  Bot, Plus, Trash2, Edit2, Save, X, ChevronRight, Package,
  FileText, Wand2, Code, Search, Hammer, Monitor, Terminal
} from 'lucide-react';
import type { ClaudeAgent } from '@shared/types';
import CollapsibleHelp from '../components/CollapsibleHelp';
import RefreshButton from '../components/RefreshButton';

const AGENT_COLORS = ['blue', 'green', 'yellow', 'magenta', 'red', 'cyan'] as const;
const AGENT_MODELS = ['inherit', 'sonnet', 'opus', 'haiku'] as const;
const AVAILABLE_TOOLS = [
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
  'WebFetch', 'WebSearch', 'Task', 'NotebookEdit'
] as const;

export default function Agents() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<ClaudeAgent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: agents, isLoading: isLoadingAgents, isFetching: isFetchingAgents, dataUpdatedAt: agentsUpdatedAt, refetch: refetchAgents } = useQuery({
    queryKey: ['claude-agents'],
    queryFn: () => api.listAgents() as Promise<ClaudeAgent[]>,
  });

  const createMutation = useMutation({
    mutationFn: (agent: Partial<ClaudeAgent>) => api.createAgent(agent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-agents'] });
      setIsCreating(false);
      setSelectedAgent(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ClaudeAgent> }) =>
      api.updateAgent(id, updates),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['claude-agents'] });
      setSelectedAgent(updated);
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-agents'] });
      setSelectedAgent(null);
    },
  });

  const copyToWindowsMutation = useMutation({
    mutationFn: (id: string) => api.copyAgentToWindows(id),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: ['claude-agents'] });
      setSelectedAgent(newAgent);
    },
  });

  const copyToWslMutation = useMutation({
    mutationFn: (id: string) => api.copyAgentToWsl(id),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: ['claude-agents'] });
      setSelectedAgent(newAgent);
    },
  });

  // Filter agents by search query
  const filteredAgents = agents?.filter(agent => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query) ||
      agent.pluginName.toLowerCase().includes(query)
    );
  }) || [];

  // Group agents by plugin
  const agentsByPlugin = filteredAgents.reduce((acc, agent) => {
    if (!acc[agent.pluginName]) acc[agent.pluginName] = [];
    acc[agent.pluginName].push(agent);
    return acc;
  }, {} as Record<string, ClaudeAgent[]>);

  const handleCreateNew = () => {
    setSelectedAgent({
      id: '',
      name: '',
      description: '',
      content: '',
      filePath: '',
      pluginName: 'custom-agents',
      isCustom: true,
    } as ClaudeAgent);
    setIsCreating(true);
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Agent Definitions</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage Claude Code agent types and system prompts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={() => refetchAgents()} isFetching={isFetchingAgents} dataUpdatedAt={agentsUpdatedAt} />
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Agent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {isLoadingAgents ? (
            <div className="p-4 text-center text-slate-400">Loading agents...</div>
          ) : filteredAgents.length === 0 ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
              <Bot className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">
                {searchQuery ? 'No agents match your search' : 'No agents found'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {searchQuery ? 'Try a different search term' : 'Create a custom agent to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
              {Object.entries(agentsByPlugin).map(([pluginName, pluginAgents]) => (
                <div key={pluginName} className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-3 border-b border-slate-700 flex items-center gap-2">
                    <Package size={14} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">
                      {pluginName.includes('WSL') ? pluginName : `Windows - ${pluginName}`}
                    </span>
                    <span className="text-xs text-slate-500">({pluginAgents.length})</span>
                    {pluginName === 'custom-agents' && (
                      <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded ml-auto">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-700">
                    {pluginAgents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgent(agent);
                          setIsEditing(false);
                          setIsCreating(false);
                        }}
                        className={`w-full p-3 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 ${
                          selectedAgent?.id === agent.id ? 'bg-slate-700/50' : ''
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getAgentColor(agent.color) }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{agent.name}</div>
                          <div className="text-xs text-slate-400 truncate">{agent.description}</div>
                        </div>
                        <ChevronRight size={14} className="text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Detail / Editor */}
        <div className="lg:col-span-2">
          {selectedAgent ? (
            <AgentEditor
              agent={selectedAgent}
              isEditing={isEditing}
              isCreating={isCreating}
              onEdit={() => setIsEditing(true)}
              onCancel={() => {
                if (isCreating) {
                  setSelectedAgent(null);
                  setIsCreating(false);
                }
                setIsEditing(false);
              }}
              onSave={(updates) => {
                if (isCreating) {
                  createMutation.mutate(updates);
                } else {
                  updateMutation.mutate({ id: selectedAgent.id, updates });
                }
              }}
              onDelete={() => {
                if (selectedAgent.isCustom && !isCreating) {
                  deleteMutation.mutate(selectedAgent.id);
                }
              }}
              onCopyToWindows={() => copyToWindowsMutation.mutate(selectedAgent.id)}
              onCopyToWsl={() => copyToWslMutation.mutate(selectedAgent.id)}
              isSaving={createMutation.isPending || updateMutation.isPending}
              isDeleting={deleteMutation.isPending}
              isCopying={copyToWindowsMutation.isPending || copyToWslMutation.isPending}
            />
          ) : (
            <AgentPlaceholder />
          )}
        </div>
      </div>
    </div>
  );
}

function AgentPlaceholder() {
  const builtInAgents = [
    {
      icon: Search,
      name: 'Explore',
      color: 'text-blue-400',
      description: 'Fast codebase exploration - find files, search code, answer questions',
    },
    {
      icon: FileText,
      name: 'Plan',
      color: 'text-purple-400',
      description: 'Design implementation strategies with step-by-step plans',
    },
    {
      icon: Code,
      name: 'Bash',
      color: 'text-green-400',
      description: 'Command execution specialist for git, npm, docker tasks',
    },
    {
      icon: Wand2,
      name: 'general-purpose',
      color: 'text-cyan-400',
      description: 'Research complex questions, search code, execute multi-step tasks',
    },
    {
      icon: Hammer,
      name: 'Custom',
      color: 'text-yellow-400',
      description: 'Create your own agents with custom system prompts and tools',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <Bot className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">Select an agent to view details</p>
        <p className="text-sm text-slate-500 mt-2">
          or create a new custom agent
        </p>
      </div>

      <CollapsibleHelp title="About Claude Code Agents">
        <p className="text-slate-400 text-sm mb-4">
          Agents are specialized Claude Code configurations with custom system prompts,
          tool restrictions, and model preferences. They're defined as .md files in
          ~/.claude/commands/.
        </p>

        <h4 className="font-medium text-white mb-3">Built-in Agent Types</h4>
        <div className="grid gap-3">
          {builtInAgents.map((agent) => (
            <div key={agent.name} className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg">
              <agent.icon size={18} className={agent.color} />
              <div>
                <span className={`font-medium ${agent.color}`}>{agent.name}</span>
                <p className="text-xs text-slate-400 mt-0.5">{agent.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleHelp>
    </div>
  );
}

interface AgentEditorProps {
  agent: ClaudeAgent;
  isEditing: boolean;
  isCreating: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: Partial<ClaudeAgent>) => void;
  onDelete: () => void;
  onCopyToWindows: () => void;
  onCopyToWsl: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  isCopying: boolean;
}

function AgentEditor({ agent, isEditing, isCreating, onEdit, onCancel, onSave, onDelete, onCopyToWindows, onCopyToWsl, isSaving, isDeleting, isCopying }: AgentEditorProps) {
  const [formData, setFormData] = useState<Partial<ClaudeAgent>>({
    name: agent.name,
    description: agent.description,
    model: agent.model,
    color: agent.color,
    tools: agent.tools || [],
    content: agent.content,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const toggleTool = (tool: string) => {
    const tools = formData.tools || [];
    if (tools.includes(tool)) {
      setFormData({ ...formData, tools: tools.filter(t => t !== tool) });
    } else {
      setFormData({ ...formData, tools: [...tools, tool] });
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: getAgentColor(isEditing ? formData.color : agent.color) }}
          />
          <h3 className="font-semibold text-white">
            {isCreating ? 'Create New Agent' : agent.name}
          </h3>
          {!isCreating && !agent.isCustom && (
            <span className="text-xs bg-slate-600 px-2 py-0.5 rounded text-slate-300">
              Plugin Agent
            </span>
          )}
          {agent.isCustom && (
            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
              Custom
            </span>
          )}
          {!isCreating && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              agent.pluginName.includes('WSL')
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {agent.pluginName.includes('WSL') ? 'WSL' : 'Windows'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={onEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded text-sm transition-colors"
              >
                <Edit2 size={14} />
                Edit
              </button>
              {/* Copy between Windows/WSL buttons */}
              {!isCreating && agent.pluginName.includes('WSL') && (
                <button
                  onClick={onCopyToWindows}
                  disabled={isCopying}
                  className="flex items-center gap-1 px-3 py-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded text-sm transition-colors"
                  title="Copy this agent to Windows"
                >
                  <Monitor size={14} />
                  {isCopying ? 'Copying...' : 'Copy to Windows'}
                </button>
              )}
              {!isCreating && !agent.pluginName.includes('WSL') && (
                <button
                  onClick={onCopyToWsl}
                  disabled={isCopying}
                  className="flex items-center gap-1 px-3 py-1.5 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded text-sm transition-colors"
                  title="Copy this agent to WSL"
                >
                  <Terminal size={14} />
                  {isCopying ? 'Copying...' : 'Copy to WSL'}
                </button>
              )}
              {agent.isCustom && (
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded text-sm transition-colors"
                >
                  <Trash2 size={14} />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
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
                disabled={isSaving}
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
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="agent-name"
              required
            />
          ) : (
            <p className="text-white">{agent.name}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          {isEditing ? (
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="Use this agent when..."
            />
          ) : (
            <p className="text-slate-400">{agent.description || 'No description'}</p>
          )}
        </div>

        {/* Model & Color */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Model</label>
            {isEditing ? (
              <select
                value={formData.model || 'inherit'}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500"
              >
                {AGENT_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <p className="text-slate-400">{agent.model || 'inherit'}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Color</label>
            {isEditing ? (
              <div className="flex gap-2">
                {AGENT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: c })}
                    className={`w-8 h-8 rounded border-2 ${formData.color === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: getAgentColor(c) }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getAgentColor(agent.color) }}
                />
                <span className="text-slate-400">{agent.color || 'default'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tools */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Tools</label>
          {isEditing ? (
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TOOLS.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleTool(tool)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    formData.tools?.includes(tool)
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {agent.tools?.length ? (
                agent.tools.map((tool) => (
                  <span key={tool} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-sm">
                    {tool}
                  </span>
                ))
              ) : (
                <span className="text-slate-500">All tools (default)</span>
              )}
            </div>
          )}
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">System Prompt</label>
          {isEditing ? (
            <textarea
              value={formData.content || ''}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full h-64 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-y"
              placeholder="Enter the system prompt for this agent..."
            />
          ) : (
            <pre className="w-full h-64 overflow-auto p-3 bg-slate-900 border border-slate-700 rounded text-slate-300 font-mono text-sm whitespace-pre-wrap">
              {agent.content || 'No system prompt defined'}
            </pre>
          )}
        </div>

        {/* File Path (read-only) */}
        {!isCreating && agent.filePath && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">File Path</label>
            <p className="text-xs text-slate-500 font-mono truncate">{agent.filePath}</p>
          </div>
        )}

        {/* Warning for plugin agents */}
        {isEditing && !agent.isCustom && !isCreating && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
            Warning: This is a plugin agent. Changes may be overwritten when the plugin is updated.
          </div>
        )}
      </form>
    </div>
  );
}

function getAgentColor(color?: string): string {
  const colors: Record<string, string> = {
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    magenta: '#d946ef',
    red: '#ef4444',
    cyan: '#06b6d4',
  };
  return colors[color || 'cyan'] || colors.cyan;
}
