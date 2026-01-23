import { useState, useEffect } from 'react';
import { Download, X, RefreshCw } from 'lucide-react';

export default function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Listen for update events
    const unsubAvailable = window.electronAPI?.onUpdateAvailable(() => {
      setUpdateAvailable(true);
    });

    const unsubDownloaded = window.electronAPI?.onUpdateDownloaded(() => {
      setUpdateDownloaded(true);
      setUpdateAvailable(false);
    });

    return () => {
      unsubAvailable?.();
      unsubDownloaded?.();
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    try {
      await window.electronAPI?.checkForUpdates();
    } finally {
      setTimeout(() => setChecking(false), 2000);
    }
  };

  const handleInstallUpdate = () => {
    window.electronAPI?.installUpdate();
  };

  if (dismissed || (!updateAvailable && !updateDownloaded)) {
    return (
      <button
        onClick={handleCheckForUpdates}
        disabled={checking}
        className="text-slate-400 hover:text-white disabled:opacity-50 p-2"
        title="Check for updates"
      >
        <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg">
      <Download size={16} className="text-cyan-400" />
      {updateDownloaded ? (
        <>
          <span className="text-sm text-cyan-300">Update ready to install</span>
          <button
            onClick={handleInstallUpdate}
            className="text-xs bg-cyan-500 hover:bg-cyan-600 text-white px-3 py-1 rounded font-medium transition-colors"
          >
            Restart & Update
          </button>
        </>
      ) : (
        <span className="text-sm text-cyan-300">Downloading update...</span>
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
