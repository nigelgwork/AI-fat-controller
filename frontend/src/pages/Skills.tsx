import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import {
  Sparkles, Plus, Trash2, Edit2, Save, X, ChevronRight,
  Package, Search, Monitor, Terminal,
} from 'lucide-react';
import RefreshButton from '../components/RefreshButton';

interface ClaudeSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  filePath: string;
  sourceName: string;
  isCustom: boolean;
}

export default function Skills() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ClaudeSkill | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: skills, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['claude-skills'],
    queryFn: () => api.listSkills() as Promise<ClaudeSkill[]>,
  });

  const createMutation = useMutation({
    mutationFn: (skill: Partial<ClaudeSkill>) => api.createSkill(skill),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-skills'] });
      setIsCreating(false);
      setSelected(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ClaudeSkill> }) =>
      api.updateSkill(id, updates),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ['claude-skills'] });
      setSelected(updated);
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSkill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-skills'] });
      setSelected(null);
    },
  });

  const copyToWindowsMutation = useMutation({
    mutationFn: (id: string) => api.copySkillToWindows(id),
    onSuccess: (newSkill: any) => {
      queryClient.invalidateQueries({ queryKey: ['claude-skills'] });
      setSelected(newSkill);
    },
  });

  const copyToWslMutation = useMutation({
    mutationFn: (id: string) => api.copySkillToWsl(id),
    onSuccess: (newSkill: any) => {
      queryClient.invalidateQueries({ queryKey: ['claude-skills'] });
      setSelected(newSkill);
    },
  });

  const filtered = skills?.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.sourceName.toLowerCase().includes(q)
    );
  }) || [];

  // Group by source
  const bySource = filtered.reduce((acc, skill) => {
    if (!acc[skill.sourceName]) acc[skill.sourceName] = [];
    acc[skill.sourceName].push(skill);
    return acc;
  }, {} as Record<string, ClaudeSkill[]>);

  const handleCreateNew = () => {
    setSelected({
      id: '',
      name: '',
      description: '',
      content: '',
      filePath: '',
      sourceName: 'commands',
      isCustom: true,
    });
    setIsCreating(true);
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Skills</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage Claude Code slash commands and skills
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={() => refetch()} isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Skill
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Skill list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {isLoading ? (
            <div className="p-4 text-center text-slate-400">Loading skills...</div>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
              <Sparkles className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">
                {searchQuery ? 'No skills match your search' : 'No skills found'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Create a custom skill to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
              {Object.entries(bySource).map(([source, sourceSkills]) => (
                <div key={source} className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="p-3 border-b border-slate-700 flex items-center gap-2">
                    <Package size={14} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">{source}</span>
                    <span className="text-xs text-slate-500">({sourceSkills.length})</span>
                    {source === 'commands' && (
                      <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded ml-auto">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-700">
                    {sourceSkills.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => {
                          setSelected(skill);
                          setIsEditing(false);
                          setIsCreating(false);
                        }}
                        className={`w-full p-3 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 ${
                          selected?.id === skill.id ? 'bg-slate-700/50' : ''
                        }`}
                      >
                        <Sparkles size={14} className="text-yellow-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">/{skill.name}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {skill.description || 'No description'}
                          </div>
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

        {/* Skill detail / editor */}
        <div className="lg:col-span-2">
          {selected ? (
            <SkillEditor
              skill={selected}
              isEditing={isEditing}
              isCreating={isCreating}
              onEdit={() => setIsEditing(true)}
              onCancel={() => {
                if (isCreating) {
                  setSelected(null);
                  setIsCreating(false);
                }
                setIsEditing(false);
              }}
              onSave={(updates) => {
                if (isCreating) {
                  createMutation.mutate(updates);
                } else {
                  updateMutation.mutate({ id: selected.id, updates });
                }
              }}
              onDelete={() => {
                if (selected.isCustom && !isCreating) {
                  deleteMutation.mutate(selected.id);
                }
              }}
              onCopyToWindows={() => copyToWindowsMutation.mutate(selected.id)}
              onCopyToWsl={() => copyToWslMutation.mutate(selected.id)}
              isSaving={createMutation.isPending || updateMutation.isPending}
              isDeleting={deleteMutation.isPending}
              isCopying={copyToWindowsMutation.isPending || copyToWslMutation.isPending}
            />
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
              <Sparkles className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">Select a skill to view details</p>
              <p className="text-sm text-slate-500 mt-2">
                or create a new custom skill
              </p>
              <div className="mt-6 text-left max-w-md mx-auto space-y-3">
                <h4 className="font-medium text-white text-sm">About Skills</h4>
                <p className="text-slate-400 text-sm">
                  Skills are slash commands that provide specialized prompts to Claude Code.
                  They are defined as .md files in <code className="bg-slate-700 px-1 rounded">~/.claude/commands/</code> or in plugin directories.
                </p>
                <p className="text-slate-400 text-sm">
                  Use skills in Claude Code by typing <code className="bg-slate-700 px-1 rounded">/skill-name</code>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SkillEditorProps {
  skill: ClaudeSkill;
  isEditing: boolean;
  isCreating: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: Partial<ClaudeSkill>) => void;
  onDelete: () => void;
  onCopyToWindows: () => void;
  onCopyToWsl: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  isCopying: boolean;
}

function SkillEditor({
  skill, isEditing, isCreating, onEdit, onCancel, onSave, onDelete,
  onCopyToWindows, onCopyToWsl, isSaving, isDeleting, isCopying,
}: SkillEditorProps) {
  const [form, setForm] = useState<Partial<ClaudeSkill>>({
    name: skill.name,
    description: skill.description,
    content: skill.content,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-yellow-400" />
          <h3 className="font-semibold text-white">
            {isCreating ? 'Create New Skill' : `/${skill.name}`}
          </h3>
          {skill.isCustom && (
            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
              Custom
            </span>
          )}
          {!isCreating && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              skill.sourceName.includes('WSL') || skill.sourceName.includes('Windows')
                ? skill.sourceName.includes('WSL')
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-blue-500/20 text-blue-400'
                : 'bg-slate-600 text-slate-300'
            }`}>
              {skill.sourceName}
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
              {!isCreating && skill.sourceName.includes('WSL') && (
                <button
                  onClick={onCopyToWindows}
                  disabled={isCopying}
                  className="flex items-center gap-1 px-3 py-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded text-sm transition-colors"
                >
                  <Monitor size={14} />
                  {isCopying ? 'Copying...' : 'Copy to Windows'}
                </button>
              )}
              {!isCreating && !skill.sourceName.includes('WSL') && (
                <button
                  onClick={onCopyToWsl}
                  disabled={isCopying}
                  className="flex items-center gap-1 px-3 py-1.5 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded text-sm transition-colors"
                >
                  <Terminal size={14} />
                  {isCopying ? 'Copying...' : 'Copy to WSL'}
                </button>
              )}
              {skill.isCustom && (
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
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="my-skill"
              required
            />
          ) : (
            <p className="text-white">/{skill.name}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          {isEditing ? (
            <input
              type="text"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="What this skill does..."
            />
          ) : (
            <p className="text-slate-400">{skill.description || 'No description'}</p>
          )}
        </div>

        {/* Prompt Content */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Prompt</label>
          {isEditing ? (
            <textarea
              value={form.content || ''}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full h-64 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-y"
              placeholder="Enter the skill prompt..."
            />
          ) : (
            <pre className="w-full h-64 overflow-auto p-3 bg-slate-900 border border-slate-700 rounded text-slate-300 font-mono text-sm whitespace-pre-wrap">
              {skill.content || 'No prompt defined'}
            </pre>
          )}
        </div>

        {/* File Path */}
        {!isCreating && skill.filePath && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">File Path</label>
            <p className="text-xs text-slate-500 font-mono truncate">{skill.filePath}</p>
          </div>
        )}

        {/* Warning for plugin skills */}
        {isEditing && !skill.isCustom && !isCreating && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
            Warning: This is a plugin skill. Changes may be overwritten when the plugin is updated.
          </div>
        )}
      </form>
    </div>
  );
}
