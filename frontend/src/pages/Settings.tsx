import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Monitor, Terminal, Folder, RefreshCw } from 'lucide-react';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.electronAPI?.getAllSettings(),
  });

  const { data: modeStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['mode-status-settings'],
    queryFn: () => window.electronAPI?.detectModes(),
  });

  const [defaultMode, setDefaultMode] = useState<'windows' | 'wsl' | 'auto'>('auto');
  const [gastownPath, setGastownPath] = useState('');
  const [wslDistro, setWslDistro] = useState('');

  useEffect(() => {
    if (settings) {
      setDefaultMode(settings.defaultMode);
      setGastownPath(settings.gastownPath);
      setWslDistro(settings.wsl?.distro || '');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(updates)) {
        await window.electronAPI?.setSetting(key as never, value as never);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      defaultMode,
      gastownPath,
      'wsl.distro': wslDistro,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" />
        Settings
      </h2>

      {/* Execution Mode */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Execution Mode</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Default Mode</label>
            <div className="flex gap-2">
              {(['auto', 'windows', 'wsl'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDefaultMode(mode)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    defaultMode === mode
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {mode === 'auto' ? 'Auto-detect' : mode === 'windows' ? 'Windows' : 'WSL'}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="p-4 bg-slate-900 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Detection Status</span>
              <button
                onClick={() => refetchStatus()}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Monitor size={14} className="text-slate-400" />
                <span>Windows:</span>
                <span className={modeStatus?.windows?.available ? 'text-green-400' : 'text-red-400'}>
                  {modeStatus?.windows?.available ? 'Available' : 'Not found'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-slate-400" />
                <span>WSL:</span>
                <span className={modeStatus?.wsl?.available ? 'text-green-400' : 'text-red-400'}>
                  {modeStatus?.wsl?.available ? `${modeStatus.wsl.distro}` : 'Not found'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Paths */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Paths</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              <Folder size={14} className="inline mr-1" />
              Gas Town Workspace
            </label>
            <input
              type="text"
              value={gastownPath}
              onChange={(e) => setGastownPath(e.target.value)}
              placeholder="C:\Users\username\gt"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              <Terminal size={14} className="inline mr-1" />
              WSL Distro (optional)
            </label>
            <input
              type="text"
              value={wslDistro}
              onChange={(e) => setWslDistro(e.target.value)}
              placeholder="Ubuntu-22.04 (leave empty for default)"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
