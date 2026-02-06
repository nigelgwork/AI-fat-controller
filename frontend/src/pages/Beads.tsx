import { useQuery } from '@tanstack/react-query';
import { Circle, ArrowRight } from 'lucide-react';
import { api } from '@/api';
import CollapsibleHelp from '../components/CollapsibleHelp';

interface Bead {
  id: string;
  title: string;
  status: string;
  priority?: string;
  created?: string;
}

export default function Beads() {
  const { data: beads, isLoading } = useQuery({
    queryKey: ['beads'],
    queryFn: () => api.listBeads() as Promise<Bead[]>,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Beads</h2>

      {isLoading ? (
        <div className="text-slate-400">Loading beads...</div>
      ) : !beads?.length ? (
        <EmptyState />
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">ID</th>
                <th className="text-left p-3 text-slate-400 font-medium">Title</th>
                <th className="text-left p-3 text-slate-400 font-medium">Status</th>
                <th className="text-left p-3 text-slate-400 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody>
              {beads.map((bead) => (
                <tr key={bead.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="p-3 text-slate-300 font-mono text-sm">{bead.id}</td>
                  <td className="p-3 text-white">{bead.title}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        bead.status === 'done'
                          ? 'bg-green-500/20 text-green-400'
                          : bead.status === 'active'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}
                    >
                      {bead.status || 'pending'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{bead.priority || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-6">
      {/* No beads message */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <Circle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">No beads found</p>
        <p className="text-sm text-slate-500 mt-2">
          Initialize beads with <code className="text-cyan-400">bd init</code> in your project
        </p>
      </div>

      {/* Collapsible help sections */}
      <CollapsibleHelp title="What are Beads?">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-cyan-500/20 rounded-lg">
            <Circle className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <p className="text-slate-400 mb-4">
              Beads are <strong className="text-white">atomic work items</strong> - like issues or tasks,
              but designed for AI agents. Each bead represents a single unit of work that Claude Code
              can pick up and complete autonomously.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Bug fixes</span>
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Features</span>
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Refactoring</span>
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Tests</span>
              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Docs</span>
            </div>
          </div>
        </div>
      </CollapsibleHelp>

      <CollapsibleHelp title="How Beads Work with Git">
        <div className="space-y-4 text-slate-400">
          <p>
            Beads are stored in a <code className="text-cyan-400 bg-slate-900 px-1 rounded">.beads/</code> folder
            inside your git repository. They're version-controlled just like your code.
          </p>
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
            <div className="text-slate-500">your-project/</div>
            <div className="text-slate-500">├── src/</div>
            <div className="text-slate-500">├── package.json</div>
            <div className="text-cyan-400">└── .beads/</div>
            <div className="text-cyan-400 pl-4">└── beads.jsonl  ← Work items stored here</div>
          </div>
        </div>
      </CollapsibleHelp>

      <CollapsibleHelp title="Getting Started">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <p className="text-white font-medium">Initialize beads in your existing repo</p>
              <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block mt-1">
                cd /path/to/your/project && bd init
              </code>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <p className="text-white font-medium">Add work items</p>
              <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block mt-1">
                bd add "Fix the login validation bug"
              </code>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">3</div>
            <div>
              <p className="text-white font-medium">Point AI Controller to your project</p>
              <p className="text-sm text-slate-400 mt-1">
                Go to <strong className="text-white">Settings</strong> and set the Gas Town path to your project folder
              </p>
            </div>
          </div>
        </div>
      </CollapsibleHelp>

      <CollapsibleHelp title="Using with Claude Code">
        <div className="space-y-3 text-slate-400">
          <p>Once you have beads, you can:</p>
          <ul className="space-y-2 ml-4">
            <li className="flex items-center gap-2">
              <ArrowRight size={14} className="text-cyan-400" />
              <span>Use the <strong className="text-white">Controller</strong> tab to ask Claude to work on beads</span>
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight size={14} className="text-cyan-400" />
              <span>Run <code className="text-cyan-400 bg-slate-900 px-1 rounded">bd ready</code> to see available work</span>
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight size={14} className="text-cyan-400" />
              <span>Claude Code can pick beads and create PRs automatically</span>
            </li>
          </ul>
        </div>
      </CollapsibleHelp>
    </div>
  );
}
