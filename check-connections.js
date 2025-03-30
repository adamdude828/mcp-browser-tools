#!/usr/bin/env node
/**
 * Simple script to check what clients are connected to the Socket.IO server
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

// Create Socket.IO client
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
  timeout: 5000
});

// Connect to the server
socket.on('connect', () => {
  console.log(`Connected to server: ${SERVER_URL}`);
  console.log(`Our socket ID: ${socket.id}`);
  
  // Emit a special event to request connection info
  socket.emit('get-connection-info', { requestId: Date.now().toString() });
  
  // Listen for connection info response
  socket.on('connection-info', (data) => {
    console.log('Connection info received:');
    console.log('- Number of connected clients:', data.clientCount);
    console.log('- Connected client IDs:', data.clientIds);
    console.log('\nImportant: Check if any of these IDs match your extension!');
    
    // Cleanup and exit
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 1000);
  });
  
  // Set a timeout
  setTimeout(() => {
    console.log('No response received, server might not support get-connection-info event.');
    console.log('Try sending a test message to see if the server receives it:');
    
    // Send a test message
    const testMessage = {
      type: 'test',
      message: 'This is a test message from check-connections.js',
      time: new Date().toISOString()
    };
    console.log('Sending test message:', testMessage);
    socket.emit('test-message', testMessage);
    
    // Wait a bit and disconnect
    setTimeout(() => {
      console.log('Check the server logs to see if the test message was received.');
      socket.disconnect();
      process.exit(0);
    }, 2000);
  }, 3000);
});

socket.on('disconnect', (reason) => {
  console.log(`Disconnected: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.error(`Connection error: ${error.message}`);
  process.exit(1);
}); 