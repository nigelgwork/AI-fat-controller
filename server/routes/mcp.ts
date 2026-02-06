import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { getMCPManager, DEFAULT_MCP_CONFIGS } from '../services/mcp-client';

const router: Router = Router();

// GET /configs - getMCPManager().getConfigs()
router.get('/configs', asyncHandler(async (req, res) => {
  const manager = getMCPManager();
  const configs = manager.getConfigs();
  res.json(configs);
}));

// GET /configs/defaults - DEFAULT_MCP_CONFIGS
router.get('/configs/defaults', asyncHandler(async (req, res) => {
  res.json(DEFAULT_MCP_CONFIGS);
}));

// POST /configs - addConfig
router.post('/configs', asyncHandler(async (req, res) => {
  const manager = getMCPManager();
  const config = req.body;
  manager.addConfig(config);
  const configs = manager.getConfigs();
  res.json(configs);
}));

// DELETE /configs/:name - removeConfig
router.delete('/configs/:name', asyncHandler(async (req, res) => {
  const name = req.params.name as string;
  const manager = getMCPManager();
  manager.removeConfig(name);
  const configs = manager.getConfigs();
  res.json(configs);
}));

// POST /connect/:name - connect to MCP server
router.post('/connect/:name', asyncHandler(async (req, res) => {
  const name = req.params.name as string;
  const manager = getMCPManager();
  await manager.connect(name);
  const server = manager.getServer(name);
  res.json({
    connected: server?.isConnected() || false,
    tools: server?.getAvailableTools() || [],
  });
}));

// POST /disconnect/:name - disconnect MCP server
router.post('/disconnect/:name', asyncHandler(async (req, res) => {
  const name = req.params.name as string;
  const manager = getMCPManager();
  await manager.disconnect(name);
  res.json(true);
}));

// POST /disconnect-all - disconnect all MCP servers
router.post('/disconnect-all', asyncHandler(async (req, res) => {
  const manager = getMCPManager();
  await manager.disconnectAll();
  res.json(true);
}));

// GET /connected - getConnectedServers
router.get('/connected', asyncHandler(async (req, res) => {
  const manager = getMCPManager();
  const servers = manager.getConnectedServers();
  res.json(servers);
}));

// GET /tools/:name - getServerTools
router.get('/tools/:name', asyncHandler(async (req, res) => {
  const name = req.params.name as string;
  const manager = getMCPManager();
  const server = manager.getServer(name);
  const tools = server?.getAvailableTools() || [];
  res.json(tools);
}));

// POST /tools/:serverName/:toolName - callTool
router.post('/tools/:serverName/:toolName', asyncHandler(async (req, res) => {
  const serverName = req.params.serverName as string;
  const toolName = req.params.toolName as string;
  const args = req.body || {};
  const manager = getMCPManager();
  const server = manager.getServer(serverName);
  if (!server?.isConnected()) {
    res.status(400).json({ error: `MCP server not connected: ${serverName}` });
    return;
  }
  // Access the underlying client to call tools
  interface MCPServerWithClient {
    client: {
      callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    };
  }
  const result = await (server as unknown as MCPServerWithClient).client.callTool(toolName, args);
  res.json(result);
}));

// POST /auto-connect - autoConnectEnabled
router.post('/auto-connect', asyncHandler(async (req, res) => {
  const manager = getMCPManager();
  await manager.autoConnectEnabled();
  const servers = manager.getConnectedServers();
  res.json(servers);
}));

export default router;
