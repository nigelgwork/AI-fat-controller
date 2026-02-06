import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit3,
  Send,
  X,
  Circle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput } from '../types/gastown';
import type { Project } from '../types/electron.d';
import ActiveSessions from '../components/ActiveSessions';

export default function Tasks() {
  const queryClient = useQueryClient();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
    refetchInterval: 10000,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.listProjects(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] });
      setIsAddingTask(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateTaskInput }) =>
      api.updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] });
      setEditingTask(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] });
      setDeleteConfirmId(null);
    },
  });

  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const sendToClaudeMutation = useMutation({
    mutationFn: (id: string) => {
      setSendingTaskId(id);
      setSendError(null);
      return api.sendTaskToClaude(id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] });
      setSendingTaskId(null);
      if (!result.success && result.error) {
        setSendError(result.error);
        // Auto-clear error after 5 seconds
        setTimeout(() => setSendError(null), 5000);
      }
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-stats'] });
      setSendingTaskId(null);
      setSendError(error instanceof Error ? error.message : 'Unknown error');
      setTimeout(() => setSendError(null), 5000);
    },
  });

  const filteredTasks = tasks?.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;
    return true;
  });

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'todo':
        return <Circle className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      case 'done':
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'todo':
        return 'bg-slate-500/20 text-slate-400';
      case 'in_progress':
        return 'bg-cyan-500/20 text-cyan-400';
      case 'done':
        return 'bg-green-500/20 text-green-400';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'low':
        return 'bg-slate-500/20 text-slate-400';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'high':
        return 'bg-red-500/20 text-red-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Tasks</h2>
        <button
          onClick={() => setIsAddingTask(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
            className="appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-8 text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-8 text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Projects</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Error Banner */}
      {sendError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{sendError}</span>
          </div>
          <button
            onClick={() => setSendError(null)}
            className="text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Claude Code Sessions */}
      <ActiveSessions showHistory={true} maxHistoryItems={3} />

      {isLoading ? (
        <div className="text-slate-400">Loading tasks...</div>
      ) : !filteredTasks?.length ? (
        <EmptyState hasAnyTasks={!!tasks?.length} onAddTask={() => setIsAddingTask(true)} />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                      {getStatusIcon(task.status)}
                      {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                  </div>

                  <h3 className="text-white font-medium mb-1">{task.title}</h3>

                  {task.description && (
                    <p className="text-slate-400 text-sm mb-2 line-clamp-2">{task.description}</p>
                  )}

                  {task.projectName && (
                    <p className="text-slate-500 text-xs">Project: {task.projectName}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendToClaudeMutation.mutate(task.id)}
                    disabled={sendToClaudeMutation.isPending || task.status === 'in_progress'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white text-sm rounded transition-colors"
                    title="Send to Claude Code"
                  >
                    {sendingTaskId === task.id || task.status === 'in_progress' ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        {task.status === 'in_progress' ? 'Running...' : 'Sending...'}
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Send to Claude
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setEditingTask(task)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(task.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {deleteConfirmId === task.id && (
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-end gap-3">
                  <span className="text-sm text-slate-400">Delete this task?</span>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(task.id)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Task Modal */}
      {isAddingTask && (
        <TaskModal
          title="Add New Task"
          projects={projects || []}
          onClose={() => setIsAddingTask(false)}
          onSave={(data) => createMutation.mutate({
            title: data.title,
            description: data.description || undefined,
            status: data.status,
            priority: data.priority,
            projectId: data.projectId || undefined,
            projectName: data.projectName || undefined,
          })}
          isSaving={createMutation.isPending}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskModal
          title="Edit Task"
          task={editingTask}
          projects={projects || []}
          onClose={() => setEditingTask(null)}
          onSave={(data) => updateMutation.mutate({
            id: editingTask.id,
            updates: {
              title: data.title,
              description: data.description || undefined,
              status: data.status,
              priority: data.priority,
              projectId: data.projectId || undefined,
              projectName: data.projectName || undefined,
            }
          })}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}

interface TaskFormData {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  projectName: string;
}

interface TaskModalProps {
  title: string;
  task?: Task;
  projects: Project[];
  onClose: () => void;
  onSave: (data: TaskFormData) => void;
  isSaving: boolean;
}

function TaskModal({ title, task, projects, onClose, onSave, isSaving }: TaskModalProps) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo' as TaskStatus,
    priority: task?.priority || 'medium' as TaskPriority,
    projectId: task?.projectId || '',
    projectName: task?.projectName || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const project = projects.find((p) => p.id === formData.projectId);
    onSave({
      ...formData,
      projectName: project?.name || '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              placeholder="Enter task title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Project (optional)</label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">None</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim() || isSaving}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  hasAnyTasks: boolean;
  onAddTask: () => void;
}

function EmptyState({ hasAnyTasks, onAddTask }: EmptyStateProps) {
  if (hasAnyTasks) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">No tasks match your filters</p>
        <p className="text-sm text-slate-500 mt-2">Try adjusting your status or project filter</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
      <CheckSquare className="w-12 h-12 text-slate-500 mx-auto mb-4" />
      <p className="text-slate-400 mb-4">No tasks yet</p>
      <p className="text-sm text-slate-500 mb-6">
        Create tasks to track your work and send them to Claude Code for AI-assisted completion.
      </p>
      <button
        onClick={onAddTask}
        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create Your First Task
      </button>
    </div>
  );
}
