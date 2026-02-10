import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '@/api';
import { Settings as SettingsIcon, Monitor, Terminal, RefreshCw, Download, Info, Cpu, Save, Bug, Bell, Send, Gauge, AlertTriangle, FileText } from 'lucide-react';
import type { NtfyConfig, UsageLimitConfig } from '@shared/types';
import MCPServerConfigPanel from '../components/MCPServerConfig';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getAllSettings(),
  });

  const { data: modeStatus, refetch: refetchStatus, isRefetching } = useQuery({
    queryKey: ['mode-status-settings'],
    queryFn: () => api.detectModes(),
  });

  const [defaultMode, setDefaultMode] = useState<'windows' | 'wsl' | 'auto'>('auto');
  const [logFilePath, setLogFilePath] = useState('');
  const [wslDistro, setWslDistro] = useState('');

  useEffect(() => {
    if (settings) {
      setDefaultMode(settings.defaultMode);
      setLogFilePath(settings.logFilePath || '');
      setWslDistro(settings.wsl?.distro || '');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(updates)) {
        await api.setSetting(key as never, value as never);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      defaultMode,
      logFilePath,
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
                <span className="text-sm">Claude Code</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${modeStatus?.linux?.available ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className={`text-sm ${modeStatus?.linux?.available ? 'text-green-400' : 'text-red-400'}`}>
                  {modeStatus?.linux?.available ? modeStatus.linux.version || modeStatus.linux.claudePath || 'Available' : 'Not found'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-slate-400" />
                <span className="text-sm">Environment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${modeStatus?.wsl?.detected ? 'bg-green-400' : 'bg-slate-500'}`} />
                <span className={`text-sm ${modeStatus?.wsl?.detected ? 'text-green-400' : 'text-slate-300'}`}>
                  {modeStatus?.wsl?.detected ? modeStatus.wsl.version || 'WSL' : 'Linux'}
                </span>
              </div>
            </div>
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

        {/* Log File Path Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <FileText size={18} className="text-emerald-400" />
            </div>
            <h3 className="font-semibold text-white">Log File Location</h3>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Log Directory</label>
            <input
              type="text"
              value={logFilePath}
              onChange={(e) => setLogFilePath(e.target.value)}
              placeholder="Leave empty to use default app data directory"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-xs text-slate-500 mt-2">Custom path for application logs (requires restart)</p>
          </div>
        </div>

        {/* ntfy Notifications Card - Full Width */}
        <div className="md:col-span-2">
          <NtfyCard />
        </div>

        {/* Usage Limits Card - Full Width */}
        <div className="md:col-span-2">
          <UsageLimitsCard />
        </div>

        {/* MCP Servers Card - Full Width */}
        <div className="md:col-span-2">
          <MCPServerConfigPanel />
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

function NtfyCard() {
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['ntfy-config'],
    queryFn: () => api.getNtfyConfig(),
  });

  const [localConfig, setLocalConfig] = useState<Partial<NtfyConfig>>({});

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<NtfyConfig>) => api.setNtfyConfig(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ntfy-config'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(localConfig);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // First save the config
      await api.setNtfyConfig(localConfig);
      // Then test
      const result = await api.testNtfyConnection();
      setTestResult(result || { success: false, error: 'Unknown error' });
    } catch (error) {
      setTestResult({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-pink-500/20 rounded-lg">
            <Bell size={18} className="text-pink-400" />
          </div>
          <h3 className="font-semibold text-white">ntfy Notifications</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing || !localConfig.enabled}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Send size={14} className={testing ? 'animate-pulse' : ''} />
            Test
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`mb-4 p-3 rounded-lg ${testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {testResult.success ? 'Test notification sent successfully!' : `Failed: ${testResult.error}`}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Enable/Disable */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-white">Enable ntfy</p>
              <p className="text-xs text-slate-400">Send notifications to your phone via ntfy</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={localConfig.enabled || false}
                onChange={(e) => setLocalConfig({ ...localConfig, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
            </div>
          </label>
        </div>

        {/* Desktop Notifications */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-white">Desktop Notifications</p>
              <p className="text-xs text-slate-400">Show local notifications when ntfy is disabled</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={localConfig.enableDesktopNotifications !== false}
                onChange={(e) => setLocalConfig({ ...localConfig, enableDesktopNotifications: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
            </div>
          </label>
        </div>

        {/* Server URL */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Server URL</label>
          <input
            type="text"
            value={localConfig.serverUrl || ''}
            onChange={(e) => setLocalConfig({ ...localConfig, serverUrl: e.target.value })}
            placeholder="https://ntfy.sh"
            disabled={!localConfig.enabled}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
        </div>

        {/* Topic */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Topic</label>
          <input
            type="text"
            value={localConfig.topic || ''}
            onChange={(e) => setLocalConfig({ ...localConfig, topic: e.target.value })}
            placeholder="phat-controller"
            disabled={!localConfig.enabled}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
          <p className="text-xs text-slate-500 mt-1">Subscribe to this topic in the ntfy app</p>
        </div>

        {/* Response Topic */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Response Topic (Optional)</label>
          <input
            type="text"
            value={localConfig.responseTopic || ''}
            onChange={(e) => setLocalConfig({ ...localConfig, responseTopic: e.target.value })}
            placeholder="phat-controller-response"
            disabled={!localConfig.enabled}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
          <p className="text-xs text-slate-500 mt-1">For interactive Q&A responses</p>
        </div>

        {/* Priority */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Default Priority</label>
          <select
            value={localConfig.priority || 'default'}
            onChange={(e) => setLocalConfig({ ...localConfig, priority: e.target.value as NtfyConfig['priority'] })}
            disabled={!localConfig.enabled}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          >
            <option value="min">Minimum</option>
            <option value="low">Low</option>
            <option value="default">Default</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Auth Token */}
        <div className="p-4 bg-slate-900 rounded-lg md:col-span-2">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Auth Token (Optional)</label>
          <input
            type="password"
            value={localConfig.authToken || ''}
            onChange={(e) => setLocalConfig({ ...localConfig, authToken: e.target.value })}
            placeholder="For password-protected topics"
            disabled={!localConfig.enabled}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
          <p className="text-xs text-slate-500 mt-1">Leave empty for public topics</p>
        </div>
      </div>

      {/* Commands & Automation Section */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <h4 className="text-sm font-medium text-white mb-4">Commands & Automation</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Enable Commands */}
          <div className="p-4 bg-slate-900 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white">Enable Remote Commands</p>
                <p className="text-xs text-slate-400">Allow /status, /pause, /resume etc. via ntfy</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localConfig.commandsEnabled !== false}
                  onChange={(e) => setLocalConfig({ ...localConfig, commandsEnabled: e.target.checked })}
                  disabled={!localConfig.enabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 disabled:opacity-50"></div>
              </div>
            </label>
          </div>

          {/* Auto-start on Task */}
          <div className="p-4 bg-slate-900 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white">Auto-Start on Task</p>
                <p className="text-xs text-slate-400">Start controller when new task is added</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localConfig.autoStartOnTask || false}
                  onChange={(e) => setLocalConfig({ ...localConfig, autoStartOnTask: e.target.checked })}
                  disabled={!localConfig.enabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 disabled:opacity-50"></div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Status Reporter Section */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <h4 className="text-sm font-medium text-white mb-4">Status Reporter</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Enable Status Reporter */}
          <div className="p-4 bg-slate-900 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white">Enable Status Reporter</p>
                <p className="text-xs text-slate-400">Periodic updates & event notifications</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localConfig.statusReporter?.enabled || false}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    statusReporter: { ...localConfig.statusReporter, enabled: e.target.checked } as NtfyConfig['statusReporter']
                  })}
                  disabled={!localConfig.enabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 disabled:opacity-50"></div>
              </div>
            </label>
          </div>

          {/* Status Interval */}
          <div className="p-4 bg-slate-900 rounded-lg">
            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Status Interval (minutes)</label>
            <input
              type="number"
              min={0}
              max={120}
              value={localConfig.statusReporter?.intervalMinutes || 0}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                statusReporter: { ...localConfig.statusReporter, intervalMinutes: parseInt(e.target.value) || 0 } as NtfyConfig['statusReporter']
              })}
              disabled={!localConfig.enabled || !localConfig.statusReporter?.enabled}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">0 to disable periodic updates</p>
          </div>

          {/* Daily Summary Time */}
          <div className="p-4 bg-slate-900 rounded-lg">
            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Daily Summary Time</label>
            <input
              type="time"
              value={localConfig.statusReporter?.dailySummaryTime || ''}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                statusReporter: { ...localConfig.statusReporter, dailySummaryTime: e.target.value || undefined } as NtfyConfig['statusReporter']
              })}
              disabled={!localConfig.enabled || !localConfig.statusReporter?.enabled}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">Leave empty to disable daily summary</p>
          </div>

          {/* Event Notifications */}
          <div className="p-4 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 mb-3 uppercase tracking-wide">Event Notifications</p>
            <div className="space-y-2">
              {[
                { key: 'notifyOnTaskComplete', label: 'Task Completed' },
                { key: 'notifyOnTaskFail', label: 'Task Failed' },
                { key: 'notifyOnApprovalNeeded', label: 'Approval Needed' },
                { key: 'notifyOnTokenWarning', label: 'Token Warning' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.statusReporter?.[key as keyof typeof localConfig.statusReporter] !== false}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      statusReporter: { ...localConfig.statusReporter, [key]: e.target.checked } as NtfyConfig['statusReporter']
                    })}
                    disabled={!localConfig.enabled || !localConfig.statusReporter?.enabled}
                    className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
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
    api.getVersion().then((v: any) => setVersion(typeof v === 'object' ? v.version : v));

    // Get initial status
    api.getUpdateStatus().then((s) => {
      if (s) setStatus(s);
    });

    // Subscribe to update events
    const unsubs = [
      api.onUpdateChecking(() => {
        setStatus(s => ({ ...s, checking: true, error: null }));
      }),
      api.onUpdateAvailable((data) => {
        setStatus(s => ({ ...s, checking: false, available: true, version: data.version }));
      }),
      api.onUpdateNotAvailable(() => {
        setStatus(s => ({ ...s, checking: false, available: false }));
      }),
      api.onUpdateProgress((data) => {
        setStatus(s => ({ ...s, downloading: true, progress: data.percent }));
      }),
      api.onUpdateDownloaded((data) => {
        setStatus(s => ({ ...s, downloading: false, downloaded: true, version: data.version, progress: 100 }));
      }),
      api.onUpdateError((data) => {
        setStatus(s => ({ ...s, checking: false, downloading: false, error: data.error }));
      }),
    ];

    return () => {
      unsubs.forEach(unsub => unsub?.());
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setStatus(s => ({ ...s, checking: true, error: null }));
    await api.checkForUpdates();
  };

  const handleInstallUpdate = () => {
    api.installUpdate();
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
  isDocker: boolean;
  nodeVersion: string;
  platform: string;
  claudePath: string;
  executionMode: 'linux';
}

function DebugCard() {
  const { data: debugInfo, isLoading, refetch } = useQuery({
    queryKey: ['debug-info'],
    queryFn: () => api.getDebugInfo() as Promise<DebugInfo>,
  });

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
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-900 rounded-lg">
              <p className="text-xs text-slate-400 uppercase mb-1">Platform</p>
              <p className="text-white">{debugInfo.platform}</p>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg">
              <p className="text-xs text-slate-400 uppercase mb-1">Node</p>
              <p className="text-white">{debugInfo.nodeVersion}</p>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg">
              <p className="text-xs text-slate-400 uppercase mb-1">Docker</p>
              <p className="text-white">{debugInfo.isDocker ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg">
            <p className="text-xs text-slate-400 uppercase mb-1">Claude Code CLI</p>
            <p className="text-white font-mono text-xs break-all">{debugInfo.claudePath}</p>
          </div>
        </div>
      ) : (
        <div className="text-slate-400">Failed to load debug info</div>
      )}
    </div>
  );
}

function UsageLimitsCard() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['usage-limit-config'],
    queryFn: () => api.getUsageLimitConfig(),
  });

  const { data: percentages } = useQuery({
    queryKey: ['usage-percentages'],
    queryFn: () => api.getUsagePercentages(),
  });

  const [localConfig, setLocalConfig] = useState<Partial<UsageLimitConfig>>({});

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<UsageLimitConfig>) => {
      await api.updateUsageLimitConfig(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage-limit-config'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(localConfig);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-24 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Gauge size={18} className="text-orange-400" />
          </div>
          <h3 className="font-semibold text-white">Token Usage Limits</h3>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
        >
          <Save size={14} />
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Current Usage Display */}
      {percentages && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-slate-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase">Hourly Usage</span>
              <span className={`text-sm font-medium ${
                percentages.hourly >= 80 ? 'text-red-400' :
                percentages.hourly >= 60 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {percentages.hourly}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  percentages.hourly >= 80 ? 'bg-red-500' :
                  percentages.hourly >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentages.hourly, 100)}%` }}
              />
            </div>
          </div>

          <div className="p-4 bg-slate-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase">Daily Usage</span>
              <span className={`text-sm font-medium ${
                percentages.daily >= 80 ? 'text-red-400' :
                percentages.daily >= 60 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {percentages.daily}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  percentages.daily >= 80 ? 'bg-red-500' :
                  percentages.daily >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentages.daily, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Max Tokens Per Hour */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Max Tokens/Hour</label>
          <input
            type="number"
            value={localConfig.maxTokensPerHour || 100000}
            onChange={(e) => setLocalConfig({ ...localConfig, maxTokensPerHour: parseInt(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <p className="text-xs text-slate-500 mt-1">{formatTokens(localConfig.maxTokensPerHour || 100000)}</p>
        </div>

        {/* Max Tokens Per Day */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Max Tokens/Day</label>
          <input
            type="number"
            value={localConfig.maxTokensPerDay || 500000}
            onChange={(e) => setLocalConfig({ ...localConfig, maxTokensPerDay: parseInt(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <p className="text-xs text-slate-500 mt-1">{formatTokens(localConfig.maxTokensPerDay || 500000)}</p>
        </div>

        {/* Warning Threshold */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Warning At (%)</label>
          <input
            type="number"
            min={10}
            max={90}
            value={Math.round((localConfig.warningThreshold || 0.6) * 100)}
            onChange={(e) => setLocalConfig({ ...localConfig, warningThreshold: parseInt(e.target.value) / 100 })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <p className="text-xs text-slate-500 mt-1">Show warning notification</p>
        </div>

        {/* Pause Threshold */}
        <div className="p-4 bg-slate-900 rounded-lg">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Pause At (%)</label>
          <input
            type="number"
            min={50}
            max={100}
            value={Math.round((localConfig.pauseThreshold || 0.8) * 100)}
            onChange={(e) => setLocalConfig({ ...localConfig, pauseThreshold: parseInt(e.target.value) / 100 })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <p className="text-xs text-slate-500 mt-1">Auto-pause controller</p>
        </div>
      </div>

      {/* Auto Resume Toggle */}
      <div className="mt-4 p-4 bg-slate-900 rounded-lg">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-yellow-400" />
            <div>
              <span className="text-white font-medium">Auto-Resume on Reset</span>
              <p className="text-xs text-slate-400 mt-0.5">Automatically resume when hourly limit resets</p>
            </div>
          </div>
          <div
            onClick={() => setLocalConfig({ ...localConfig, autoResumeOnReset: !localConfig.autoResumeOnReset })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              localConfig.autoResumeOnReset ? 'bg-cyan-500' : 'bg-slate-600'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                localConfig.autoResumeOnReset ? 'translate-x-5' : ''
              }`}
            />
          </div>
        </label>
      </div>
    </div>
  );
}
