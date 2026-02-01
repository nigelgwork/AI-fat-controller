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
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Play,
  Eye,
  Square,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import CollapsibleHelp from '../components/CollapsibleHelp';
import type { ProjectBrief, DeepDivePlan, DeepDiveTask } from '../types/gastown';

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
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [approvalPending, setApprovalPending] = useState<{ taskId: string; reason: string; output: string } | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);

  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (executingTaskId) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000));
      }, 1000);
    } else {
      startTimeRef.current = null;
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [executingTaskId]);

  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const executeMutation = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      setExecutingTaskId(taskId);
      const result = await window.electronAPI!.executeDeepDiveTask(plan.projectId, taskId);
      return { taskId, result };
    },
    onSuccess: ({ taskId, result }) => {
      setExecutingTaskId(null);
      if (result.requiresApproval) {
        setApprovalPending({
          taskId,
          reason: result.approvalReason || 'Approval required',
          output: result.output || '',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['deep-dive', plan.projectId] });
    },
    onError: () => {
      setExecutingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ['deep-dive', plan.projectId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      return window.electronAPI!.cancelDeepDiveTask(plan.projectId, taskId);
    },
    onSuccess: () => {
      setExecutingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ['deep-dive', plan.projectId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updates: { taskId: string; status: 'pending' | 'in_progress' | 'completed' | 'failed' }) =>
      window.electronAPI!.updateDeepDivePlan(plan.projectId, { taskUpdates: [updates] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deep-dive', plan.projectId] });
    },
  });

  const handleApprove = () => {
    if (approvalPending) {
      updateMutation.mutate({ taskId: approvalPending.taskId, status: 'completed' });
      setApprovalPending(null);
    }
  };

  const handleReject = () => {
    if (approvalPending) {
      updateMutation.mutate({ taskId: approvalPending.taskId, status: 'pending' });
      setApprovalPending(null);
    }
  };

  const progress = plan.totalTasks > 0 ? (plan.completedTasks / plan.totalTasks) * 100 : 0;

  const renderTaskButton = (task: DeepDiveTask) => {
    const isExecuting = executingTaskId === task.id;

    if (isExecuting) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border border-cyan-500 bg-cyan-500/20 flex items-center justify-center">
            <Loader2 size={12} className="text-cyan-400 animate-spin" />
          </div>
          <span className="text-xs text-cyan-400 font-mono">{formatElapsedTime(elapsedTime)}</span>
          <button
            onClick={() => cancelMutation.mutate({ taskId: task.id })}
            disabled={cancelMutation.isPending}
            className="w-5 h-5 rounded bg-red-500/20 border border-red-500 hover:bg-red-500/40 flex items-center justify-center transition-colors"
            title="Cancel execution"
          >
            <Square size={10} className="text-red-400" />
          </button>
        </div>
      );
    }

    switch (task.status) {
      case 'completed':
        return (
          <button
            onClick={() => updateMutation.mutate({ taskId: task.id, status: 'pending' })}
            disabled={updateMutation.isPending}
            className="w-5 h-5 rounded bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors group relative"
            title="Click to reset and re-run this task"
          >
            <Check size={12} className="text-white group-hover:hidden" />
            <RefreshCw size={10} className="text-white hidden group-hover:block" />
          </button>
        );
      case 'failed':
        return (
          <button
            onClick={() => executeMutation.mutate({ taskId: task.id })}
            disabled={executeMutation.isPending}
            className="w-5 h-5 rounded bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
            title={task.executionError || 'Task failed - click to retry'}
          >
            <X size={12} className="text-white" />
          </button>
        );
      case 'in_progress':
        // If no execution is currently running, this task is stuck - allow reset
        return (
          <button
            onClick={() => updateMutation.mutate({ taskId: task.id, status: 'pending' })}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 group"
            title="Task appears stuck - click to reset"
          >
            <div className="w-5 h-5 rounded border border-yellow-500 bg-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/40 transition-colors">
              <RefreshCw size={10} className="text-yellow-400" />
            </div>
            <span className="text-xs text-yellow-400">Stuck - click to reset</span>
          </button>
        );
      default: // pending
        return (
          <button
            onClick={() => executeMutation.mutate({ taskId: task.id })}
            disabled={executeMutation.isPending}
            className="w-5 h-5 rounded border border-slate-500 hover:border-cyan-400 hover:bg-cyan-500/20 flex items-center justify-center transition-colors group"
            title="Click to execute this task"
          >
            <Play size={10} className="text-slate-500 group-hover:text-cyan-400" />
          </button>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Approval Modal */}
      {approvalPending && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <h5 className="text-sm font-medium text-yellow-400">Approval Required</h5>
              <p className="text-xs text-slate-400 mt-1">{approvalPending.reason}</p>
              <div className="mt-2 p-2 bg-slate-800 rounded text-xs text-slate-300 max-h-32 overflow-y-auto font-mono">
                {approvalPending.output.substring(0, 500)}
                {approvalPending.output.length > 500 && '...'}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleApprove}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={handleReject}
                  className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Status Banner */}
      {executingTaskId && (
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="text-cyan-400 animate-spin" />
              <div>
                <span className="text-sm text-cyan-400 font-medium">Executing task...</span>
                <span className="text-xs text-slate-400 ml-2">
                  {plan.phases.flatMap(p => p.tasks).find(t => t.id === executingTaskId)?.title}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-cyan-400 font-mono">{formatElapsedTime(elapsedTime)}</span>
              <button
                onClick={() => cancelMutation.mutate({ taskId: executingTaskId })}
                disabled={cancelMutation.isPending}
                className="px-2 py-1 bg-red-500/20 border border-red-500 hover:bg-red-500/40 rounded text-xs text-red-400 transition-colors flex items-center gap-1"
              >
                <Square size={10} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Deep Dive Plan</h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs rounded ${
            plan.status === 'completed' ? 'bg-green-500/20 text-green-400' :
            plan.status === 'in_progress' ? 'bg-cyan-500/20 text-cyan-400' :
            plan.status === 'approved' ? 'bg-purple-500/20 text-purple-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            {plan.status}
          </span>
          {plan.completedTasks > 0 && (
            <button
              onClick={() => {
                // Reset all non-pending tasks back to pending
                plan.phases.forEach(phase => {
                  phase.tasks.forEach(task => {
                    if (task.status !== 'pending') {
                      updateMutation.mutate({ taskId: task.id, status: 'pending' });
                    }
                  });
                });
              }}
              disabled={updateMutation.isPending}
              className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
              title="Reset all tasks to pending"
            >
              Reset All
            </button>
          )}
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

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Progress</span>
          <span>{plan.completedTasks} / {plan.totalTasks} tasks</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

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
              {phase.tasks.map((task) => (
                <div key={task.id} className="group">
                  <div className="px-3 py-2 flex items-center gap-3">
                    {renderTaskButton(task)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${
                        task.status === 'completed' ? 'text-slate-500 line-through' :
                        task.status === 'failed' ? 'text-red-400' :
                        'text-slate-300'
                      }`}>
                        {task.title}
                      </p>
                      {task.status === 'failed' && task.executionError && (
                        <p className="text-xs text-red-400/70 mt-0.5 truncate" title={task.executionError}>
                          {task.executionError}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(task.executionOutput || task.executionError) && (
                        <button
                          onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          title="View execution output"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        task.estimatedComplexity === 'high' ? 'bg-red-500/20 text-red-400' :
                        task.estimatedComplexity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {task.estimatedComplexity}
                      </span>
                    </div>
                  </div>
                  {/* Expanded output view */}
                  {expandedTaskId === task.id && (task.executionOutput || task.executionError) && (
                    <div className="px-3 pb-3">
                      <div className="p-2 bg-slate-800 rounded text-xs font-mono max-h-48 overflow-y-auto">
                        {task.executionError ? (
                          <pre className="text-red-400 whitespace-pre-wrap">{task.executionError}</pre>
                        ) : (
                          <pre className="text-slate-300 whitespace-pre-wrap">{task.executionOutput}</pre>
                        )}
                      </div>
                      {task.executedAt && (
                        <p className="text-xs text-slate-500 mt-1">
                          Executed: {new Date(task.executedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
