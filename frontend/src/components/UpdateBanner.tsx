import { useState, useEffect } from 'react';
import { api, isElectron } from '@/api';
import { Download, X, RefreshCw } from 'lucide-react';

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  version: string | null;
}

export default function UpdateBanner() {
  if (!isElectron()) return null;

  return <UpdateBannerInner />;
}

function UpdateBannerInner() {
  const [status, setStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloaded: false,
    downloading: false,
    progress: 0,
    version: null,
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Get initial status
    api.getUpdateStatus?.().then((s) => {
      if (s) setStatus(s);
    });

    // Subscribe to update events
    const unsubs = [
      api.onUpdateChecking?.(() => {
        setStatus(s => ({ ...s, checking: true }));
      }),
      api.onUpdateAvailable?.((data) => {
        setStatus(s => ({ ...s, checking: false, available: true, version: data.version }));
        setDismissed(false);
      }),
      api.onUpdateNotAvailable?.(() => {
        setStatus(s => ({ ...s, checking: false }));
      }),
      api.onUpdateProgress?.((data) => {
        setStatus(s => ({ ...s, downloading: true, progress: data.percent }));
      }),
      api.onUpdateDownloaded?.((data) => {
        setStatus(s => ({ ...s, downloading: false, downloaded: true, version: data.version, progress: 100 }));
        setDismissed(false);
      }),
    ];

    return () => {
      unsubs.forEach(unsub => unsub?.());
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setStatus(s => ({ ...s, checking: true }));
    await api.checkForUpdates();
  };

  const handleInstallUpdate = () => {
    api.installUpdate();
  };

  // Show just a check button if no update activity
  if (dismissed || (!status.available && !status.downloaded && !status.downloading)) {
    return (
      <button
        onClick={handleCheckForUpdates}
        disabled={status.checking}
        className="text-slate-400 hover:text-white disabled:opacity-50 p-2"
        title="Check for updates"
      >
        <RefreshCw size={16} className={status.checking ? 'animate-spin' : ''} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg">
      <Download size={16} className="text-cyan-400" />

      {status.downloaded ? (
        <>
          <span className="text-sm text-cyan-300">
            v{status.version} ready
          </span>
          <button
            onClick={handleInstallUpdate}
            className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded font-medium transition-colors"
          >
            Restart & Update
          </button>
        </>
      ) : status.downloading ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-cyan-300">Downloading...</span>
          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${status.progress}%` }}
            />
          </div>
          <span className="text-xs text-cyan-400">{status.progress}%</span>
        </div>
      ) : (
        <span className="text-sm text-cyan-300">
          v{status.version} downloading...
        </span>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-white ml-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}
