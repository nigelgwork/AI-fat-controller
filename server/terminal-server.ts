import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import * as os from "os";

const PORT = parseInt(process.env.TERMINAL_PORT || "3001", 10);
const SHELL = process.env.SHELL || (os.platform() === "win32" ? "powershell.exe" : "bash");
const GASTOWN_PATH = process.env.GASTOWN_PATH || `${os.homedir()}/gt`;

interface TerminalSession {
  pty: pty.IPty;
  ws: WebSocket;
}

const sessions = new Map<string, TerminalSession>();

const wss = new WebSocketServer({ port: PORT });

console.log(`Terminal WebSocket server running on ws://localhost:${PORT}`);

wss.on("connection", (ws: WebSocket) => {
  const sessionId = Math.random().toString(36).substring(7);
  console.log(`New terminal session: ${sessionId}`);

  // Spawn a pseudo-terminal
  const ptyProcess = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: GASTOWN_PATH,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      GASTOWN_PATH,
      // Add bin directory to PATH
      PATH: `${process.cwd()}/bin:${process.env.PATH}`,
    },
  });

  sessions.set(sessionId, { pty: ptyProcess, ws });

  // Send terminal output to client
  ptyProcess.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "output", data }));
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`Terminal session ${sessionId} exited with code ${exitCode}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "exit", code: exitCode }));
    }
    sessions.delete(sessionId);
  });

  // Handle messages from client
  ws.on("message", (message: Buffer) => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.type) {
        case "input":
          ptyProcess.write(msg.data);
          break;

        case "resize":
          ptyProcess.resize(msg.cols, msg.rows);
          break;

        case "command":
          // Special commands
          if (msg.command === "gt-prime") {
            ptyProcess.write("gt prime\r");
          } else if (msg.command === "clear") {
            ptyProcess.write("clear\r");
          }
          break;
      }
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  });

  ws.on("close", () => {
    console.log(`Terminal session ${sessionId} closed`);
    ptyProcess.kill();
    sessions.delete(sessionId);
  });

  ws.on("error", (err) => {
    console.error(`Terminal session ${sessionId} error:`, err);
    ptyProcess.kill();
    sessions.delete(sessionId);
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      sessionId,
      message: `Connected to Gas Town Terminal. Working directory: ${GASTOWN_PATH}`,
    })
  );
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down terminal server...");
  sessions.forEach((session) => {
    session.pty.kill();
    session.ws.close();
  });
  wss.close();
  process.exit(0);
});
