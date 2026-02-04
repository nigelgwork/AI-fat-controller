/**
 * MCP Client for Windows Desktop Automation
 *
 * Connects to MCP servers (either Windows built-in or third-party like
 * mcp-windows-desktop-automation) to execute UI automation commands directly.
 *
 * Supports two transport modes:
 * - stdio: For locally spawned MCP servers
 * - websocket: For remote or pre-running MCP servers
 */

import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const log = createLogger('MCP');

// MCP Protocol Types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// MCP Tool Definition
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

// MCP Server Configuration
export interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'websocket';
  // For stdio transport
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // For websocket transport
  url?: string;
  // Common
  enabled: boolean;
  autoConnect: boolean;
}

// Windows MCP Tool Categories
export interface WindowsMCPTools {
  // Mouse operations
  mouseMove: (x: number, y: number) => Promise<void>;
  mouseClick: (button?: 'left' | 'right' | 'middle', clicks?: number) => Promise<void>;
  mouseDrag: (startX: number, startY: number, endX: number, endY: number) => Promise<void>;

  // Keyboard operations
  sendKeys: (keys: string) => Promise<void>;
  typeText: (text: string) => Promise<void>;
  pressKey: (key: string, modifiers?: string[]) => Promise<void>;

  // Window operations
  findWindow: (title: string, className?: string) => Promise<string | null>;
  activateWindow: (handle: string) => Promise<void>;
  closeWindow: (handle: string) => Promise<void>;
  resizeWindow: (handle: string, width: number, height: number) => Promise<void>;
  moveWindow: (handle: string, x: number, y: number) => Promise<void>;
  getWindowText: (handle: string) => Promise<string>;
  listWindows: () => Promise<Array<{ handle: string; title: string; className: string }>>;

  // Control operations
  findControl: (windowHandle: string, controlId: string) => Promise<string | null>;
  clickControl: (windowHandle: string, controlId: string) => Promise<void>;
  setControlText: (windowHandle: string, controlId: string, text: string) => Promise<void>;
  getControlText: (windowHandle: string, controlId: string) => Promise<string>;

  // Process operations
  launchApp: (path: string, args?: string[]) => Promise<number>;
  closeApp: (processId: number) => Promise<void>;
  isAppRunning: (processName: string) => Promise<boolean>;

  // Screenshot operations
  captureScreen: (region?: { x: number; y: number; width: number; height: number }) => Promise<Buffer>;
  captureWindow: (handle: string) => Promise<Buffer>;
}

export class MCPClient extends EventEmitter {
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number | string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private tools: MCPTool[] = [];
  private connected = false;
  private buffer = '';

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.config.transport === 'stdio') {
      await this.connectStdio();
    } else {
      await this.connectWebSocket();
    }

    // Initialize the connection
    await this.initialize();

    // Discover available tools
    await this.discoverTools();

    this.connected = true;
    this.emit('connected');
  }

  private async connectStdio(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.command) {
        reject(new Error('Command is required for stdio transport'));
        return;
      }

      this.process = spawn(this.config.command, this.config.args || [], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleStdioData(data);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        log.error(`[MCP ${this.config.name}] stderr:`, data.toString());
      });

      this.process.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.process.on('close', (code) => {
        this.connected = false;
        this.emit('disconnected', code);
      });

      // Give the process time to start
      setTimeout(resolve, 500);
    });
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.url) {
        reject(new Error('URL is required for websocket transport'));
        return;
      }

      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => {
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleWebSocketMessage(data);
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
      });
    });
  }

  private handleStdioData(data: Buffer): void {
    this.buffer += data.toString();

    // MCP uses newline-delimited JSON
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          log.error(`[MCP ${this.config.name}] Failed to parse message:`, line);
        }
      }
    }
  }

  private handleWebSocketMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    } catch (error) {
      log.error(`[MCP ${this.config.name}] Failed to parse WebSocket message`);
    }
  }

  private handleMessage(message: MCPResponse | MCPNotification): void {
    // Handle response to a request
    if ('id' in message && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }

    // Handle notifications
    if ('method' in message && !('id' in message)) {
      this.emit('notification', message);
    }
  }

  private send(message: MCPRequest | MCPNotification): void {
    const json = JSON.stringify(message) + '\n';

    if (this.config.transport === 'stdio' && this.process?.stdin) {
      this.process.stdin.write(json);
    } else if (this.config.transport === 'websocket' && this.ws) {
      this.ws.send(json);
    } else {
      throw new Error('Not connected');
    }
  }

  private async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.send({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });
    });
  }

  private async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
      },
      clientInfo: {
        name: 'AI-Controller',
        version: app.getVersion(),
      },
    });

    // Send initialized notification
    this.send({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
  }

  private async discoverTools(): Promise<void> {
    const result = await this.request('tools/list') as { tools: MCPTool[] };
    this.tools = result.tools || [];
    this.emit('tools-discovered', this.tools);
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const result = await this.request('tools/call', {
      name,
      arguments: args,
    });
    return result;
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;

    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.emit('disconnected');
  }
}

// Windows Desktop Automation MCP wrapper
export class WindowsAutomationMCP {
  private client: MCPClient;

  constructor(config: MCPServerConfig) {
    this.client = new MCPClient(config);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  getAvailableTools(): MCPTool[] {
    return this.client.getTools();
  }

  // High-level automation methods that map to Windows MCP tools

  async mouseMove(x: number, y: number): Promise<void> {
    await this.client.callTool('mouse_move', { x, y });
  }

  async mouseClick(button: 'left' | 'right' | 'middle' = 'left', clicks = 1): Promise<void> {
    await this.client.callTool('mouse_click', { button, clicks });
  }

  async mouseDrag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await this.client.callTool('mouse_drag', {
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY
    });
  }

  async sendKeys(keys: string): Promise<void> {
    await this.client.callTool('send_keys', { keys });
  }

  async typeText(text: string): Promise<void> {
    await this.client.callTool('send_text', { text });
  }

  async findWindow(title: string, className?: string): Promise<string | null> {
    const result = await this.client.callTool('win_find', {
      title,
      class: className
    }) as { handle: string } | null;
    return result?.handle || null;
  }

  async activateWindow(title: string): Promise<void> {
    await this.client.callTool('win_activate', { title });
  }

  async closeWindow(title: string): Promise<void> {
    await this.client.callTool('win_close', { title });
  }

  async waitForWindow(title: string, timeout = 10000): Promise<boolean> {
    const result = await this.client.callTool('win_wait', {
      title,
      timeout: timeout / 1000
    }) as boolean;
    return result;
  }

  async getWindowText(title: string): Promise<string> {
    const result = await this.client.callTool('win_get_text', { title }) as string;
    return result;
  }

  async listWindows(): Promise<Array<{ title: string; handle: string }>> {
    const result = await this.client.callTool('win_list') as Array<{ title: string; handle: string }>;
    return result || [];
  }

  async clickControl(title: string, control: string): Promise<void> {
    await this.client.callTool('control_click', { title, control });
  }

  async setControlText(title: string, control: string, text: string): Promise<void> {
    await this.client.callTool('control_set_text', { title, control, text });
  }

  async getControlText(title: string, control: string): Promise<string> {
    const result = await this.client.callTool('control_get_text', {
      title,
      control
    }) as string;
    return result;
  }

  async launchApp(path: string, workingDir?: string): Promise<number> {
    const result = await this.client.callTool('run', {
      path,
      workingdir: workingDir
    }) as { pid: number };
    return result.pid;
  }

  async isProcessRunning(process: string): Promise<boolean> {
    const result = await this.client.callTool('process_exists', {
      process
    }) as boolean;
    return result;
  }

  async closeProcess(process: string): Promise<void> {
    await this.client.callTool('process_close', { process });
  }

  async captureScreen(): Promise<string> {
    const result = await this.client.callTool('screenshot') as { path: string };
    return result.path;
  }

  async sleep(ms: number): Promise<void> {
    await this.client.callTool('sleep', { milliseconds: ms });
  }

  // Get clipboard content
  async getClipboard(): Promise<string> {
    const result = await this.client.callTool('clip_get') as string;
    return result;
  }

  // Set clipboard content
  async setClipboard(text: string): Promise<void> {
    await this.client.callTool('clip_put', { text });
  }
}

// MCP Server Manager - manages multiple MCP server connections
export class MCPServerManager {
  private servers = new Map<string, WindowsAutomationMCP>();
  private configs: MCPServerConfig[] = [];
  private configPath: string;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'mcp-servers.json');
    this.loadConfigs();
  }

  private loadConfigs(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        this.configs = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch (error) {
      log.error('Failed to load MCP server configs:', error);
      this.configs = [];
    }
  }

  private saveConfigs(): void {
    fs.writeFileSync(this.configPath, JSON.stringify(this.configs, null, 2));
  }

  getConfigs(): MCPServerConfig[] {
    return [...this.configs];
  }

  addConfig(config: MCPServerConfig): void {
    const existing = this.configs.findIndex(c => c.name === config.name);
    if (existing >= 0) {
      this.configs[existing] = config;
    } else {
      this.configs.push(config);
    }
    this.saveConfigs();
  }

  removeConfig(name: string): void {
    this.configs = this.configs.filter(c => c.name !== name);
    this.saveConfigs();

    // Disconnect if connected
    const server = this.servers.get(name);
    if (server) {
      server.disconnect();
      this.servers.delete(name);
    }
  }

  async connect(name: string): Promise<WindowsAutomationMCP> {
    const config = this.configs.find(c => c.name === name);
    if (!config) {
      throw new Error(`MCP server config not found: ${name}`);
    }

    let server = this.servers.get(name);
    if (server?.isConnected()) {
      return server;
    }

    server = new WindowsAutomationMCP(config);
    await server.connect();
    this.servers.set(name, server);

    return server;
  }

  async disconnect(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      await server.disconnect();
      this.servers.delete(name);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [name, server] of this.servers) {
      await server.disconnect();
    }
    this.servers.clear();
  }

  getServer(name: string): WindowsAutomationMCP | undefined {
    return this.servers.get(name);
  }

  getConnectedServers(): string[] {
    return Array.from(this.servers.entries())
      .filter(([_, server]) => server.isConnected())
      .map(([name]) => name);
  }

  async autoConnectEnabled(): Promise<void> {
    const toConnect = this.configs.filter(c => c.enabled && c.autoConnect);
    for (const config of toConnect) {
      try {
        await this.connect(config.name);
        log.info(`[MCP] Auto-connected to ${config.name}`);
      } catch (error) {
        log.error(`[MCP] Failed to auto-connect to ${config.name}:`, error);
      }
    }
  }
}

// Default configurations for common MCP servers
export const DEFAULT_MCP_CONFIGS: MCPServerConfig[] = [
  {
    name: 'windows-desktop-automation',
    transport: 'stdio',
    command: 'npx',
    args: ['mcp-windows-desktop-automation'],
    enabled: false,
    autoConnect: false,
  },
  {
    name: 'windows-desktop-automation-ws',
    transport: 'websocket',
    url: 'ws://localhost:3000',
    enabled: false,
    autoConnect: false,
  },
];

// Singleton instance
let mcpManager: MCPServerManager | null = null;

export function getMCPManager(): MCPServerManager {
  if (!mcpManager) {
    mcpManager = new MCPServerManager();
  }
  return mcpManager;
}
