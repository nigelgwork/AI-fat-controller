import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderGit,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  GitBranch,
  ExternalLink,
  FolderOpen,
  Check,
  Bot,
  FileText,
  Compass,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import CollapsibleHelp from '../components/CollapsibleHelp';
import type { ProjectBrief, DeepDivePlan } from '../types/gastown';

interface Project {
  id: string;
  name: string;
  path: string;
  hasBeads: boolean;
  hasClaude: boolean;
  lastModified?: string;
  gitRemote?: string;
  gitBranch?: string;
}

export default function Projects() {
  const queryClient = useQueryClient();
  const [showDiscover, setShowDiscover] = useState(false);

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => window.electronAPI?.listProjects() as Promise<Project[]>,
  });

  const { data: discovered, isLoading: isDiscovering, refetch: runDiscover } = useQuery({
    queryKey: ['discovered-projects'],
    queryFn: () => window.electronAPI?.discoverProjects() as Promise<Project[]>,
    enabled: showDiscover,
  });

  const addMutation = useMutation({
    mutationFn: (path: string) => window.electronAPI?.addProject(path) as Promise<Project>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-projects'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => window.electronAPI?.removeProject(id) as Promise<void>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleBrowse = async () => {
    const path = await window.electronAPI?.browseForProject();
    if (path) {
      addMutation.mutate(path);
    }
  };

  const handleDiscover = () => {
    setShowDiscover(true);
    runDiscover();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Projects</h2>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={handleDiscover}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            <Search size={16} />
            Discover Repos
          </button>
          <button
            onClick={handleBrowse}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Project
          </button>
          <Link
            to="/projects/new"
            className="flex items-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Sparkles size={16} />
            New Project
          </Link>
        </div>
      </div>

      {/* Current Projects */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <FolderGit size={18} className="text-cyan-400" />
            Your Projects
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading projects...</div>
        ) : !projects?.length ? (
          <div className="p-8 text-center">
            <FolderGit className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No projects added yet</p>
            <p className="text-sm text-slate-500">
              Click "Add Project" to add a git repo, or "Discover Repos" to find them automatically
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onRemove={() => removeMutation.mutate(project.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Discovered Repos */}
      {showDiscover && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Search size={18} className="text-cyan-400" />
              Discovered Git Repositories
              {isDiscovering && <RefreshCw size={14} className="animate-spin text-slate-400" />}
            </h3>
          </div>

          {isDiscovering ? (
            <div className="p-8 text-center text-slate-400">
              Scanning for git repositories...
            </div>
          ) : !discovered?.length ? (
            <div className="p-8 text-center text-slate-400">
              No additional git repositories found in common locations
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {discovered.map((project) => (
                <DiscoveredRow
                  key={project.path}
                  project={project}
                  onAdd={() => addMutation.mutate(project.path)}
                  isAdding={addMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help section */}
      <CollapsibleHelp title="How Projects Work">
        <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-400">
          <div>
            <p className="text-white font-medium mb-1">Track Multiple Repos</p>
            <p>Add any git repository to monitor its status, beads, and active Claude sessions.</p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">Auto-Discovery</p>
            <p>Click "Discover Repos" to scan common folders like ~/git, ~/projects, ~/code for git repos.</p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">Bead Integration</p>
            <p>Projects with a .beads folder show up in the Beads tab for work item tracking.</p>
          </div>
          <div>
            <p className="text-white font-medium mb-1">Session Linking</p>
            <p>Active Claude Code sessions are automatically linked to their project.</p>
          </div>
        </div>
      </CollapsibleHelp>
    </div>
  );
}

function ProjectRow({ project, onRemove }: { project: Project; onRemove: () => void }) {
  const queryClient = useQueryClient();
  const [showBrief, setShowBrief] = useState(false);
  const [showDeepDive, setShowDeepDive] = useState(false);

  const repoName = project.gitRemote
    ? project.gitRemote.replace(/.*[:/](.+\/.+?)(?:\.git)?$/, '$1')
    : null;

  // Fetch existing brief
  const { data: brief, isLoading: briefLoading } = useQuery({
    queryKey: ['project-brief', project.id],
    queryFn: () => window.electronAPI?.getProjectBrief(project.id) as Promise<ProjectBrief | null>,
    enabled: showBrief,
  });

  // Fetch existing deep dive plan
  const { data: deepDive, isLoading: deepDiveLoading } = useQuery({
    queryKey: ['deep-dive', project.id],
    queryFn: () => window.electronAPI?.getDeepDivePlan(project.id) as Promise<DeepDivePlan | null>,
    enabled: showDeepDive,
  });

  // Generate brief mutation
  const generateBriefMutation = useMutation({
    mutationFn: () => window.electronAPI!.generateProjectBrief(project.id, project.path, project.name) as Promise<ProjectBrief>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-brief', project.id] });
    },
  });

  // Generate deep dive mutation
  const generateDeepDiveMutation = useMutation({
    mutationFn: (focus: string | undefined = undefined) => window.electronAPI!.generateDeepDivePlan(project.id, project.path, project.name, focus) as Promise<DeepDivePlan>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deep-dive', project.id] });
    },
  });

  return (
    <div className="p-4 hover:bg-slate-700/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-white">{project.name}</span>
            {project.hasClaude && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                <Bot size={10} />
                CLAUDE.md
              </span>
            )}
            {project.hasBeads && (
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded">
                Has Beads
              </span>
            )}
            {project.gitBranch && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <GitBranch size={12} />
                {project.gitBranch}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 truncate">{project.path}</p>
          {repoName && (
            <a
              href={project.gitRemote?.replace(/^git@(.+):/, 'https://$1/')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1"
            >
              {repoName}
              <ExternalLink size={10} />
            </a>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setShowBrief(!showBrief)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                showBrief ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <FileText size={12} />
              Brief
              {showBrief ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <button
              onClick={() => setShowDeepDive(!showDeepDive)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                showDeepDive ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Compass size={12} />
              Deep Dive
              {showDeepDive ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
          title="Remove project"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Project Brief Section */}
      {showBrief && (
        <div className="mt-4 p-4 bg-slate-900 rounded-lg">
          {briefLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              Loading brief...
            </div>
          ) : brief ? (
            <ProjectBriefView brief={brief as ProjectBrief} onRegenerate={() => generateBriefMutation.mutate()} isRegenerating={generateBriefMutation.isPending} />
          ) : (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm mb-3">No brief generated yet</p>
              <button
                onClick={() => generateBriefMutation.mutate()}
                disabled={generateBriefMutation.isPending}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 text-white text-sm rounded-lg transition-colors"
              >
                {generateBriefMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generate Brief
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Deep Dive Section */}
      {showDeepDive && (
        <div className="mt-4 p-4 bg-slate-900 rounded-lg">
          {deepDiveLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              Loading plan...
            </div>
          ) : deepDive ? (
            <DeepDivePlanView plan={deepDive as DeepDivePlan} onRegenerate={() => generateDeepDiveMutation.mutate(undefined)} isRegenerating={generateDeepDiveMutation.isPending} />
          ) : (
            <div className="text-center py-4">
              <Compass className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm mb-3">No deep dive plan created yet</p>
              <button
                onClick={() => generateDeepDiveMutation.mutate(undefined)}
                disabled={generateDeepDiveMutation.isPending}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-700 text-white text-sm rounded-lg transition-colors"
              >
                {generateDeepDiveMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Planning...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Create Deep Dive Plan
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectBriefView({ brief, onRegenerate, isRegenerating }: { brief: ProjectBrief; onRegenerate: () => void; isRegenerating: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Project Brief</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            Generated {new Date(brief.createdAt).toLocaleDateString()}
          </span>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-50"
            title="Regenerate brief"
          >
            <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-300">{brief.summary}</p>

      <div className="flex flex-wrap gap-1">
        {brief.techStack.map((tech, i) => (
          <span key={i} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
            {tech}
          </span>
        ))}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
      >
        {expanded ? 'Show less' : 'Show more'}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-slate-700">
          <div>
            <h5 className="text-xs text-slate-400 uppercase mb-1">Architecture</h5>
            <p className="text-sm text-slate-300">{brief.architecture}</p>
          </div>

          {brief.keyFiles.length > 0 && (
            <div>
              <h5 className="text-xs text-slate-400 uppercase mb-1">Key Files</h5>
              <div className="space-y-1">
                {brief.keyFiles.slice(0, 5).map((file, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-cyan-400 font-mono">{file.path}</span>
                    <span className="text-slate-500 ml-2">- {file.purpose}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {brief.suggestedTasks.length > 0 && (
            <div>
              <h5 className="text-xs text-slate-400 uppercase mb-1">Suggested Tasks</h5>
              <div className="space-y-1">
                {brief.suggestedTasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      task.priority === 'high' ? 'bg-red-400' :
                      task.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                    }`} />
                    <span className="text-slate-300">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {brief.activeWork.length > 0 && (
            <div>
              <h5 className="text-xs text-slate-400 uppercase mb-1">TODOs Found</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {brief.activeWork.slice(0, 5).map((todo, i) => (
                  <div key={i} className="text-xs text-slate-400 font-mono truncate">
                    {todo}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeepDivePlanView({ plan, onRegenerate, isRegenerating }: { plan: DeepDivePlan; onRegenerate: () => void; isRegenerating: boolean }) {
  const queryClient = useQueryClient();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [addedTaskIds, setAddedTaskIds] = useState<Set<string>>(new Set());

  // Mutation to add a single task to project tasks
  const addTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return window.electronAPI!.convertDeepDiveTaskToProjectTask(plan.projectId, taskId);
    },
    onSuccess: (result, taskId) => {
      if (result.success) {
        setAddedTaskIds(prev => new Set(prev).add(taskId));
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['tasks-stats'] });
      }
    },
  });

  // Mutation to add all tasks to project tasks
  const addAllTasksMutation = useMutation({
    mutationFn: async () => {
      return window.electronAPI!.convertDeepDiveToTasks(plan.projectId);
    },
    onSuccess: (result) => {
      if (result.success) {
        // Mark all tasks as added
        const allTaskIds = plan.phases.flatMap(p => p.tasks.map(t => t.id));
        setAddedTaskIds(new Set(allTaskIds));
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['tasks-stats'] });
      }
    },
  });

  const pendingTasks = plan.phases.flatMap(p => p.tasks).filter(t => !addedTaskIds.has(t.id));
  const allTasksAdded = pendingTasks.length === 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Deep Dive Plan</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-50"
            title="Regenerate plan"
          >
            <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Add All Tasks Button */}
      <div className="flex items-center justify-between p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <div>
          <p className="text-sm text-purple-300">
            {allTasksAdded
              ? 'All tasks added to project'
              : `${pendingTasks.length} tasks ready to add`}
          </p>
          <p className="text-xs text-slate-400">
            Tasks will be added to your project task list
          </p>
        </div>
        <button
          onClick={() => addAllTasksMutation.mutate()}
          disabled={addAllTasksMutation.isPending || allTasksAdded}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 disabled:text-slate-400 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
        >
          {addAllTasksMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : allTasksAdded ? (
            <Check size={14} />
          ) : (
            <Plus size={14} />
          )}
          {allTasksAdded ? 'Added' : 'Add All to Tasks'}
        </button>
      </div>

      {/* Success message */}
      {addAllTasksMutation.isSuccess && addAllTasksMutation.data?.tasksCreated > 0 && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
          <Check size={16} className="text-green-400" />
          <span className="text-sm text-green-300">
            Added {addAllTasksMutation.data.tasksCreated} tasks to project. <a href="/tasks" className="underline hover:text-green-200">View Tasks →</a>
          </span>
        </div>
      )}

      {/* Phases */}
      <div className="space-y-3">
        {plan.phases.map((phase, phaseIdx) => (
          <div key={phase.id} className="border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-800 border-b border-slate-700">
              <h5 className="text-sm font-medium text-white">
                Phase {phaseIdx + 1}: {phase.name}
              </h5>
              <p className="text-xs text-slate-400">{phase.description}</p>
            </div>
            <div className="divide-y divide-slate-700">
              {phase.tasks.map((task) => {
                const isAdded = addedTaskIds.has(task.id);
                const isAdding = addTaskMutation.isPending && addTaskMutation.variables === task.id;

                return (
                  <div key={task.id} className="px-3 py-2 flex items-center gap-3">
                    {/* Add to Tasks button */}
                    <button
                      onClick={() => addTaskMutation.mutate(task.id)}
                      disabled={isAdded || isAdding}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                        isAdded
                          ? 'bg-green-500 text-white'
                          : 'border border-slate-500 hover:border-purple-400 hover:bg-purple-500/20 text-slate-500 hover:text-purple-400'
                      }`}
                      title={isAdded ? 'Added to tasks' : 'Add to project tasks'}
                    >
                      {isAdding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isAdded ? (
                        <Check size={12} />
                      ) : (
                        <Plus size={12} />
                      )}
                    </button>

                    {/* Task info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isAdded ? 'text-slate-500' : 'text-slate-300'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{task.description}</p>
                    </div>

                    {/* Complexity badge */}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      task.estimatedComplexity === 'high' ? 'bg-red-500/20 text-red-400' :
                      task.estimatedComplexity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {task.estimatedComplexity}
                    </span>

                    {/* Expand description */}
                    <button
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                      title="View details"
                    >
                      {expandedTaskId === task.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>
                );
              })}

              {/* Expanded task details */}
              {plan.phases.find(p => p.id === phase.id)?.tasks.map(task => (
                expandedTaskId === task.id && (
                  <div key={`${task.id}-expanded`} className="px-3 pb-3 bg-slate-800/50">
                    <div className="p-3 bg-slate-900 rounded text-xs">
                      <p className="text-slate-300 whitespace-pre-wrap">{task.description}</p>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscoveredRow({
  project,
  onAdd,
  isAdding,
}: {
  project: Project;
  onAdd: () => void;
  isAdding: boolean;
}) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAdd();
    setAdded(true);
  };

  return (
    <div className="p-4 hover:bg-slate-700/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <FolderOpen size={16} className="text-slate-400" />
            <span className="font-medium text-white">{project.name}</span>
            {project.hasClaude && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                <Bot size={10} />
                CLAUDE.md
              </span>
            )}
            {project.hasBeads && (
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded">
                Has Beads
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 truncate">{project.path}</p>
        </div>
        <button
          onClick={handleAdd}
          disabled={isAdding || added}
          className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            added
              ? 'bg-green-500/20 text-green-400'
              : 'bg-cyan-500 hover:bg-cyan-600 text-white'
          }`}
        >
          {added ? (
            <>
              <Check size={14} />
              Added
            </>
          ) : (
            <>
              <Plus size={14} />
              Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}
