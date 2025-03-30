# Browser Connect

This monorepo contains two separate projects that work together to enable browser extension integration with Model Context Protocol (MCP).

## Project Structure

The repository is organized into two main components:

### 1. HTTP/MCP Server (`http-server/`)

A server that implements the Model Context Protocol (MCP) and provides Socket.IO endpoints for browser extension communication. The server enables LLMs to interact with browser tabs through the Browser Connect extension.

- **Tech Stack**: TypeScript, MCP SDK, Express, Socket.IO
- **Features**:
  - MCP protocol implementation with a browser_get_title tool
  - Socket.IO endpoints for real-time browser extension communication
  - Tab state management for reliable tool operation
  - Structured with clean separation of concerns

### 2. Chrome Extension (`extension/`)

A browser extension that connects to the HTTP server and provides access to browser tab information.

- **Tech Stack**: JavaScript, Chrome Extension API, Socket.IO
- **Features**:
  - Tab information sharing (title, URL)
  - Real-time communication with the server
  - Tab selection and management
  - Connection status management

## Setup and Installation

### Initial Setup

You can install all dependencies at once:

```bash
npm run install:all
```

Or install each project separately:

### HTTP Server Setup

```bash
cd http-server
npm install
npm run build
npm start
```

The server will run on http://localhost:3000 by default.

### Chrome Extension Setup

Load the unpacked extension from the `extension` directory in Chrome:

1. Go to chrome://extensions
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` directory

## Using the Extension

1. Click the Browser Connect extension icon in Chrome
2. Enter the server URL (default: http://localhost:3000)
3. Click Connect
4. Select a tab to share with the server

## Development Workflow

1. Start the HTTP server: `npm start` (or `./start-servers.sh`)
2. Connect the Chrome extension to the server
3. Call the browser_get_title tool through the MCP interface

## Testing

The repository includes several testing utilities:
- `check-connections.js` - Check Socket.IO connections
- `test-browser-extension.js` - Test extension functionality
- `connection-test.html` - Web-based connection tester

## License

MIT 