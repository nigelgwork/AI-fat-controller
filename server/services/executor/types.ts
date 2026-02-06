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
  current: 'linux' | 'windows-interop';
  linux: {
    available: boolean;
    claudePath?: string;
    version?: string;
  };
  windowsInterop: {
    available: boolean;
    cmdPath?: string;
    version?: string;
  };
}

export interface SessionOptions {
  resumeSessionId?: string;
  continueSession?: boolean;
}

export interface ExecuteResultWithSession extends ExecuteResult {
  sessionId?: string;
}

export interface IExecutor {
  initialize(): Promise<void>;
  runClaude(message: string, systemPrompt?: string, projectPath?: string, imagePaths?: string[], executionId?: string, sessionOptions?: SessionOptions): Promise<ExecuteResultWithSession>;
  runGt(args: string[]): Promise<ExecuteResult>;
  runBd(args: string[]): Promise<ExecuteResult>;
}
