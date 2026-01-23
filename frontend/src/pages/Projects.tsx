import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderGit,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  GitBranch,
  Circle,
  ExternalLink,
  FolderOpen,
  Check,
} from 'lucide-react';
import { useState } from 'react';

interface Project {
  id: string;
  name: string;
  path: string;
  hasBeads: boolean;
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
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="font-semibold text-white mb-3">How Projects Work</h3>
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
      </div>
    </div>
  );
}

function ProjectRow({ project, onRemove }: { project: Project; onRemove: () => void }) {
  const repoName = project.gitRemote
    ? project.gitRemote.replace(/.*[:/](.+\/.+?)(?:\.git)?$/, '$1')
    : null;

  return (
    <div className="p-4 hover:bg-slate-700/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white">{project.name}</span>
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
        </div>
        <button
          onClick={onRemove}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
          title="Remove project"
        >
          <Trash2 size={16} />
        </button>
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
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen size={16} className="text-slate-400" />
            <span className="font-medium text-white">{project.name}</span>
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
