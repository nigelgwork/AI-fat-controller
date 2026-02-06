import { useState, useEffect } from 'react';
import { Monitor, Terminal, Folder, Check, Loader2 } from 'lucide-react';
import { api } from '@/api';

interface SetupProps {
  onComplete: () => void;
}

interface ModeStatus {
  windows: { available: boolean; claudePath?: string; version?: string };
  wsl: { available: boolean; distro?: string; version?: string };
}

export default function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState(1);
  const [detecting, setDetecting] = useState(true);
  const [modeStatus, setModeStatus] = useState<ModeStatus | null>(null);
  const [selectedMode, setSelectedMode] = useState<'windows' | 'wsl'>('windows');
  const [gastownPath, setGastownPath] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Detect available modes
    api.detectModes().then((status) => {
      setModeStatus(status);
      // Auto-select based on availability
      if (status.windows.available) {
        setSelectedMode('windows');
      } else if (status.wsl.available) {
        setSelectedMode('wsl');
      }
      // Set default gastownPath
      setGastownPath('C:\\Users\\' + (process.env.USERNAME || 'user') + '\\gt');
      setDetecting(false);
    }).catch(() => {
      setDetecting(false);
    });
  }, []);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.setSetting('executionMode', selectedMode);
      await api.setSetting('defaultMode', selectedMode);
      await api.setSetting('gastownPath', gastownPath);
      await api.setSetting('hasCompletedSetup', true);
      onComplete();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-lg bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Welcome to AI Controller</h1>
            <span className="text-sm text-slate-400">Step {step}/3</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <p className="text-slate-300">Let's set up your environment.</p>

              {detecting ? (
                <div className="flex items-center gap-3 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Detecting Claude Code installation...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">Claude Code detected:</p>

                  <button
                    onClick={() => setSelectedMode('windows')}
                    disabled={!modeStatus?.windows.available}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                      selectedMode === 'windows'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-600 hover:border-slate-500'
                    } ${!modeStatus?.windows.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5 text-cyan-400" />
                      <div className="flex-1">
                        <div className="font-medium text-white">Windows</div>
                        {modeStatus?.windows.available ? (
                          <div className="text-sm text-green-400 flex items-center gap-1">
                            <Check size={12} />
                            {modeStatus.windows.version || 'Available'}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">Not detected</div>
                        )}
                      </div>
                      {selectedMode === 'windows' && (
                        <Check className="w-5 h-5 text-cyan-400" />
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedMode('wsl')}
                    disabled={!modeStatus?.wsl.available}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                      selectedMode === 'wsl'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-600 hover:border-slate-500'
                    } ${!modeStatus?.wsl.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Terminal className="w-5 h-5 text-cyan-400" />
                      <div className="flex-1">
                        <div className="font-medium text-white">WSL</div>
                        {modeStatus?.wsl.available ? (
                          <div className="text-sm text-green-400 flex items-center gap-1">
                            <Check size={12} />
                            {modeStatus.wsl.distro}: {modeStatus.wsl.version || 'Available'}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">Not detected</div>
                        )}
                      </div>
                      {selectedMode === 'wsl' && (
                        <Check className="w-5 h-5 text-cyan-400" />
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <p className="text-slate-300">Where is your Gas Town workspace?</p>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  <Folder size={14} className="inline mr-1" />
                  Workspace Path
                </label>
                <input
                  type="text"
                  value={gastownPath}
                  onChange={(e) => setGastownPath(e.target.value)}
                  placeholder="C:\Users\username\gt"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <p className="text-sm text-slate-500">
                This is where your rigs, beads, and convoys are stored.
                If you don't have one yet, we'll create it for you.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <p className="text-slate-300">Your AI Controller is configured!</p>

              <div className="bg-slate-900 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mode:</span>
                  <span className="text-white font-medium capitalize">{selectedMode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Workspace:</span>
                  <span className="text-white font-mono text-sm">{gastownPath}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Claude:</span>
                  <span className="text-green-400">
                    {selectedMode === 'windows'
                      ? modeStatus?.windows.version
                      : modeStatus?.wsl.version}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-500">
                You can change these settings anytime in Settings → Execution.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={detecting}
              className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Finish
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
