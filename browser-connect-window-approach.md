# Browser Connect: Window-Based Implementation Plan

## Overview

This document outlines the plan to convert the current popup-based Browser Connect extension to a persistent window-based approach. This change will ensure the Socket.IO connection remains active as long as the window is open, and will give users explicit control over which tabs are available to the MCP agent.

## Architecture Changes

### Current Architecture
- **Popup UI**: Opens when icon is clicked, closes when focus is lost
- **Background Service Worker**: Cannot maintain Socket.IO connection
- **Socket.IO Connection**: Only exists while popup is open
- **Tab Selection**: Automatically works with the active tab

### New Architecture
- **Dedicated Window**: Opens when icon is clicked, remains open until closed by user
- **Background Service Worker**: Manages window lifecycle
- **Socket.IO Connection**: Maintained in the window context for persistence
- **Tab Selection**: User explicitly selects which tab to make available to the MCP agent

## Implementation Steps

### 1. Background Script Changes

- Remove Socket.IO connection attempts from background script
- Add logic to open/focus dedicated window when extension icon is clicked
- Track window state (open/closed)
- Handle window lifecycle events

```javascript
// Background script
let windowId = null;

// When extension icon is clicked
chrome.action.onClicked.addListener(() => {
  if (windowId) {
    // Focus existing window
    chrome.windows.update(windowId, { focused: true });
  } else {
    // Create new window
    chrome.windows.create({
      url: chrome.runtime.getURL('window.html'),
      type: 'popup',
      width: 800,
      height: 600
    }, (window) => {
      windowId = window.id;
    });
  }
});

// Track window closure
chrome.windows.onRemoved.addListener((removedWindowId) => {
  if (removedWindowId === windowId) {
    windowId = null;
  }
});
```

### 2. Create Window UI

- Create a new `window.html` page with its own styling
- Implement tab listing and selection UI
- Add connection status indicators
- Provide clear UI feedback about which tab is being controlled

```html
<!-- window.html -->
<div class="container">
  <div class="connection-panel">
    <input type="text" id="serverUrl" value="http://localhost:3000">
    <button id="connectBtn">Connect</button>
    <button id="disconnectBtn">Disconnect</button>
    <div id="statusMessage">Not connected</div>
  </div>
  
  <div class="tabs-panel">
    <h2>Available Tabs</h2>
    <div id="tabsList">
      <!-- Tab items will be populated here -->
    </div>
  </div>
  
  <div class="active-tab-panel">
    <h2>Currently Connected Tab</h2>
    <div id="activeTab">
      <p>No tab selected</p>
    </div>
  </div>
  
  <div class="logs-panel">
    <h2>Connection Logs</h2>
    <div id="logs"></div>
  </div>
</div>
```

### 3. Window JavaScript Logic

- Implement Socket.IO connection handling
- Add tab listing and refreshing
- Implement tab selection functionality
- Add logging and status updates

```javascript
// window.js
let socket = null;
let selectedTabId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Load saved server URL
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      document.getElementById('serverUrl').value = result.serverUrl;
    }
  });
  
  // Set up event listeners
  document.getElementById('connectBtn').addEventListener('click', connect);
  document.getElementById('disconnectBtn').addEventListener('click', disconnect);
  
  // Load tabs on startup
  loadTabs();
  
  // Refresh tabs periodically
  setInterval(loadTabs, 5000);
});

// Load and display all tabs
function loadTabs() {
  chrome.tabs.query({}, (tabs) => {
    const tabsList = document.getElementById('tabsList');
    tabsList.innerHTML = '';
    
    tabs.forEach((tab) => {
      const tabItem = document.createElement('div');
      tabItem.className = 'tab-item';
      if (tab.id === selectedTabId) {
        tabItem.classList.add('selected');
      }
      
      // Build tab item UI
      tabItem.innerHTML = `
        <img src="${tab.favIconUrl || 'placeholder-icon.png'}" alt="Tab icon">
        <div class="tab-info">
          <div class="tab-title">${tab.title}</div>
          <div class="tab-url">${tab.url}</div>
        </div>
        <button class="select-tab-btn" data-tab-id="${tab.id}">
          ${tab.id === selectedTabId ? 'Selected' : 'Select'}
        </button>
      `;
      
      tabsList.appendChild(tabItem);
      
      // Add click handler
      tabItem.querySelector('.select-tab-btn').addEventListener('click', () => {
        selectTab(tab);
      });
    });
  });
}

// Select a tab to control
function selectTab(tab) {
  selectedTabId = tab.id;
  
  // Update UI
  document.querySelectorAll('.tab-item').forEach((item) => {
    item.classList.remove('selected');
    const btn = item.querySelector('.select-tab-btn');
    btn.textContent = 'Select';
  });
  
  const selectedItem = document.querySelector(`.tab-item .select-tab-btn[data-tab-id="${tab.id}"]`).parentNode;
  selectedItem.classList.add('selected');
  selectedItem.querySelector('.select-tab-btn').textContent = 'Selected';
  
  // Update active tab display
  const activeTabDiv = document.getElementById('activeTab');
  activeTabDiv.innerHTML = `
    <div class="active-tab-info">
      <img src="${tab.favIconUrl || 'placeholder-icon.png'}" alt="Tab icon">
      <div>
        <div class="tab-title">${tab.title}</div>
        <div class="tab-url">${tab.url}</div>
      </div>
    </div>
  `;
  
  // Send to server if connected
  if (socket && socket.connected) {
    socket.emit('active-tab-update', {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl
    });
    log('Sent selected tab info to server');
  }
}

// Connect to server
function connect() {
  const serverUrl = document.getElementById('serverUrl').value.trim();
  if (!serverUrl) {
    showError('Please enter a valid server URL');
    return;
  }
  
  // Save URL
  chrome.storage.sync.set({ serverUrl });
  
  // Update UI
  updateUI(false, serverUrl, 'Connecting...');
  
  // Create Socket.IO connection
  try {
    socket = io(serverUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000
    });
    
    // Connection events
    socket.on('connect', () => {
      log('Connected to server', { id: socket.id });
      updateUI(true, serverUrl);
      
      // If a tab is already selected, send it
      if (selectedTabId) {
        chrome.tabs.get(selectedTabId, (tab) => {
          if (chrome.runtime.lastError) {
            log('Selected tab no longer exists, selecting none');
            selectedTabId = null;
            return;
          }
          
          socket.emit('active-tab-update', {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl
          });
        });
      }
      
      // Set up socket event listeners
      setupSocketEvents();
    });
    
    socket.on('connect_error', (error) => {
      log('Connection error', error.message);
      showError(`Connection error: ${error.message}`);
    });
    
    socket.on('disconnect', (reason) => {
      log('Disconnected', reason);
      updateUI(false, serverUrl);
    });
  } catch (error) {
    log('Error initializing connection', error.message);
    showError(`Error: ${error.message}`);
  }
}

// Set up Socket.IO events
function setupSocketEvents() {
  // Browser tabs request
  socket.on('get-browser-tabs', (data) => {
    log('Received get-browser-tabs request', data);
    
    chrome.tabs.query({}, (tabs) => {
      const tabsData = tabs.map(tab => ({
        id: tab.id,
        windowId: tab.windowId,
        active: tab.active,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl || null,
        index: tab.index,
        selected: tab.id === selectedTabId
      }));
      
      socket.emit('browser-tabs-response', {
        requestId: data.requestId,
        tabs: tabsData,
        selectedTabId
      });
    });
  });
  
  // Navigate request
  socket.on('browser-navigate', (data) => {
    log('Received navigate request', data);
    
    // Only navigate the selected tab
    if (!selectedTabId) {
      socket.emit('browser-navigate-error', {
        requestId: data.requestId,
        error: 'No tab is selected for navigation'
      });
      return;
    }
    
    chrome.tabs.get(selectedTabId, (tab) => {
      if (chrome.runtime.lastError) {
        socket.emit('browser-navigate-error', {
          requestId: data.requestId,
          error: 'Selected tab no longer exists'
        });
        return;
      }
      
      chrome.tabs.update(selectedTabId, { url: data.url }, (updatedTab) => {
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
    });
  });
}

// Disconnect from server
function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  updateUI(false, document.getElementById('serverUrl').value);
}

// Update UI based on connection status
function updateUI(isConnected, serverUrl, customStatusText = null) {
  const statusMessage = document.getElementById('statusMessage');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  
  if (isConnected) {
    statusMessage.textContent = customStatusText || `Connected to ${serverUrl}`;
    statusMessage.className = 'status-connected';
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
  } else {
    statusMessage.textContent = customStatusText || 'Not connected';
    statusMessage.className = 'status-disconnected';
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
  }
}

// Show error message
function showError(message) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.className = 'status-error';
  log('Error', message);
}

// Log to UI
function log(message, data) {
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  logEntry.innerHTML = `<span class="log-time">${timestamp}</span> <span class="log-message">${message}</span>`;
  
  if (data) {
    const dataText = typeof data === 'object' ? JSON.stringify(data) : data;
    logEntry.innerHTML += `<span class="log-data">${dataText}</span>`;
  }
  
  const logs = document.getElementById('logs');
  logs.insertBefore(logEntry, logs.firstChild);
  
  // Limit log entries
  while (logs.children.length > 50) {
    logs.removeChild(logs.lastChild);
  }
  
  console.log(message, data);
}
```

### 4. Manifest Updates

- Update manifest to reference the new window.html
- Update permissions as needed
- Register background script to handle window lifecycle

```json
{
  "action": {
    "default_icon": "icon.png"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "permissions": [
    "tabs",
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "http://localhost:*/*",
    "https://*/*"
  ],
  "web_accessible_resources": [
    {
      "resources": ["window.html", "socket.io.min.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 5. Server Updates

- No significant changes needed for the server
- Optionally add support for receiving tab selection information
- Could add a field to indicate which tab is currently selected by the user

## Benefits of This Approach

1. **Persistence**: Connection remains active as long as window is open
2. **User Control**: Explicit selection of which tab to share
3. **Security**: Better permission model with clear user intent
4. **Visibility**: User always knows which tab is connected
5. **Simplicity**: Clearer architecture with defined responsibilities

## Implementation Timeline

1. Create window.html and window.js files
2. Update background script to manage window lifecycle
3. Update manifest to reference new files and permissions
4. Test window persistence and tab selection
5. Refine UI/UX for clear user feedback
6. Add additional features (connection logs, improved tab management)

## Future Enhancements

- Add ability to select multiple tabs
- Implement tab screenshots for easier identification
- Add connection history and saved server URLs
- Implement extension options for customization
- Add security features (timeout, auto-disconnect) 