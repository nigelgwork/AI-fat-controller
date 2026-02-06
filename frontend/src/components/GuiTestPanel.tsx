import { useState, useEffect } from 'react';
import { api } from '@/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  FileText,
  Wand2,
  ChevronDown,
  ChevronRight,
  Monitor,
  MousePointer,
  Keyboard,
  Eye,
  Zap,
  Bot,
  Combine,
} from 'lucide-react';
import type { TestScenario, TestResult, TestExecutionMode } from '../types/gastown';

interface GuiTestPanelProps {
  className?: string;
}

const EXECUTION_MODES: { value: TestExecutionMode; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'hybrid', label: 'Hybrid', icon: <Combine size={14} />, description: 'MCP for actions, Claude for verification' },
  { value: 'mcp-direct', label: 'MCP Direct', icon: <Zap size={14} />, description: 'Fast execution via MCP server' },
  { value: 'claude-assisted', label: 'Claude Assisted', icon: <Bot size={14} />, description: 'Claude handles all steps' },
];

export default function GuiTestPanel({ className = '' }: GuiTestPanelProps) {
  const queryClient = useQueryClient();
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [testProgress, setTestProgress] = useState<{ stepIndex: number; totalSteps: number; status: string } | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorInput, setGeneratorInput] = useState('');
  const [generatorApp, setGeneratorApp] = useState('');
  const [executionMode, setExecutionMode] = useState<TestExecutionMode>('hybrid');
  const [showModeSelector, setShowModeSelector] = useState(false);

  // Fetch test scenarios
  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: ['gui-tests'],
    queryFn: () => api.listGuiTests() as Promise<TestScenario[]>,
  });

  // Fetch connected MCP servers
  const { data: connectedServers = [] } = useQuery({
    queryKey: ['mcp-connected'],
    queryFn: () => api.getConnectedMcpServers() as Promise<string[]>,
  });

  // Run test mutation
  const runTestMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      setRunningTest(scenarioId);
      setTestProgress(null);
      // Use the new runWithConfig API if available, otherwise fall back to standard
      if (api.runGuiTestWithConfig) {
        return api.runGuiTestWithConfig(scenarioId, {
          mode: executionMode,
          mcpServerName: connectedServers[0], // Use first connected server
          takeScreenshotsAfterSteps: true,
          stopOnFirstFailure: true,
        }) as Promise<TestResult>;
      }
      return api.runGuiTest(scenarioId) as Promise<TestResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gui-tests'] });
      setRunningTest(null);
      setTestProgress(null);
    },
    onError: () => {
      setRunningTest(null);
      setTestProgress(null);
    },
  });

  // Generate test mutation
  const generateTestMutation = useMutation({
    mutationFn: async ({ description, appName }: { description: string; appName?: string }) => {
      return api.generateGuiTest(description, appName) as Promise<TestScenario>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gui-tests'] });
      setShowGenerator(false);
      setGeneratorInput('');
      setGeneratorApp('');
    },
  });

  // Delete test mutation
  const deleteTestMutation = useMutation({
    mutationFn: (id: string) => api.deleteGuiTest(id) as Promise<boolean>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gui-tests'] }),
  });

  // Listen for test progress
  useEffect(() => {
    const unsubProgress = api.onGuiTestProgress?.((data) => {
      setTestProgress(data);
    });

    const unsubComplete = api.onGuiTestComplete?.(() => {
      setRunningTest(null);
      setTestProgress(null);
      queryClient.invalidateQueries({ queryKey: ['gui-tests'] });
    });

    return () => {
      unsubProgress?.();
      unsubComplete?.();
    };
  }, [queryClient]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'click':
        return <MousePointer size={14} />;
      case 'type':
        return <Keyboard size={14} />;
      case 'verify':
        return <Eye size={14} />;
      case 'app':
        return <Monitor size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-700 p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white">GUI Tests</h3>
          <span className="text-xs text-slate-400">({scenarios.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Execution Mode Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModeSelector(!showModeSelector)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            >
              {EXECUTION_MODES.find(m => m.value === executionMode)?.icon}
              <span className="text-slate-300">{EXECUTION_MODES.find(m => m.value === executionMode)?.label}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {showModeSelector && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10">
                {EXECUTION_MODES.map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      setExecutionMode(mode.value);
                      setShowModeSelector(false);
                    }}
                    className={`w-full flex items-start gap-3 p-3 text-left hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${
                      executionMode === mode.value ? 'bg-slate-700/50' : ''
                    }`}
                  >
                    <span className="text-cyan-400 mt-0.5">{mode.icon}</span>
                    <div>
                      <div className="font-medium text-white">{mode.label}</div>
                      <div className="text-xs text-slate-400">{mode.description}</div>
                    </div>
                    {executionMode === mode.value && (
                      <CheckCircle2 size={14} className="text-cyan-400 ml-auto mt-0.5" />
                    )}
                  </button>
                ))}
                {connectedServers.length === 0 && executionMode !== 'claude-assisted' && (
                  <div className="px-3 py-2 text-xs text-amber-400 border-t border-slate-700">
                    No MCP servers connected. Configure in Settings.
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowGenerator(!showGenerator)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 rounded text-sm font-medium transition-colors"
          >
            <Wand2 size={14} />
            Generate Test
          </button>
        </div>
      </div>

      {/* Test Generator */}
      {showGenerator && (
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          <p className="text-sm text-slate-300 mb-3">
            Describe what you want to test in natural language:
          </p>
          <textarea
            value={generatorInput}
            onChange={(e) => setGeneratorInput(e.target.value)}
            placeholder="e.g., Open Settings, enable dark mode, verify the background changes to dark"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500"
            rows={3}
          />
          <div className="flex items-center gap-3 mt-3">
            <input
              type="text"
              value={generatorApp}
              onChange={(e) => setGeneratorApp(e.target.value)}
              placeholder="Application name (optional)"
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => generateTestMutation.mutate({ description: generatorInput, appName: generatorApp || undefined })}
              disabled={!generatorInput.trim() || generateTestMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              {generateTestMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Test List */}
      <div className="divide-y divide-slate-700">
        {scenarios.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No GUI tests yet</p>
            <p className="text-sm mt-1">Generate a test using natural language above</p>
          </div>
        ) : (
          scenarios.map((scenario) => (
            <div key={scenario.id} className="p-4">
              {/* Scenario Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {expandedScenario === scenario.id ? (
                    <ChevronDown size={16} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                  )}
                  <div>
                    <h4 className="font-medium text-white">{scenario.name}</h4>
                    <p className="text-xs text-slate-400">
                      {scenario.steps.length} steps
                      {scenario.application && ` · ${scenario.application}`}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runTestMutation.mutate(scenario.id)}
                    disabled={runningTest !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
                  >
                    {runningTest === scenario.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    Run
                  </button>
                  <button
                    onClick={() => deleteTestMutation.mutate(scenario.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Progress indicator */}
              {runningTest === scenario.id && testProgress && (
                <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-cyan-400">{testProgress.status}</span>
                    <span className="text-xs text-slate-400">
                      Step {testProgress.stepIndex + 1} of {testProgress.totalSteps}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all"
                      style={{ width: `${((testProgress.stepIndex + 1) / testProgress.totalSteps) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Expanded Steps */}
              {expandedScenario === scenario.id && (
                <div className="mt-3 space-y-2">
                  {scenario.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 p-2 bg-slate-900/50 rounded-lg"
                    >
                      <div className="flex items-center justify-center w-6 h-6 bg-slate-700 rounded text-xs text-slate-300">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400">{getActionIcon(step.action)}</span>
                          <span className="text-xs text-slate-400 uppercase">{step.action}</span>
                        </div>
                        <p className="text-sm text-white mt-0.5">{step.description}</p>
                        {step.assertion && (
                          <p className="text-xs text-slate-400 mt-1">
                            Assert: {step.assertion.type} "{step.assertion.target}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
