import express, { Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from "./tools/index.js";
import { setupTabSocketHandlers } from "./tools/tabs.js";
import { tabManager } from "./services/tab-manager.js";

// Server configuration
const SERVER_NAME = "example-server";
const SERVER_VERSION = "1.0.0";

// Create MCP server
const mcpServer = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION
});

// Register all MCP tools
registerAllTools(mcpServer);

// Create Express app
const app = express();
app.use(cors());

// Create HTTP server and Socket.IO server
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handler
io.on("connection", (socket: Socket) => {
  console.log(`[SERVER] Socket.IO client connected: ${socket.id}`);
  
  // Register the socket with the tab manager
  tabManager.registerSocket(socket.id, socket);
  
  // Set up tab-related socket handlers
  setupTabSocketHandlers(socket);
  
  // Log when the socket disconnects
  socket.on("disconnect", (reason) => {
    console.log(`[SERVER] Client ${socket.id} disconnected: ${reason}`);
  });
});

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: {[sessionId: string]: SSEServerTransport} = {};

// Export the io instance for use in tools
export { io };

app.get("/sse", async (_: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await mcpServer.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

// Add status endpoint for browser extension health check
app.get("/status", (_, res: Response) => {
  res.json({ 
    status: "ok", 
    version: SERVER_VERSION,
    serverName: SERVER_NAME
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
  console.log(`MCP server "${SERVER_NAME}" (v${SERVER_VERSION}) is ready for connections`);
  console.log(`Socket.IO server is ready for WebSocket connections`);
});