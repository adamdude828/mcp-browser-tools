/**
 * UIUtils.js
 * Provides utilities for UI updates, logging, and error handling
 */

class UIUtils {
  constructor() {
    // Cache DOM elements
    this.statusMessage = document.getElementById('statusMessage');
    this.connectBtn = document.getElementById('connectBtn');
    this.disconnectBtn = document.getElementById('disconnectBtn');
    this.currentUrl = document.getElementById('currentUrl');
    this.debugInfo = document.getElementById('debugInfo');
    this.debugToggle = document.getElementById('debugToggle');
    
    // Set up debug toggle
    this.setupDebugToggle();
    
    // Initialize the logs array
    this.logs = [];
    
    // Update URL every 2 seconds while popup is open
    setInterval(() => this.getCurrentTabUrl(), 2000);
    
    // Update debug info periodically
    setInterval(() => this.updateDebugInfo(), 1000);
  }

  /**
   * Set up debug toggle button event handler
   */
  setupDebugToggle() {
    this.debugToggle.addEventListener('click', () => {
      if (this.debugInfo.style.display === 'none') {
        this.debugInfo.style.display = 'block';
        this.debugToggle.textContent = 'Hide Debug Info';
        this.updateDebugInfo();
      } else {
        this.debugInfo.style.display = 'none';
        this.debugToggle.textContent = 'Show Debug Info';
      }
    });
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    this.statusMessage.textContent = message;
    this.statusMessage.style.color = '#F44336'; // Red
    this.log('Error', message);
  }

  /**
   * Update UI based on connection status
   * @param {boolean} isConnected - Connection status
   * @param {string} serverUrl - Server URL
   * @param {string} customStatusText - Optional custom status text
   */
  updateUI(isConnected, serverUrl, customStatusText = null) {
    if (isConnected) {
      this.statusMessage.textContent = customStatusText || `Connected to ${serverUrl}`;
      this.statusMessage.style.color = '#4CAF50'; // Green
      this.connectBtn.disabled = true;
      this.disconnectBtn.disabled = false;
    } else {
      this.statusMessage.textContent = customStatusText || 'Not connected';
      if (!customStatusText) {
        this.statusMessage.style.color = '#F44336'; // Red
      }
      this.connectBtn.disabled = false;
      this.disconnectBtn.disabled = true;
    }
  }

  /**
   * Set status message color
   * @param {string} color - CSS color string
   */
  setStatusColor(color) {
    this.statusMessage.style.color = color;
  }

  /**
   * Get current tab URL
   */
  getCurrentTabUrl() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        this.currentUrl.textContent = tabs[0].url;
      } else {
        this.currentUrl.textContent = 'No active tab';
      }
    });
  }

  /**
   * Update debug info
   * @param {Object} data - Optional data to include in debug info
   */
  updateDebugInfo(data) {
    if (this.debugInfo.style.display === 'none') return;
    
    let info = '';
    
    // Add timestamp
    info += `Time: ${new Date().toISOString()}\n`;
    
    // Check Socket.IO availability
    info += `Socket.IO loaded: ${typeof io !== 'undefined' ? 'Yes' : 'No'}\n`;
    
    // Add extension info
    info += `Extension ID: ${chrome.runtime.id}\n`;
    
    // Add server URL
    const serverUrlInput = document.getElementById('serverUrl');
    info += `Server URL: ${serverUrlInput.value}\n`;
    
    // Add connection status
    chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
      if (response) {
        info += `Connected: ${response.isConnected ? 'Yes' : 'No'}\n`;
        if (response.error) {
          info += `Error: ${response.error}\n`;
        }
      }
      
      // Add custom data if provided
      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          if (key !== 'isConnected' && key !== 'error') {
            info += `${key}: ${value}\n`;
          }
        });
      }
      
      // Element selection status
      info += `Element selection mode: ${window.selectionManager?.isSelectionModeActive() ? 'Active' : 'Inactive'}\n`;
      
      // Display logs
      info += '\nRecent logs:\n';
      this.logs.slice(-5).forEach(log => {
        info += `${log.time} - ${log.message}\n`;
        if (log.data) {
          info += `  ${JSON.stringify(log.data).substring(0, 100)}\n`;
        }
      });
      
      this.debugInfo.textContent = info;
    });
  }

  /**
   * Log message to console with optional data
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  log(message, data) {
    const logEntry = {
      time: new Date().toISOString().split('T')[1].split('.')[0],
      message,
      data
    };
    this.logs.push(logEntry);
    // Keep only the last 20 logs
    if (this.logs.length > 20) {
      this.logs.shift();
    }
    console.log(message, data);
  }
}

export default UIUtils; 