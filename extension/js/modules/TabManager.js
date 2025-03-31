/**
 * Tab Manager
 * Handles browser tab operations and tab selection
 */

class TabManager {
  constructor() {
    this.selectedTabId = null;
    this.previousTabId = null; // Track previous tab ID
    this.tabs = [];
    this.onTabSelectedCallbacks = [];
    this.onTabListUpdatedCallbacks = [];
  }

  /**
   * Initialize the tab manager and set up event listeners
   * @param {Function} logCallback - Function to log messages
   */
  initialize(logCallback) {
    this.logCallback = logCallback || console.log;

    // Listen for tab updates or removals
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (tabId === this.selectedTabId && changeInfo.status === 'loading') {
        // Tab is refreshing, notify listeners
        this.logCallback('Selected tab is refreshing');
        this.onTabSelectedCallbacks.forEach(callback => callback(null, 'refresh'));
        
        // Clear any highlights that might remain
        this._clearPreviousTabHighlights();
      }
      
      // If it was a complete update, refresh our tabs list
      if (changeInfo.status === 'complete') {
        this.loadTabs();
      }
    });
    
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId === this.selectedTabId) {
        // Selected tab was closed
        this.selectedTabId = null;
        this.logCallback('Selected tab was closed');
        this.onTabSelectedCallbacks.forEach(callback => callback(null, 'closed'));
      }
      
      // Refresh our tabs list
      this.loadTabs();
    });
  }

  /**
   * Get the currently selected tab ID
   * @returns {number|null} - The selected tab ID or null if none
   */
  getSelectedTabId() {
    return this.selectedTabId;
  }

  /**
   * Get all tabs in the browser
   * @returns {Array} - Array of tab objects
   */
  getTabs() {
    return this.tabs;
  }

  /**
   * Get a tab by ID
   * @param {number} tabId - The tab ID to get
   * @returns {Promise} - Resolves with the tab or rejects with an error
   */
  getTabById(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(tab);
      });
    });
  }

  /**
   * Load and cache all tabs
   * @returns {Promise} - Resolves with array of tabs
   */
  loadTabs() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        this.tabs = tabs;
        this.onTabListUpdatedCallbacks.forEach(callback => callback(tabs));
        resolve(tabs);
      });
    });
  }

  /**
   * Select a tab
   * @param {Object|number} tabOrId - The tab object or tab ID to select
   * @returns {Promise} - Resolves with selected tab or rejects with error
   */
  selectTab(tabOrId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Store previous tab ID before updating
        this.previousTabId = this.selectedTabId;
        
        let tab;
        if (typeof tabOrId === 'number') {
          tab = await this.getTabById(tabOrId);
        } else {
          tab = tabOrId;
        }
        
        // If we had a previous tab, clear any element highlights on it
        if (this.previousTabId && this.previousTabId !== tab.id) {
          this._clearPreviousTabHighlights();
        }
        
        // Update selected tab ID
        this.selectedTabId = tab.id;
        this.logCallback('Selected tab', { id: tab.id, title: tab.title });
        
        // Notify listeners
        this.onTabSelectedCallbacks.forEach(callback => callback(tab));
        
        resolve(tab);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Clear any element highlights on the previously selected tab
   * @private
   */
  _clearPreviousTabHighlights() {
    if (!this.previousTabId) return;
    
    // Try to send a message to clear highlights
    this.logCallback('Clearing highlights on previous tab', { tabId: this.previousTabId });
    
    chrome.tabs.sendMessage(this.previousTabId, { type: 'clear-all-highlights' }, (response) => {
      // We don't need to do anything with the response, and we don't want to throw
      // any errors if the message can't be delivered (e.g., if the tab was closed)
      if (chrome.runtime.lastError) {
        // Tab might be closed or not have content script
        this.logCallback('Could not clear previous tab highlights', chrome.runtime.lastError.message);
      } else if (response && response.success) {
        this.logCallback('Cleared highlights on previous tab');
      }
    });
  }

  /**
   * Get the previously selected tab ID
   * @returns {number|null} - The previous tab ID or null if none
   */
  getPreviousTabId() {
    return this.previousTabId;
  }

  /**
   * Navigate the selected tab to a URL
   * @param {string} url - The URL to navigate to
   * @returns {Promise} - Resolves with updated tab or rejects with error
   */
  navigate(url) {
    return new Promise((resolve, reject) => {
      if (!this.selectedTabId) {
        reject(new Error('No tab selected'));
        return;
      }
      
      chrome.tabs.update(this.selectedTabId, { url }, (updatedTab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        resolve(updatedTab);
      });
    });
  }

  /**
   * Add a callback for when a tab is selected
   * @param {Function} callback - Function to call on tab selection
   */
  onTabSelected(callback) {
    this.onTabSelectedCallbacks.push(callback);
  }

  /**
   * Add a callback for when the tab list is updated
   * @param {Function} callback - Function to call on tab list update
   */
  onTabListUpdated(callback) {
    this.onTabListUpdatedCallbacks.push(callback);
  }

  /**
   * Send a message to the selected tab
   * @param {Object} message - Message to send
   * @returns {Promise} - Resolves with response or rejects with error
   */
  sendMessageToSelectedTab(message) {
    this.logCallback('🔍 DEBUG: TabManager - sendMessageToSelectedTab', message);
    
    return new Promise((resolve, reject) => {
      if (!this.selectedTabId) {
        this.logCallback('🚨 ERROR: TabManager - Cannot send message: No tab selected');
        reject(new Error('No tab selected'));
        return;
      }
      
      this.logCallback('🔍 DEBUG: TabManager - Sending message to tab', { tabId: this.selectedTabId, message });
      
      try {
        chrome.tabs.sendMessage(this.selectedTabId, message, (response) => {
          if (chrome.runtime.lastError) {
            this.logCallback('🚨 ERROR: TabManager - Error sending message to tab', { 
              tabId: this.selectedTabId, 
              error: chrome.runtime.lastError.message 
            });
            reject(chrome.runtime.lastError);
            return;
          }
          
          if (!response) {
            this.logCallback('⚠️ WARNING: TabManager - Received empty response from tab', this.selectedTabId);
          } else {
            this.logCallback('🔍 DEBUG: TabManager - Received response from tab', { 
              tabId: this.selectedTabId, 
              response 
            });
          }
          
          resolve(response);
        });
      } catch (error) {
        this.logCallback('🚨 ERROR: TabManager - Exception sending message to tab', { 
          tabId: this.selectedTabId, 
          error: error.message 
        });
        reject(error);
      }
    });
  }

  /**
   * Execute script in the selected tab
   * @param {Object} options - Script execution options
   * @returns {Promise} - Resolves with result or rejects with error
   */
  executeScript(options) {
    return new Promise((resolve, reject) => {
      if (!this.selectedTabId) {
        reject(new Error('No tab selected'));
        return;
      }
      
      const scriptOptions = {
        target: { tabId: this.selectedTabId },
        ...options
      };
      
      chrome.scripting.executeScript(scriptOptions)
        .then(result => resolve(result))
        .catch(error => reject(error));
    });
  }
}

// Export the class
export default TabManager; 