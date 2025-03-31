import express, { Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from "./tools/index.js";
import { setupTabSocketHandlers } from "./tools/tabs.js";
import { tabManager } from "./services/tab-manager.js";
import bodyParser from "body-parser";

// Server configuration
const SERVER_NAME = "example-server";
const SERVER_VERSION = "1.0.0";

// Create Express app
const app = express();

// Apply middlewares - order matters!
app.use(cors());
// Add bodyParser for JSON but only for non-SSE routes
// We don't want to interfere with the SSE stream
const jsonParser = bodyParser.json({ limit: '5mb' });

// Create HTTP server and Socket.IO server
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Create MCP server
const mcpServer = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION
});

// Register all MCP tools
registerAllTools(mcpServer);

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

// SSE endpoint - DO NOT apply JSON bodyParser to this route
app.get("/sse", async (_: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await mcpServer.connect(transport);
});

// Messages endpoint - DO NOT apply JSON bodyParser to this route
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

// HTML content and screenshot endpoints - these DO use the JSON bodyParser
// Add a REST endpoint to update zone HTML content
app.post("/api/zones/:elementId/html", jsonParser, async (req: Request, res: Response) => {
  try {
    const { elementId } = req.params;
    const { html, socketId } = req.body;
    
    if (!elementId || !html) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing elementId or html in request' 
      });
    }
    
    // If socketId is provided, update HTML for that specific socket's zone
    if (socketId) {
      const updated = tabManager.updateZoneHtml(socketId, elementId, html);
      if (updated) {
        return res.json({ 
          success: true, 
          message: `Updated HTML for zone ${elementId}` 
        });
      } else {
        return res.status(404).json({ 
          success: false, 
          message: `Zone ${elementId} not found for socket ${socketId}` 
        });
      }
    } 
    
    // Otherwise, try to update any matching zone across all sockets
    const updated = tabManager.updateAnyZoneHtml(elementId, html);
    if (updated) {
      return res.json({ 
        success: true, 
        message: `Updated HTML for zone ${elementId}` 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: `Zone ${elementId} not found` 
      });
    }
  } catch (error) {
    console.error(`[SERVER] Error updating zone HTML:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error updating zone HTML'
    });
  }
});

// Add screenshot upload endpoint for future use
app.post("/api/zones/:elementId/screenshot", jsonParser, async (req: Request, res: Response) => {
  try {
    const { elementId } = req.params;
    const { screenshot, socketId } = req.body;
    
    // For now, just return success - we'll implement this later
    return res.json({ 
      success: true, 
      message: `Screenshot endpoint ready for future implementation` 
    });
  } catch (error) {
    console.error(`[SERVER] Error updating zone screenshot:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error updating zone screenshot'
    });
  }
});

// Add a graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  httpServer.close(() => {
    console.log('HTTP server closed')
  })
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server')
  httpServer.close(() => {
    console.log('HTTP server closed')
  })
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
  console.log(`MCP server "${SERVER_NAME}" (v${SERVER_VERSION}) is ready for connections`);
  console.log(`Socket.IO server is ready for WebSocket connections`);
});