import { useQuery } from '@tanstack/react-query';
import { Circle } from 'lucide-react';

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
    queryFn: () => window.electronAPI?.listBeads() as Promise<Bead[]>,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Beads</h2>

      {isLoading ? (
        <div className="text-slate-400">Loading beads...</div>
      ) : !beads?.length ? (
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
          <Circle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No beads found</p>
          <p className="text-sm text-slate-500 mt-2">
            Create beads with: bd add "title"
          </p>
        </div>
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
