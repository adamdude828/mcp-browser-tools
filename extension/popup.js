// DOM elements
const serverUrlInput = document.getElementById('serverUrl');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusMessage = document.getElementById('statusMessage');
const currentUrl = document.getElementById('currentUrl');
const startSelectionBtn = document.getElementById('startSelectionBtn');
const selectedElementsContainer = document.getElementById('selectedElements');
const debugInfo = document.getElementById('debugInfo');
const debugToggle = document.getElementById('debugToggle');

// Element selection state
let selectionModeActive = false;

// Check if Socket.IO is available in the popup context
function checkSocketIO() {
  const isAvailable = typeof io !== 'undefined';
  log('Socket.IO available in popup:', isAvailable);
  
  if (isAvailable) {
    log('Socket.IO version detected:', io.version || 'unknown');
    chrome.runtime.sendMessage({ 
      type: 'socketIOLoaded', 
      success: true,
      version: io.version
    });
  } else {
    log('Socket.IO not available in popup context');
    chrome.runtime.sendMessage({ 
      type: 'socketIOLoaded', 
      success: false,
      error: 'io object not defined in popup'
    });
  }
  
  return isAvailable;
}

// Set up debug toggle
debugToggle.addEventListener('click', () => {
  if (debugInfo.style.display === 'none') {
    debugInfo.style.display = 'block';
    debugToggle.textContent = 'Hide Debug Info';
    updateDebugInfo();
  } else {
    debugInfo.style.display = 'none';
    debugToggle.textContent = 'Show Debug Info';
  }
});

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Immediately check if Socket.IO is available
  checkSocketIO();
  
  // Load saved server URL
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
    } else {
      // Default value
      serverUrlInput.value = 'http://localhost:3000';
    }
  });
  
  // Check connection status
  checkConnectionStatus();
  
  // Set up button event listeners
  connectBtn.addEventListener('click', connect);
  disconnectBtn.addEventListener('click', disconnect);
  startSelectionBtn.addEventListener('click', toggleSelectionMode);
  
  // Update URL when popup opens
  getCurrentTabUrl();
  
  // Load any existing selected elements
  loadSelectedElements();
  
  // Update URL every 2 seconds while popup is open
  setInterval(getCurrentTabUrl, 2000);
  
  // Update debug info periodically
  setInterval(updateDebugInfo, 1000);
});

// Toggle element selection mode
function toggleSelectionMode() {
  console.log('Toggling selection mode from popup');
  
  // Call the background script to toggle selection mode
  chrome.runtime.sendMessage({ type: 'toggle-selection-mode-from-popup' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error toggling selection mode:', chrome.runtime.lastError);
      return;
    }
    
    // If successful, close the popup to get out of the way
    window.close();
  });
}

// Update selection button state
function updateSelectionButtonState() {
  if (selectionModeActive) {
    startSelectionBtn.textContent = 'Stop Selection Mode';
    startSelectionBtn.style.backgroundColor = '#f44336';
  } else {
    startSelectionBtn.textContent = 'Start Selection Mode';
    startSelectionBtn.style.backgroundColor = '#2196F3';
  }
}

// Load selected elements from background
function loadSelectedElements() {
  chrome.runtime.sendMessage({ type: 'get-selected-elements' }, (response) => {
    if (response && response.elements) {
      displaySelectedElements(response.elements);
    }
  });
}

// Display selected elements
function displaySelectedElements(elements) {
  selectedElementsContainer.innerHTML = '';
  
  if (elements.length === 0) {
    selectedElementsContainer.innerHTML = '<p>No elements selected yet.</p>';
    return;
  }
  
  // Sort elements by timestamp (newest first)
  elements.sort((a, b) => b.timestamp - a.timestamp);
  
  elements.forEach(element => {
    const elementItem = document.createElement('div');
    elementItem.className = 'element-item';
    
    const elementLabel = document.createElement('div');
    elementLabel.className = 'element-label';
    elementLabel.textContent = element.label;
    
    const elementInfo = document.createElement('div');
    elementInfo.className = 'element-info';
    elementInfo.textContent = `${element.tagName} • ${element.cssSelector}`;
    
    elementItem.appendChild(elementLabel);
    elementItem.appendChild(elementInfo);
    selectedElementsContainer.appendChild(elementItem);
  });
}

// Check connection status
function checkConnectionStatus() {
  chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
    if (response) {
      updateUI(response.isConnected, response.serverUrl);
      updateDebugInfo(response);
    } else {
      // Handle case where background script hasn't initialized yet
      updateUI(false, serverUrlInput.value);
      updateDebugInfo({ error: 'Background script not initialized' });
    }
  });
}

// Connect to server
function connect() {
  const serverUrl = serverUrlInput.value.trim();
  if (!serverUrl) {
    showError('Please enter a valid server URL');
    return;
  }
  
  // Validate URL format
  try {
    new URL(serverUrl);
  } catch (e) {
    showError('Invalid URL format');
    return;
  }
  
  // Update UI immediately to show we're trying to connect
  updateUI(false, serverUrl, 'Connecting...');
  statusMessage.style.color = '#FFA000'; // Amber/orange
  
  // First let's make sure Socket.IO is available
  if (typeof io === 'undefined') {
    showError('Socket.IO library not available. Please reload the extension.');
    log('ERROR: Socket.IO not available when trying to connect');
    return;
  }
  
  log('Creating Socket.IO connection to:', serverUrl);
  
  // Create Socket.IO connection with options
  const socket = io(serverUrl, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    timeout: 5000
  });
  
  // Store the socket in window for access from other functions
  window.socketConnection = socket;
  
  // Connection events
  socket.on('connect', () => {
    log('Successfully connected to server', { 
      id: socket.id, 
      transport: socket.io.engine.transport.name 
    });
    
    // Update UI
    updateUI(true, serverUrl);
    
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
    setupSocketEvents(socket);
  });
  
  socket.on('connect_error', (error) => {
    log('Connection error', error);
    showError(`Connection error: ${error.message}`);
    
    // Tell background script we're not connected
    chrome.runtime.sendMessage({ 
      type: 'setConnectionStatus', 
      isConnected: false 
    });
  });
  
  socket.on('disconnect', (reason) => {
    log('Disconnected from server', reason);
    updateUI(false, serverUrl);
    
    // Tell background script we're not connected
    chrome.runtime.sendMessage({ 
      type: 'setConnectionStatus', 
      isConnected: false 
    });
  });
}

// Set up Socket.IO event handlers
function setupSocketEvents(socket) {
  // Listen for browser tab requests from server
  socket.on('get-browser-tabs', (data) => {
    log('Received get-browser-tabs request', data);
    
    // Get all tabs
    chrome.tabs.query({}, (tabs) => {
      log(`Found ${tabs.length} tabs`);
      
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
      
      log('Sent tabs response to server');
    });
  });
  
  // Listen for navigate requests
  socket.on('browser-navigate', (data) => {
    log('Received request to navigate to:', data.url);
    
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
    log('Received console message from server', message);
  });
  
  // Handle test messages
  socket.on('test-echo', (data) => {
    log('Received test echo from server', data);
  });
}

// Disconnect from server
function disconnect() {
  // Update UI immediately
  updateUI(false, serverUrlInput.value, 'Disconnecting...');
  
  if (window.socketConnection) {
    log('Disconnecting from server');
    window.socketConnection.disconnect();
    window.socketConnection = null;
  }
  
  // Tell background script we're disconnected
  chrome.runtime.sendMessage({ 
    type: 'disconnect'
  });
}

// Show error message
function showError(message) {
  statusMessage.textContent = message;
  statusMessage.style.color = '#F44336'; // Red
  log('Error', message);
}

// Update UI based on connection status
function updateUI(isConnected, serverUrl, customStatusText = null) {
  if (isConnected) {
    statusMessage.textContent = customStatusText || `Connected to ${serverUrl}`;
    statusMessage.style.color = '#4CAF50'; // Green
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
  } else {
    statusMessage.textContent = customStatusText || 'Not connected';
    if (!customStatusText) {
      statusMessage.style.color = '#F44336'; // Red
    }
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
  }
}

// Get current tab URL
function getCurrentTabUrl() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0 && tabs[0].url) {
      currentUrl.textContent = tabs[0].url;
    } else {
      currentUrl.textContent = 'No active tab';
    }
  });
}

// Update debug info
function updateDebugInfo(data) {
  if (debugInfo.style.display === 'none') return;
  
  let info = '';
  
  // Add timestamp
  info += `Time: ${new Date().toISOString()}\n`;
  
  // Check Socket.IO availability
  info += `Socket.IO loaded: ${typeof io !== 'undefined' ? 'Yes' : 'No'}\n`;
  
  // Add extension info
  info += `Extension ID: ${chrome.runtime.id}\n`;
  
  // Add server URL
  info += `Server URL: ${serverUrlInput.value}\n`;
  
  // Add connection status
  chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
    if (response) {
      info += `Connected: ${response.isConnected ? 'Yes' : 'No'}\n`;
      if (response.error) {
        info += `Error: ${response.error}\n`;
      }
    }
    
    // Element selection status
    info += `Element selection mode: ${selectionModeActive ? 'Active' : 'Inactive'}\n`;
    
    // Display logs
    info += '\nRecent logs:\n';
    logs.slice(-5).forEach(log => {
      info += `${log.time} - ${log.message}\n`;
      if (log.data) {
        info += `  ${JSON.stringify(log.data).substring(0, 100)}\n`;
      }
    });
    
    debugInfo.textContent = info;
  });
}

// Simple logging system
const logs = [];
function log(message, data) {
  const logEntry = {
    time: new Date().toISOString().split('T')[1].split('.')[0],
    message,
    data
  };
  logs.push(logEntry);
  // Keep only the last 20 logs
  if (logs.length > 20) {
    logs.shift();
  }
  console.log(message, data);
}

// Listen for tab-info messages from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'tab-info' && window.socketConnection && window.socketConnection.connected) {
    // Forward tab info to server
    window.socketConnection.emit('active-tab-update', message.data);
    log('Forwarded tab info to server', message.data.url);
  }
  
  if (message.type === 'connectionStatus') {
    updateUI(message.isConnected, message.serverUrl);
    log('Connection status update', message);
    
    // Show error if there was one
    if (!message.isConnected && message.error) {
      showError(`Connection error: ${message.error}`);
    }
  }
  
  if (message.type === 'element-selected') {
    // Refresh the selected elements list
    loadSelectedElements();
    
    // Forward to server if connected
    if (window.socketConnection && window.socketConnection.connected) {
      window.socketConnection.emit('selected-element', message.data);
      log('Forwarded selected element to server', message.data);
    }
  }
}); 