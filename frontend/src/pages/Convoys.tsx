import { useQuery } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';

export default function Convoys() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['convoys'],
    queryFn: async () => {
      const result = await window.electronAPI?.executeGt(['convoy', 'list', '--json']);
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Convoys</h2>

      {isLoading ? (
        <div className="text-slate-400">Loading convoys...</div>
      ) : !result ? (
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
          <Boxes className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No convoys found</p>
          <p className="text-sm text-slate-500 mt-2">
            Create convoys with: gt convoy create "name"
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <pre className="text-sm text-slate-300 whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
