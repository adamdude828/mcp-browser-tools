#!/usr/bin/env node
/**
 * Test script to communicate directly with the browser extension via WebSocket
 * 
 * Usage:
 *   node test-browser-extension.js [command] [args]
 * 
 * Commands:
 *   get-tabs               - Get all browser tabs
 *   navigate [url]         - Navigate to URL
 *   console-log [message]  - Send a console log message
 *   console-error [message] - Send a console error message
 */

const { io } = require('socket.io-client');
const readline = require('readline');

const SERVER_URL = 'http://localhost:3000';

// Create Socket.IO client
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
  timeout: 5000
});

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'get-tabs';

// Set up readline interface for interactive mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to the server
socket.on('connect', () => {
  console.log(`Connected to server: ${SERVER_URL}`);
  console.log(`Socket ID: ${socket.id}`);
  
  // Execute the specified command
  executeCommand(command, args.slice(1));
});

socket.on('disconnect', (reason) => {
  console.log(`Disconnected: ${reason}`);
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error(`Connection error: ${error.message}`);
  process.exit(1);
});

// Handle different commands
function executeCommand(cmd, args) {
  switch (cmd) {
    case 'get-tabs':
      getTabs();
      break;
    case 'navigate':
      navigateTo(args[0]);
      break;
    case 'console-log':
      sendConsoleLog(args.join(' ') || 'Test message from CLI');
      break;
    case 'console-error':
      sendConsoleError(args.join(' ') || 'Test error from CLI');
      break;
    case 'interactive':
      startInteractiveMode();
      break;
    default:
      console.log(`Unknown command: ${cmd}`);
      showHelp();
      socket.disconnect();
  }
}

// Get all browser tabs
function getTabs() {
  console.log('Requesting browser tabs...');
  
  const requestId = Date.now().toString();
  
  // Listen for the response
  socket.once('browser-tabs-response', (data) => {
    if (data.requestId === requestId) {
      console.log('Received tabs:');
      console.log(JSON.stringify(data.tabs, null, 2));
      socket.disconnect();
    }
  });
  
  // Listen for errors
  socket.once('browser-tabs-error', (data) => {
    if (data.requestId === requestId) {
      console.error(`Error: ${data.error}`);
      socket.disconnect();
    }
  });
  
  // Set a timeout
  setTimeout(() => {
    console.error('Request timed out');
    socket.disconnect();
  }, 5000);
  
  // Send the request
  socket.emit('get-browser-tabs', { requestId });
}

// Navigate to a URL
function navigateTo(url) {
  if (!url) {
    console.error('No URL specified');
    socket.disconnect();
    return;
  }
  
  console.log(`Navigating to: ${url}`);
  
  const requestId = Date.now().toString();
  
  // Listen for the response
  socket.once('browser-navigate-response', (data) => {
    if (data.requestId === requestId) {
      console.log(`Navigation successful: ${data.url}`);
      socket.disconnect();
    }
  });
  
  // Listen for errors
  socket.once('browser-navigate-error', (data) => {
    if (data.requestId === requestId) {
      console.error(`Navigation error: ${data.error}`);
      socket.disconnect();
    }
  });
  
  // Set a timeout
  setTimeout(() => {
    console.error('Request timed out');
    socket.disconnect();
  }, 5000);
  
  // Send the request
  socket.emit('browser-navigate', { 
    requestId,
    url
  });
}

// Send a console log message
function sendConsoleLog(message) {
  console.log(`Sending console log: ${message}`);
  
  socket.emit('console-log', {
    timestamp: new Date().toISOString(),
    message,
    level: 'info'
  });
  
  // Wait a bit to make sure the message is sent
  setTimeout(() => {
    console.log('Message sent');
    socket.disconnect();
  }, 1000);
}

// Send a console error message
function sendConsoleError(message) {
  console.log(`Sending console error: ${message}`);
  
  socket.emit('console-log', {
    timestamp: new Date().toISOString(),
    message,
    level: 'error'
  });
  
  // Wait a bit to make sure the message is sent
  setTimeout(() => {
    console.log('Error message sent');
    socket.disconnect();
  }, 1000);
}

// Start interactive mode
function startInteractiveMode() {
  console.log('Interactive mode. Type a command or "help" for available commands:');
  promptUser();
  
  function promptUser() {
    rl.question('> ', (input) => {
      const parts = input.trim().split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);
      
      if (cmd === 'exit' || cmd === 'quit') {
        console.log('Exiting...');
        socket.disconnect();
        rl.close();
        return;
      }
      
      if (cmd === 'help') {
        showInteractiveHelp();
        promptUser();
        return;
      }
      
      // Execute the command but don't disconnect
      switch (cmd) {
        case 'get-tabs':
          socket.once('browser-tabs-response', (data) => {
            console.log('Received tabs:');
            console.log(JSON.stringify(data.tabs, null, 2));
            promptUser();
          });
          
          socket.once('browser-tabs-error', (data) => {
            console.error(`Error: ${data.error}`);
            promptUser();
          });
          
          socket.emit('get-browser-tabs', { requestId: Date.now().toString() });
          break;
          
        case 'navigate':
          const url = args[0];
          if (!url) {
            console.error('No URL specified');
            promptUser();
            return;
          }
          
          socket.once('browser-navigate-response', (data) => {
            console.log(`Navigation successful: ${data.url}`);
            promptUser();
          });
          
          socket.once('browser-navigate-error', (data) => {
            console.error(`Navigation error: ${data.error}`);
            promptUser();
          });
          
          socket.emit('browser-navigate', { 
            requestId: Date.now().toString(),
            url
          });
          break;
          
        case 'log':
          const logMessage = args.join(' ') || 'Test message';
          socket.emit('console-log', {
            timestamp: new Date().toISOString(),
            message: logMessage,
            level: 'info'
          });
          console.log('Log message sent');
          promptUser();
          break;
          
        case 'error':
          const errorMessage = args.join(' ') || 'Test error';
          socket.emit('console-log', {
            timestamp: new Date().toISOString(),
            message: errorMessage,
            level: 'error'
          });
          console.log('Error message sent');
          promptUser();
          break;
          
        default:
          console.log(`Unknown command: ${cmd}`);
          showInteractiveHelp();
          promptUser();
      }
    });
  }
}

// Show help information
function showHelp() {
  console.log('\nUsage:');
  console.log('  node test-browser-extension.js [command] [args]');
  console.log('\nCommands:');
  console.log('  get-tabs               - Get all browser tabs');
  console.log('  navigate [url]         - Navigate to URL');
  console.log('  console-log [message]  - Send a console log message');
  console.log('  console-error [message] - Send a console error message');
  console.log('  interactive            - Start interactive mode');
}

// Show interactive help
function showInteractiveHelp() {
  console.log('\nAvailable commands:');
  console.log('  get-tabs        - Get all browser tabs');
  console.log('  navigate [url]  - Navigate to URL');
  console.log('  log [message]   - Send a console log message');
  console.log('  error [message] - Send a console error message');
  console.log('  help            - Show this help');
  console.log('  exit/quit       - Exit interactive mode');
} 