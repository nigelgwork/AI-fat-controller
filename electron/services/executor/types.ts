import { ChildProcess } from 'child_process';

export interface TokenUsageData {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface ExecuteResult {
  success: boolean;
  response?: string;
  error?: string;
  duration: number;
  tokenUsage?: TokenUsageData;
  costUsd?: number;
}

export interface ModeStatus {
  current: 'windows' | 'wsl';
  windows: {
    available: boolean;
    claudePath?: string;
    version?: string;
  };
  wsl: {
    available: boolean;
    distro?: string;
    version?: string;
  };
}

export interface IExecutor {
  initialize(): Promise<void>;
  runCommand(command: string, args: string[], cwd?: string, executionId?: string): Promise<ExecuteResult>;
  runClaude(prompt: string, systemPrompt?: string, cwd?: string, executionId?: string): Promise<ExecuteResult>;
  runBash(command: string, cwd?: string, executionId?: string): Promise<ExecuteResult>;
}

export interface DebugInfo {
  isPackaged: boolean;
  resourcesPath: string;
  gtPath: string;
  gtExists: boolean;
  bdPath: string;
  bdExists: boolean;
  claudePath: string;
  gastownPath: string;
  executionMode: string;
  wslDistro?: string;
}

// Process tracking map - shared across executors
export const runningProcesses = new Map<string, ChildProcess>();
