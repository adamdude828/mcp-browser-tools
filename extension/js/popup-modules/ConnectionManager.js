/**
 * ConnectionManager.js
 * Manages socket connections to the server and connection state
 */

class ConnectionManager {
  constructor(uiUtils) {
    this.socketConnection = null;
    this.serverUrl = '';
    this.isConnected = false;
    this.uiUtils = uiUtils;

    // Cache DOM elements
    this.serverUrlInput = document.getElementById('serverUrl');
    this.connectBtn = document.getElementById('connectBtn');
    this.disconnectBtn = document.getElementById('disconnectBtn');

    // Set up event listeners
    this.connectBtn.addEventListener('click', () => this.connect());
    this.disconnectBtn.addEventListener('click', () => this.disconnect());

    // Load saved server URL
    this.loadSavedServerUrl();

    // Check Socket.IO availability
    this.checkSocketIO();

    // Add message listeners
    this.setupMessageListeners();
  }

  /**
   * Load the saved server URL from storage
   */
  loadSavedServerUrl() {
    chrome.storage.sync.get(['serverUrl'], (result) => {
      if (result.serverUrl) {
        this.serverUrlInput.value = result.serverUrl;
      } else {
        // Default value
        this.serverUrlInput.value = 'http://localhost:3000';
      }
    });
  }

  /**
   * Check if Socket.IO is available in the popup context
   */
  checkSocketIO() {
    const isAvailable = typeof io !== 'undefined';
    this.log('Socket.IO available in popup:', isAvailable);
    
    if (isAvailable) {
      this.log('Socket.IO version detected:', io.version || 'unknown');
      chrome.runtime.sendMessage({ 
        type: 'socketIOLoaded', 
        success: true,
        version: io.version
      });
    } else {
      this.log('Socket.IO not available in popup context');
      chrome.runtime.sendMessage({ 
        type: 'socketIOLoaded', 
        success: false,
        error: 'io object not defined in popup'
      });
    }
    
    return isAvailable;
  }

  /**
   * Connect to the server
   */
  connect() {
    const serverUrl = this.serverUrlInput.value.trim();
    if (!serverUrl) {
      this.uiUtils.showError('Please enter a valid server URL');
      return;
    }
    
    // Validate URL format
    try {
      new URL(serverUrl);
    } catch (e) {
      this.uiUtils.showError('Invalid URL format');
      return;
    }
    
    // Update UI immediately to show we're trying to connect
    this.uiUtils.updateUI(false, serverUrl, 'Connecting...');
    this.uiUtils.setStatusColor('#FFA000'); // Amber/orange
    
    // First let's make sure Socket.IO is available
    if (typeof io === 'undefined') {
      this.uiUtils.showError('Socket.IO library not available. Please reload the extension.');
      this.log('ERROR: Socket.IO not available when trying to connect');
      return;
    }
    
    this.log('Creating Socket.IO connection to:', serverUrl);
    
    // Create Socket.IO connection with options
    const socket = io(serverUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000
    });
    
    // Store the socket
    this.socketConnection = socket;
    this.serverUrl = serverUrl;
    
    // Connection events
    socket.on('connect', () => {
      this.isConnected = true;
      this.log('Successfully connected to server', { 
        id: socket.id, 
        transport: socket.io.engine.transport.name 
      });
      
      // Update UI
      this.uiUtils.updateUI(true, serverUrl);
      
      // Tell background script we're connected
      chrome.runtime.sendMessage({ 
        type: 'setConnectionStatus', 
        isConnected: true 
      });
      
      // Tell background script to store the server URL
      chrome.runtime.sendMessage({ 
        type: 'connect', 
        serverUrl 
      });
      
      // Set up handlers for server events
      this.setupSocketEvents(socket);
    });
    
    socket.on('connect_error', (error) => {
      this.isConnected = false;
      this.log('Connection error', error);
      this.uiUtils.showError(`Connection error: ${error.message}`);
      
      // Tell background script we're not connected
      chrome.runtime.sendMessage({ 
        type: 'setConnectionStatus', 
        isConnected: false 
      });
    });
    
    socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.log('Disconnected from server', reason);
      this.uiUtils.updateUI(false, serverUrl);
      
      // Tell background script we're not connected
      chrome.runtime.sendMessage({ 
        type: 'setConnectionStatus', 
        isConnected: false 
      });
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    // Update UI immediately
    this.uiUtils.updateUI(false, this.serverUrlInput.value, 'Disconnecting...');
    
    if (this.socketConnection) {
      this.log('Disconnecting from server');
      this.socketConnection.disconnect();
      this.socketConnection = null;
      this.isConnected = false;
    }
    
    // Tell background script we're disconnected
    chrome.runtime.sendMessage({ 
      type: 'disconnect'
    });
  }

  /**
   * Set up Socket.IO event handlers
   */
  setupSocketEvents(socket) {
    // Listen for browser tab requests from server
    socket.on('get-browser-tabs', (data) => {
      this.log('Received get-browser-tabs request', data);
      
      // Get all tabs
      chrome.tabs.query({}, (tabs) => {
        this.log(`Found ${tabs.length} tabs`);
        
        // Format tab data
        const tabsData = tabs.map(tab => ({
          id: tab.id,
          windowId: tab.windowId,
          active: tab.active,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl || null,
          index: tab.index
        }));
        
        // Send response back
        socket.emit('browser-tabs-response', {
          requestId: data.requestId,
          tabs: tabsData
        });
        
        this.log('Sent tabs response to server');
      });
    });
    
    // Listen for navigate requests
    socket.on('browser-navigate', (data) => {
      this.log('Received request to navigate to:', data.url);
      
      // Get the active tab to navigate
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          const tab = tabs[0];
          
          // Check if we can access the tab
          if (!tab.url || tab.url.startsWith('chrome://')) {
            socket.emit('browser-navigate-error', {
              requestId: data.requestId,
              error: 'Cannot navigate this page - restricted URL'
            });
            return;
          }
          
          // Update the tab URL
          chrome.tabs.update(tab.id, { url: data.url }, (updatedTab) => {
            if (chrome.runtime.lastError) {
              socket.emit('browser-navigate-error', {
                requestId: data.requestId,
                error: chrome.runtime.lastError.message
              });
              return;
            }
            
            socket.emit('browser-navigate-response', {
              requestId: data.requestId,
              success: true,
              tabId: updatedTab.id,
              url: data.url
            });
          });
        } else {
          socket.emit('browser-navigate-error', {
            requestId: data.requestId,
            error: 'No active tab found'
          });
        }
      });
    });
    
    // Listen for messages from the server
    socket.on('console-log', (message) => {
      this.log('Received console message from server', message);
    });
    
    // Handle test messages
    socket.on('test-echo', (data) => {
      this.log('Received test echo from server', data);
    });
  }

  /**
   * Setup message listeners for background script communication
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'tab-info' && this.socketConnection && this.socketConnection.connected) {
        // Forward tab info to server
        this.socketConnection.emit('active-tab-update', message.data);
        this.log('Forwarded tab info to server', message.data.url);
      }
      
      if (message.type === 'connectionStatus') {
        this.isConnected = message.isConnected;
        this.uiUtils.updateUI(message.isConnected, message.serverUrl);
        this.log('Connection status update', message);
        
        // Show error if there was one
        if (!message.isConnected && message.error) {
          this.uiUtils.showError(`Connection error: ${message.error}`);
        }
      }
    });
  }

  /**
   * Check connection status with the background script
   */
  checkConnectionStatus() {
    chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
      if (response) {
        this.isConnected = response.isConnected;
        this.uiUtils.updateUI(response.isConnected, response.serverUrl);
        this.uiUtils.updateDebugInfo(response);
      } else {
        // Handle case where background script hasn't initialized yet
        this.uiUtils.updateUI(false, this.serverUrlInput.value);
        this.uiUtils.updateDebugInfo({ error: 'Background script not initialized' });
      }
    });
  }

  /**
   * Get the current socket connection
   * @returns {Object|null} The Socket.IO connection or null if not connected
   */
  getSocketConnection() {
    return this.socketConnection;
  }

  /**
   * Check if connected to server
   * @returns {boolean} True if connected, false otherwise
   */
  getIsConnected() {
    return this.isConnected;
  }

  /**
   * Log message to console with optional data
   */
  log(message, data) {
    this.uiUtils.log(message, data);
  }
}

export default ConnectionManager; 