import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { Boxes, Package, ArrowRight, GitPullRequest, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import CollapsibleHelp from '../components/CollapsibleHelp';
import { ConvoyList, type Convoy } from '../components/ConvoyProgress';

interface ConvoyApiResponse {
  convoys?: Array<{
    id: string;
    name: string;
    description?: string;
    beads?: Array<{
      id: string;
      title: string;
      status?: string;
    }>;
    created_at?: string;
    updated_at?: string;
  }>;
}

function parseConvoyResponse(data: unknown): Convoy[] {
  if (!data || typeof data !== 'object') return [];

  const response = data as ConvoyApiResponse;
  if (!response.convoys || !Array.isArray(response.convoys)) {
    // Maybe it's a flat array
    if (Array.isArray(data)) {
      return data.map((c) => ({
        id: c.id || String(Math.random()),
        name: c.name || 'Unnamed Convoy',
        description: c.description,
        beads: (c.beads || []).map((b: { id?: string; title?: string; status?: string }) => ({
          id: b.id || String(Math.random()),
          title: b.title || 'Untitled',
          status: (b.status || 'pending') as 'pending' | 'in_progress' | 'completed' | 'blocked',
        })),
        createdAt: c.created_at || new Date().toISOString(),
        updatedAt: c.updated_at,
      }));
    }
    return [];
  }

  return response.convoys.map((c) => ({
    id: c.id || String(Math.random()),
    name: c.name || 'Unnamed Convoy',
    description: c.description,
    beads: (c.beads || []).map((b) => ({
      id: b.id || String(Math.random()),
      title: b.title || 'Untitled',
      status: (b.status || 'pending') as 'pending' | 'in_progress' | 'completed' | 'blocked',
    })),
    createdAt: c.created_at || new Date().toISOString(),
    updatedAt: c.updated_at,
  }));
}

export default function Convoys() {
  const { data: result, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['convoys'],
    queryFn: async () => {
      const result = await api.executeGt(['convoy', 'list', '--json']);
      if (result?.success && result.response) {
        try {
          return JSON.parse(result.response);
        } catch {
          return null;
        }
      }
      return null;
    },
    refetchInterval: 10000,
  });

  const convoys = parseConvoyResponse(result);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Convoys</h2>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mr-2" />
          <span className="text-slate-400">Loading convoys...</span>
        </div>
      ) : convoys.length > 0 ? (
        <ConvoyList convoys={convoys} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-6">
      {/* No convoys message */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <Boxes className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">No convoys found</p>
        <p className="text-sm text-slate-500 mt-2">
          Create your first convoy with <code className="text-cyan-400">gt convoy create "name"</code>
        </p>
      </div>

      {/* Collapsible help sections */}
      <CollapsibleHelp title="What are Convoys?">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-cyan-500/20 rounded-lg">
            <Boxes className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <p className="text-slate-400 mb-4">
              Convoys are <strong className="text-white">groups of related beads</strong> that travel together.
              Think of them like a sprint, epic, or feature branch — a bundle of work items that belong together.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Feature rollouts</span>
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Sprint work</span>
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Refactoring batches</span>
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Migration tasks</span>
            </div>
          </div>
        </div>
      </CollapsibleHelp>

      <CollapsibleHelp title="Example Convoy">
        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-cyan-400" />
          "Dark Mode Feature" Convoy
        </h4>
        <div className="bg-slate-900 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-slate-300">Add theme context provider</span>
            <span className="text-xs text-green-400 ml-auto">Done</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-slate-300">Create dark color palette</span>
            <span className="text-xs text-green-400 ml-auto">Done</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock size={16} className="text-cyan-400" />
            <span className="text-slate-300">Update all components to use theme</span>
            <span className="text-xs text-cyan-400 ml-auto">In Progress</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock size={16} className="text-slate-500" />
            <span className="text-slate-500">Add theme toggle to settings</span>
            <span className="text-xs text-slate-500 ml-auto">Pending</span>
          </div>
        </div>
        <p className="text-sm text-slate-400 mt-4">
          All beads in a convoy are tracked together. When the convoy completes, you can ship the whole feature.
        </p>
      </CollapsibleHelp>

      <CollapsibleHelp title="Why Use Convoys?">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <ArrowRight size={16} className="text-cyan-400 mt-1" />
            <div>
              <span className="text-white font-medium">Track progress</span>
              <p className="text-sm text-slate-400">See how many beads are done vs pending</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ArrowRight size={16} className="text-cyan-400 mt-1" />
            <div>
              <span className="text-white font-medium">Coordinate agents</span>
              <p className="text-sm text-slate-400">Agents can prioritize convoy beads together</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ArrowRight size={16} className="text-cyan-400 mt-1" />
            <div>
              <span className="text-white font-medium">Ship together</span>
              <p className="text-sm text-slate-400">Deploy all related changes at once</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ArrowRight size={16} className="text-cyan-400 mt-1" />
            <div>
              <span className="text-white font-medium">Dependencies</span>
              <p className="text-sm text-slate-400">Beads in a convoy can have ordering</p>
            </div>
          </div>
        </div>
      </CollapsibleHelp>

      <CollapsibleHelp title="Getting Started">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <p className="text-white font-medium">Create a convoy</p>
              <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block mt-1">
                gt convoy create "dark-mode-feature"
              </code>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <p className="text-white font-medium">Add beads to the convoy</p>
              <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block mt-1">
                bd add "Add theme toggle" --convoy dark-mode-feature
              </code>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">3</div>
            <div>
              <p className="text-white font-medium">View convoy status</p>
              <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block mt-1">
                gt convoy status dark-mode-feature
              </code>
            </div>
          </div>
        </div>
      </CollapsibleHelp>

      <CollapsibleHelp title="Convoys and Pull Requests">
        <div className="flex items-start gap-3">
          <GitPullRequest className="w-5 h-5 text-cyan-400 mt-0.5" />
          <p className="text-slate-400">
            When agents complete beads, they create PRs. Convoys help you track which PRs belong together,
            making it easier to review and merge related changes. You can even configure agents to only merge
            when all convoy beads are complete.
          </p>
        </div>
      </CollapsibleHelp>
    </div>
  );
}
