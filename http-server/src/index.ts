import express, { Request, Response } from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from "./tools/index.js";
import { setupTabSocketHandlers } from "./tools/tabs.js";
import { tabManager } from "./services/tab-manager.js";
import bodyParser from "body-parser";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Server configuration
const SERVER_NAME = "example-server";
const SERVER_VERSION = "1.0.0";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create upload directory for screenshots if it doesn't exist
const screenshotsDir = path.join(__dirname, '..', 'uploads', 'screenshots');
fs.mkdirSync(screenshotsDir, { recursive: true });
console.log(`[SERVER] Screenshots directory created at: ${screenshotsDir}`);

// Create Express app
const app = express();

// Apply CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Create HTTP server and Socket.IO server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize the McpServer and register tools
const mcp = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION
});
registerAllTools(mcp);

// Socket.IO connection handler
io.on("connection", (socket: Socket) => {
  console.log(`[SERVER] Socket.IO client connected: ${socket.id}`);
  
  // Register the socket with the tab manager
  tabManager.registerSocket(socket.id, socket);
  
  // Set up tab-related socket handlers
  setupTabSocketHandlers(socket);
  
  // Listen for socket disconnection
  socket.on("disconnect", (reason: string) => {
    console.log(`[SERVER] Client ${socket.id} disconnected: ${reason}`);
  });
});

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: {[sessionId: string]: SSEServerTransport} = {};

// Export the io instance for use in tools
export { io };

// SSE endpoint for MCP - must be defined BEFORE any body parsers
app.get("/sse", async (_: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await mcp.connect(transport);
});

// MCP messages endpoint - must be defined BEFORE any body parsers
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

// Define JSON parsers for REST API routes - apply AFTER SSE routes
const jsonParser = bodyParser.json({ limit: '5mb' });
const largeJsonParser = express.json({ limit: '50mb' });
const urlencodedParser = express.urlencoded({ limit: '50mb', extended: true });

// Add status endpoint for browser extension health check
app.get("/status", (_, res: Response) => {
  res.json({ 
    status: "ok", 
    version: SERVER_VERSION,
    serverName: SERVER_NAME
  });
});

// HTML content and screenshot endpoints - these use the JSON bodyParser
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

// Add screenshot upload endpoint 
app.post("/api/zones/:elementId/screenshot", largeJsonParser, async (req: Request, res: Response) => {
  try {
    const { elementId } = req.params;
    const { screenshot, socketId } = req.body;
    
    if (!elementId || !screenshot) {
      return res.status(400).json({
        success: false,
        message: 'Missing elementId or screenshot data'
      });
    }
    
    // Create a unique filename
    const timestamp = Date.now();
    const filename = `${elementId}_${timestamp}.png`;
    const filepath = path.join(screenshotsDir, filename);
    
    // Save screenshot base64 data to file
    if (screenshot.startsWith('data:image/')) {
      const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filepath, base64Data, 'base64');
      
      console.log(`[SERVER] Screenshot saved for zone ${elementId}`);
      
      return res.json({
        success: true,
        elementId,
        filename,
        filepath
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid screenshot data format'
      });
    }
  } catch (error) {
    console.error(`[SERVER] Error saving screenshot:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error saving screenshot'
    });
  }
});

// Add the new screenshots endpoint that matches what the extension is sending
app.post("/api/screenshots", largeJsonParser, async (req: Request, res: Response) => {
  try {
    console.log(`[SERVER] Received screenshot upload request`);
    
    // Extract data from request
    const { elementId, imageData } = req.body;
    
    if (!elementId || !imageData) {
      console.log(`[SERVER] Missing elementId or imageData in request`);
      return res.status(400).json({ error: 'Missing elementId or imageData' });
    }
    
    console.log(`[SERVER] Processing screenshot for element: ${elementId}`);
    console.log(`[SERVER] Image data length: ${imageData ? imageData.length : 0}`);
    
    // Check if the image data is a valid base64 string
    if (!imageData.startsWith('data:image/')) {
      console.log(`[SERVER] Invalid image data format`);
      return res.status(400).json({ error: 'Invalid image data format' });
    }
    
    // Extract the base64 data without the prefix
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    // Create a unique filename using elementId and timestamp
    const timestamp = Date.now();
    const filename = `${elementId}_${timestamp}.png`;
    const filepath = path.join(screenshotsDir, filename);
    
    // Write the image to disk
    fs.writeFileSync(filepath, base64Data, 'base64');
    
    console.log(`[SERVER] Screenshot saved: ${filename}`);
    
    // Return success with file information
    res.status(200).json({
      success: true,
      elementId,
      filename,
      timestamp,
      path: filepath
    });
  } catch (error) {
    console.error('[SERVER] Error saving screenshot:', error);
    res.status(500).json({ error: 'Error processing screenshot' });
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