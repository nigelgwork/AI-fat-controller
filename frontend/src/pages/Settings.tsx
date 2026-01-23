import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Monitor, Terminal, Folder, RefreshCw, Download, Info, Cpu, Save, Bug, CheckCircle, XCircle } from 'lucide-react';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.electronAPI?.getAllSettings(),
  });

  const { data: modeStatus, refetch: refetchStatus, isRefetching } = useQuery({
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Settings
        </h2>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Save size={16} />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Execution Mode Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Cpu size={18} className="text-cyan-400" />
            </div>
            <h3 className="font-semibold text-white">Execution Mode</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Default Mode</label>
              <div className="flex gap-2">
                {(['auto', 'windows', 'wsl'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDefaultMode(mode)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      defaultMode === mode
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {mode === 'auto' ? 'Auto' : mode === 'windows' ? 'Windows' : 'WSL'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Detection Status Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <RefreshCw size={18} className={`text-green-400 ${isRefetching ? 'animate-spin' : ''}`} />
              </div>
              <h3 className="font-semibold text-white">Claude Detection</h3>
            </div>
            <button
              onClick={() => refetchStatus()}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 hover:bg-slate-700 rounded"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
              <div className="flex items-center gap-2">
                <Monitor size={16} className="text-slate-400" />
                <span className="text-sm">Windows</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${modeStatus?.windows?.available ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className={`text-sm ${modeStatus?.windows?.available ? 'text-green-400' : 'text-red-400'}`}>
                  {modeStatus?.windows?.available ? modeStatus.windows.version || 'Available' : 'Not found'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-slate-400" />
                <span className="text-sm">WSL</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${modeStatus?.wsl?.available ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className={`text-sm ${modeStatus?.wsl?.available ? 'text-green-400' : 'text-red-400'}`}>
                  {modeStatus?.wsl?.available ? modeStatus.wsl.distro : 'Not found'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gas Town Path Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Folder size={18} className="text-purple-400" />
            </div>
            <h3 className="font-semibold text-white">Workspace Path</h3>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Gas Town Directory</label>
            <input
              type="text"
              value={gastownPath}
              onChange={(e) => setGastownPath(e.target.value)}
              placeholder="C:\Users\username\gt"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-xs text-slate-500 mt-2">Where Gas Town stores projects and data</p>
          </div>
        </div>

        {/* WSL Config Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Terminal size={18} className="text-orange-400" />
            </div>
            <h3 className="font-semibold text-white">WSL Configuration</h3>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Distro Name</label>
            <input
              type="text"
              value={wslDistro}
              onChange={(e) => setWslDistro(e.target.value)}
              placeholder="Ubuntu-22.04"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-xs text-slate-500 mt-2">Leave empty to use default WSL distro</p>
          </div>
        </div>

        {/* About Card - Full Width */}
        <div className="md:col-span-2">
          <AboutCard />
        </div>

        {/* Debug Info Card - Full Width */}
        <div className="md:col-span-2">
          <DebugCard />
        </div>
      </div>
    </div>
  );
}

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  version: string | null;
  error: string | null;
}

function AboutCard() {
  const [version, setVersion] = useState<string>('');
  const [status, setStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloaded: false,
    downloading: false,
    progress: 0,
    version: null,
    error: null,
  });

  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersion);

    // Get initial status
    window.electronAPI?.getUpdateStatus?.().then((s) => {
      if (s) setStatus(s);
    });

    // Subscribe to update events
    const unsubs = [
      window.electronAPI?.onUpdateChecking?.(() => {
        setStatus(s => ({ ...s, checking: true, error: null }));
      }),
      window.electronAPI?.onUpdateAvailable?.((data) => {
        setStatus(s => ({ ...s, checking: false, available: true, version: data.version }));
      }),
      window.electronAPI?.onUpdateNotAvailable?.(() => {
        setStatus(s => ({ ...s, checking: false, available: false }));
      }),
      window.electronAPI?.onUpdateProgress?.((data) => {
        setStatus(s => ({ ...s, downloading: true, progress: data.percent }));
      }),
      window.electronAPI?.onUpdateDownloaded?.((data) => {
        setStatus(s => ({ ...s, downloading: false, downloaded: true, version: data.version, progress: 100 }));
      }),
      window.electronAPI?.onUpdateError?.((data) => {
        setStatus(s => ({ ...s, checking: false, downloading: false, error: data.error }));
      }),
    ];

    return () => {
      unsubs.forEach(unsub => unsub?.());
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setStatus(s => ({ ...s, checking: true, error: null }));
    await window.electronAPI?.checkForUpdates();
  };

  const handleInstallUpdate = () => {
    window.electronAPI?.installUpdate();
  };

  const getStatusText = () => {
    if (status.error) return `Error: ${status.error}`;
    if (status.downloaded) return `v${status.version} ready to install`;
    if (status.downloading) return `Downloading... ${status.progress}%`;
    if (status.available) return `v${status.version} available`;
    if (status.checking) return 'Checking...';
    return 'Up to date';
  };

  const getStatusColor = () => {
    if (status.error) return 'text-red-400';
    if (status.downloaded) return 'text-green-400';
    if (status.downloading || status.available) return 'text-cyan-400';
    return 'text-slate-300';
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Info size={18} className="text-blue-400" />
        </div>
        <h3 className="font-semibold text-white">About AI Controller</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Version Info */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Version</p>
          <p className="text-xl font-mono text-white">{version || '...'}</p>
        </div>

        {/* Update Status */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Status</p>
          <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
          {status.downloading && (
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-900 rounded-lg flex items-center justify-center gap-2">
          {status.downloaded ? (
            <button
              onClick={handleInstallUpdate}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={16} />
              Install & Restart
            </button>
          ) : (
            <button
              onClick={handleCheckForUpdates}
              disabled={status.checking || status.downloading}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={16} className={status.checking ? 'animate-spin' : ''} />
              {status.checking ? 'Checking...' : 'Check Updates'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface DebugInfo {
  isPackaged: boolean;
  resourcesPath: string;
  gtPath: string;
  gtExists: boolean;
  bdPath: string;
  bdExists: boolean;
  claudePath: string;
  gastownPath: string;
  gastownExists: boolean;
  executionMode: 'windows' | 'wsl';
}

function DebugCard() {
  const { data: debugInfo, isLoading, refetch } = useQuery({
    queryKey: ['debug-info'],
    queryFn: () => window.electronAPI?.getDebugInfo() as Promise<DebugInfo>,
  });

  const StatusIcon = ({ exists }: { exists: boolean }) => (
    exists
      ? <CheckCircle size={14} className="text-green-400" />
      : <XCircle size={14} className="text-red-400" />
  );

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Bug size={18} className="text-yellow-400" />
          </div>
          <h3 className="font-semibold text-white">Debug Info</h3>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-slate-400 hover:text-white px-2 py-1 hover:bg-slate-700 rounded"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400">Loading...</div>
      ) : debugInfo ? (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-900 rounded-lg">
              <p className="text-xs text-slate-400 uppercase mb-1">Packaged</p>
              <p className="text-white">{debugInfo.isPackaged ? 'Yes (Production)' : 'No (Development)'}</p>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg">
              <p className="text-xs text-slate-400 uppercase mb-1">Execution Mode</p>
              <p className="text-white capitalize">{debugInfo.executionMode}</p>
            </div>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 uppercase mb-1">Claude Code CLI</p>
            <p className="text-white font-mono text-xs break-all">{debugInfo.claudePath}</p>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon exists={debugInfo.gtExists} />
              <p className="text-xs text-slate-400 uppercase">Gas Town CLI (gt)</p>
            </div>
            <p className="text-white font-mono text-xs break-all">{debugInfo.gtPath}</p>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon exists={debugInfo.bdExists} />
              <p className="text-xs text-slate-400 uppercase">Beads CLI (bd)</p>
            </div>
            <p className="text-white font-mono text-xs break-all">{debugInfo.bdPath}</p>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon exists={debugInfo.gastownExists} />
              <p className="text-xs text-slate-400 uppercase">Gas Town Workspace</p>
            </div>
            <p className="text-white font-mono text-xs break-all">{debugInfo.gastownPath}</p>
          </div>
        </div>
      ) : (
        <div className="text-slate-400">Failed to load debug info</div>
      )}
    </div>
  );
}
