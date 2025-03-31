/**
 * Socket Connection Manager
 * Handles the socket.io connection and related events
 */

class SocketConnectionManager {
  constructor() {
    this.socket = null;
    this.serverUrl = '';
    this.onConnectCallbacks = [];
    this.onDisconnectCallbacks = [];
    this.onErrorCallbacks = [];
  }

  /**
   * Connect to the server
   * @param {string} serverUrl - URL of the socket.io server
   * @param {Function} logCallback - Function to log messages
   * @returns {Promise} - Resolves when connected, rejects on error
   */
  connect(serverUrl, logCallback) {
    this.serverUrl = serverUrl;
    this.logCallback = logCallback || console.log;

    return new Promise((resolve, reject) => {
      try {
        // Check if Socket.IO is loaded
        if (typeof io === 'undefined') {
          const errorMsg = 'Socket.IO not loaded. Please reload the extension.';
          this.logCallback('Error:', errorMsg);
          reject(new Error(errorMsg));
          return;
        }
        
        this.logCallback('Creating Socket.IO connection to:', serverUrl);
        
        // Create Socket.IO connection
        this.socket = io(serverUrl, {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          timeout: 5000
        });
        
        // Connection events
        this.socket.on('connect', () => {
          this.logCallback('Connected to server', { id: this.socket.id });
          this.onConnectCallbacks.forEach(callback => callback(this.socket));
          resolve(this.socket);
        });
        
        this.socket.on('connect_error', (error) => {
          this.logCallback('Connection error', error.message);
          this.onErrorCallbacks.forEach(callback => callback(error));
          reject(error);
        });
        
        this.socket.on('disconnect', (reason) => {
          this.logCallback('Disconnected', reason);
          this.onDisconnectCallbacks.forEach(callback => callback(reason));
        });
      } catch (error) {
        this.logCallback('Error initializing connection', error.message);
        this.onErrorCallbacks.forEach(callback => callback(error));
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check if socket is connected
   * @returns {boolean} - True if connected, false otherwise
   */
  isConnected() {
    return this.socket && this.socket.connected;
  }

  /**
   * Add an event listener for the socket
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {Function} [ack] - Optional acknowledgement callback
   * @returns {boolean} - True if emitted, false otherwise
   */
  emit(event, data, ack) {
    if (this.socket && this.socket.connected) {
      // Debug: Check if the event is zone-added and contains HTML content
      if (event === 'zone-added' && data) {
        console.log('SocketConnectionManager: Emitting zone-added event:', {
          label: data.label,
          elementId: data.elementId,
          hasHtml: !!data.html,
          htmlLength: data.html ? data.html.length : 0
        });
      }
      
      if (typeof ack === 'function') {
        this.socket.emit(event, data, ack);
      } else {
        this.socket.emit(event, data);
      }
      return true;
    }
    
    if (typeof ack === 'function') {
      ack({ error: 'Socket not connected' });
    }
    
    return false;
  }

  /**
   * Add a callback for when socket connects
   * @param {Function} callback - Function to call on connection
   */
  onConnect(callback) {
    this.onConnectCallbacks.push(callback);
  }

  /**
   * Add a callback for when socket disconnects
   * @param {Function} callback - Function to call on disconnection
   */
  onDisconnect(callback) {
    this.onDisconnectCallbacks.push(callback);
  }

  /**
   * Add a callback for connection errors
   * @param {Function} callback - Function to call on error
   */
  onError(callback) {
    this.onErrorCallbacks.push(callback);
  }

  /**
   * Set up tab-related socket events
   * @param {Object} tabManager - Tab manager instance
   */
  setupSocketEvents(tabManager) {
    if (!this.socket) return;
    
    // Browser tabs request
    this.socket.on('get-browser-tabs', (data) => {
      this.logCallback('Received get-browser-tabs request', data);
      
      chrome.tabs.query({}, (tabs) => {
        const tabsData = tabs.map(tab => ({
          id: tab.id,
          windowId: tab.windowId,
          active: tab.active,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl || null,
          index: tab.index,
          selected: tab.id === tabManager.getSelectedTabId()
        }));
        
        this.socket.emit('browser-tabs-response', {
          requestId: data.requestId,
          tabs: tabsData,
          selectedTabId: tabManager.getSelectedTabId()
        });
      });
    });
    
    // Get current tab request
    this.socket.on('get-current-tab', (data) => {
      this.logCallback('Received get-current-tab request', data);
      
      const selectedTabId = tabManager.getSelectedTabId();
      if (!selectedTabId) {
        this.socket.emit('current-tab-error', {
          requestId: data.requestId,
          error: 'No tab is selected'
        });
        return;
      }
      
      chrome.tabs.get(selectedTabId, (tab) => {
        if (chrome.runtime.lastError) {
          this.socket.emit('current-tab-error', {
            requestId: data.requestId,
            error: 'Selected tab no longer exists'
          });
          return;
        }
        
        this.socket.emit('current-tab', {
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
    this.socket.on('browser-navigate', (data) => {
      this.logCallback('Received navigate request', data);
      
      // Only navigate the selected tab
      const selectedTabId = tabManager.getSelectedTabId();
      if (!selectedTabId) {
        this.socket.emit('browser-navigate-error', {
          requestId: data.requestId,
          error: 'No tab is selected for navigation'
        });
        return;
      }
      
      chrome.tabs.get(selectedTabId, (tab) => {
        if (chrome.runtime.lastError) {
          this.socket.emit('browser-navigate-error', {
            requestId: data.requestId,
            error: 'Selected tab no longer exists'
          });
          return;
        }
        
        chrome.tabs.update(selectedTabId, { url: data.url }, (updatedTab) => {
          if (chrome.runtime.lastError) {
            this.socket.emit('browser-navigate-error', {
              requestId: data.requestId,
              error: chrome.runtime.lastError.message
            });
            return;
          }
          
          this.socket.emit('browser-navigate-response', {
            requestId: data.requestId,
            success: true,
            tabId: updatedTab.id,
            url: data.url
          });
        });
      });
    });
    
    // Handle delete-zone events from server
    this.socket.on('delete-zone', (data) => {
      this.logCallback('Received delete-zone request', data);
      
      // Forward to the background script to route to content script
      chrome.runtime.sendMessage({
        type: 'socket-message',
        event: 'delete-zone',
        data: data
      });
    });
  }
}

// Export the class
export default SocketConnectionManager; 