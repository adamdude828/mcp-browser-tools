// Socket.IO connection
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
        <img src="${tab.favIconUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="%23757575" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>'}" alt="Tab icon">
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
    if (btn) {
      btn.textContent = 'Select';
    }
  });
  
  const selectedItem = document.querySelector(`.tab-item .select-tab-btn[data-tab-id="${tab.id}"]`).parentNode;
  selectedItem.classList.add('selected');
  selectedItem.querySelector('.select-tab-btn').textContent = 'Selected';
  
  // Update active tab display
  const activeTabDiv = document.getElementById('activeTab');
  activeTabDiv.innerHTML = `
    <div class="active-tab-info">
      <img src="${tab.favIconUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="%23757575" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>'}" alt="Tab icon">
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
            document.getElementById('activeTab').innerHTML = '<p>No tab selected</p>';
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
  
  // Get current tab request
  socket.on('get-current-tab', (data) => {
    log('Received get-current-tab request', data);
    
    if (!selectedTabId) {
      socket.emit('current-tab-error', {
        requestId: data.requestId,
        error: 'No tab is selected'
      });
      return;
    }
    
    chrome.tabs.get(selectedTabId, (tab) => {
      if (chrome.runtime.lastError) {
        socket.emit('current-tab-error', {
          requestId: data.requestId,
          error: 'Selected tab no longer exists'
        });
        return;
      }
      
      socket.emit('current-tab', {
        requestId: data.requestId,
        tab: {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl
        }
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