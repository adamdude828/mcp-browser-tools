# Browser Connect Extension API

This document outlines how the HTTP server communicates with the Browser Connect extension using Socket.IO.

## Communication Protocol

The Browser Connect extension uses **Socket.IO** for bidirectional communication with the HTTP server. The extension connects to the server at the default endpoint (`/socket.io`) and uses both WebSocket and polling transports.

## Server Requirements

The HTTP server must:

1. Implement a Socket.IO server on the default endpoint (`/socket.io`)
2. Provide a `/status` endpoint for the initial connection health check
3. Handle specific Socket.IO events for browser interactions

## Connection Flow

1. User enters the server URL in the extension popup (default: `http://localhost:3000`)
2. Extension first performs a health check by sending a GET request to `/status`
3. If successful, the extension establishes a Socket.IO connection to the server
4. Upon connection, the extension immediately sends the active tab information

## Socket.IO Events

### Events Sent from Extension to Server

| Event | Payload | Description |
|-------|---------|-------------|
| `active-tab-update` | `{ id, url, title, favIconUrl }` | Sent when the active tab changes or updates |
| `current-tab` | `{ requestId, tab: { id, url, title, favIconUrl } }` | Response to a `get-current-tab` request |
| `current-tab-error` | `{ requestId, error }` | Error response when unable to retrieve tab information |

### Events Server Should Send to Extension

| Event | Payload | Description |
|-------|---------|-------------|
| `get-current-tab` | `{ requestId }` | Request the current active tab information |

## Implementing the HTTP Server

The HTTP server should implement the following:

1. A Socket.IO server with the default configuration
2. A `/status` endpoint that returns a 200 OK response with JSON data
3. Event handlers for the Socket.IO events listed above

### Example Server Implementation (Node.js)

```javascript
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// Create Express app
const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Status endpoint for health checks
app.get('/status', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Extension connected:', socket.id);
  
  // Handle active tab updates from the extension
  socket.on('active-tab-update', (tabInfo) => {
    console.log('Active tab updated:', tabInfo.url);
    // Process tab information or forward to LLM processes
  });
  
  // Request current tab information from the extension
  function getCurrentTab() {
    const requestId = Date.now().toString();
    return new Promise((resolve, reject) => {
      // Set timeout for response
      const timeout = setTimeout(() => {
        reject(new Error('Tab request timed out'));
      }, 5000);
      
      // Listen for the response with this requestId
      const handleResponse = (data) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          socket.off('current-tab', handleResponse);
          socket.off('current-tab-error', handleError);
          resolve(data.tab);
        }
      };
      
      // Listen for errors
      const handleError = (data) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          socket.off('current-tab', handleResponse);
          socket.off('current-tab-error', handleError);
          reject(new Error(data.error));
        }
      };
      
      // Set up listeners
      socket.on('current-tab', handleResponse);
      socket.on('current-tab-error', handleError);
      
      // Send the request
      socket.emit('get-current-tab', { requestId });
    });
  }
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('Extension disconnected:', reason);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Extension Behavior

- The extension will automatically send tab information whenever the active tab changes
- The extension will only work with the active browser window and tab
- The extension disconnects when the popup is closed or when the user clicks the Disconnect button
- The extension will try to reconnect if the connection is lost

## Error Handling

The server should be prepared to handle these error cases:

1. Extension not connected (user hasn't opened the extension or clicked Connect)
2. Request timeout (extension didn't respond in a reasonable time)
3. No active tab (user might be on a chrome:// page or a page without a URL)

## Security Considerations

- The extension accepts any server URL, so implement proper authentication if needed
- Socket.IO communication is not encrypted by default - use HTTPS for production
- The extension has access to sensitive browser information, handle it appropriately on the server side 