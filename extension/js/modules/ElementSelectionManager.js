/**
 * Element Selection Manager
 * Handles element selection mode and operations
 */

class ElementSelectionManager {
  constructor(tabManager, uiUpdater) {
    this.tabManager = tabManager;
    this.uiUpdater = uiUpdater;
    this.selectionModeActive = false;
    this.elementsHighlighted = false;
    this.selectedElements = [];
    this.serverUrl = '';
  }

  /**
   * Initialize the element selection manager
   * @param {Function} logCallback - Function to log messages
   */
  initialize(logCallback) {
    this.logCallback = logCallback || console.log;
    
    this.logCallback('🔍 DEBUG: ElementSelectionManager - initializing');
    
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.logCallback('🔍 DEBUG: ElementSelectionManager - received message', message);
      
      if (message.type === 'element-selected') {
        // An element was selected in the content script
        this.logCallback('🔍 DEBUG: Element selected in tab', message.data);
        this.loadSelectedElements() // Update the UI
          .then(elements => {
            // Find the newly selected element
            const newElement = elements.find(el => el.elementId === message.data.elementId);
            if (newElement) {
              // Automatically capture screenshot for the newly selected element
              this.logCallback('🔍 DEBUG: Automatically capturing screenshot for new element', newElement.elementId);
              this.captureElementScreenshot(newElement.elementId)
                .then(result => {
                  this.logCallback('🔍 DEBUG: Auto-screenshot captured successfully', result);
                })
                .catch(error => {
                  this.logCallback('🔍 DEBUG: Auto-screenshot capture failed', error.message);
                });
            }
          });
        return true;
      }
      
      if (message.type === 'element-deleted') {
        // A single element was deleted in the content script
        this.logCallback('🔍 DEBUG: Element deleted in tab', message.elementId);
        this.loadSelectedElements(); // Update the UI with the deleted element removed
        return true;
      }
      
      if (message.type === 'elements-cleared') {
        // Elements were cleared in the content script
        this.logCallback('🔍 DEBUG: Elements cleared in tab due to: ' + message.reason);
        this.loadSelectedElements(); // Update the UI (will show empty list)
        return true;
      }
      
      return false;
    });
    
    this.logCallback('🔍 DEBUG: ElementSelectionManager - initialized successfully');
  }

  /**
   * Toggle selection mode
   * @returns {Promise} - Resolves with the new selection mode state
   */
  toggleSelectionMode() {
    this.logCallback('🔍 DEBUG: ========== TOGGLE SELECTION MODE STARTED ==========');
    this.logCallback('🔍 DEBUG: Current selection mode state:', this.selectionModeActive);
    
    return new Promise(async (resolve, reject) => {
      if (!this.tabManager.getSelectedTabId()) {
        this.logCallback('🚨 ERROR: Cannot toggle selection mode: No tab selected');
        reject(new Error('No tab selected'));
        return;
      }
      
      const selectedTabId = this.tabManager.getSelectedTabId();
      this.logCallback('🔍 DEBUG: Selected tab ID for toggle:', selectedTabId);
      
      try {
        // If we're already in selection mode, clicking "Done Selecting" should stop it
        if (this.selectionModeActive) {
          this.logCallback('🔍 DEBUG: Deactivating selection mode');
          this.selectionModeActive = false;
          this.uiUpdater.updateSelectionButton(this.selectionModeActive);
          
          // Send toggle message to content script to deactivate selection mode
          try {
            this.logCallback('🔍 DEBUG: Sending deactivate message to tab', selectedTabId);
            const response = await this.tabManager.sendMessageToSelectedTab({ type: 'toggle-selection-mode' });
            
            if (response && response.success) {
              this.logCallback('🔍 DEBUG: Selection mode deactivated successfully');
            } else {
              this.logCallback('⚠️ WARNING: Incomplete response from deactivation attempt', response);
            }
          } catch (error) {
            this.logCallback('🚨 ERROR: Error communicating with content script:', error.message);
            // Continue anyway with UI updates
          }
          
          this.logCallback('🔍 DEBUG: Selection mode toggle complete (OFF)');
          resolve(this.selectionModeActive);
          return;
        }
        
        // Otherwise, start selection mode
        this.logCallback('🔍 DEBUG: Attempting to activate selection mode');
        
        try {
          // Let the background script handle content script injection
          this.logCallback('🔍 DEBUG: Sending toggle-selection-mode message to tab', selectedTabId);
          const response = await this.tabManager.sendMessageToSelectedTab({ type: 'toggle-selection-mode' });
          
          if (!response) {
            this.logCallback('🚨 ERROR: Empty response from content script');
            throw new Error('Empty response from content script');
          }
          
          this.logCallback('🔍 DEBUG: Received response from content script:', response);
          
          if (!response.success) {
            this.logCallback('🚨 ERROR: Content script reported error:', response.error || 'Unknown error');
            throw new Error(`Content script reported error: ${response.error || 'Unknown error'}`);
          }
          
          // Toggle the selection mode state
          this.selectionModeActive = response.selectionMode;
          this.logCallback('🔍 DEBUG: Selection mode toggled:', this.selectionModeActive ? 'ON' : 'OFF');
          
          // Update button text
          this.uiUpdater.updateSelectionButton(this.selectionModeActive);
          
          // When selection mode is activated, elements are automatically highlighted
          if (this.selectionModeActive) {
            this.elementsHighlighted = true;
            this.uiUpdater.updateHighlightButton(this.elementsHighlighted);
            this.logCallback('🔍 DEBUG: Highlight mode also activated');
          }
          
          this.logCallback('🔍 DEBUG: ========== TOGGLE SELECTION MODE COMPLETED ==========');
          resolve(this.selectionModeActive);
        } catch (error) {
          this.logCallback('🚨 ERROR: Error activating selection mode:', error.message);
          this.logCallback('🔍 DEBUG: ========== TOGGLE SELECTION MODE FAILED ==========');
          reject(error);
        }
      } catch (error) {
        this.logCallback('🚨 ERROR: Unexpected error toggling selection mode:', error.message);
        this.logCallback('🔍 DEBUG: ========== TOGGLE SELECTION MODE FAILED ==========');
        reject(error);
      }
    });
  }

  /**
   * Toggle highlight for all selected elements
   * @returns {Promise} - Resolves with the new highlight state
   */
  toggleHighlightElements() {
    return new Promise(async (resolve, reject) => {
      if (!this.tabManager.getSelectedTabId()) {
        this.logCallback('Cannot highlight elements: No tab selected');
        reject(new Error('No tab selected'));
        return;
      }
      
      try {
        // Toggle between highlight and hide
        if (this.elementsHighlighted) {
          // If elements are already highlighted, hide them
          const response = await this.tabManager.sendMessageToSelectedTab({ type: 'hide-all-elements' });
          
          if (response && response.success) {
            this.logCallback('All elements hidden');
            this.elementsHighlighted = false;
            this.uiUpdater.updateHighlightButton(this.elementsHighlighted);
            resolve(this.elementsHighlighted);
          } else {
            reject(new Error('Failed to hide elements'));
          }
        } else {
          // If elements are hidden, highlight them
          const response = await this.tabManager.sendMessageToSelectedTab({ type: 'highlight-all-elements' });
          
          if (response && response.success) {
            this.logCallback('All elements highlighted');
            this.elementsHighlighted = true;
            this.uiUpdater.updateHighlightButton(this.elementsHighlighted);
            resolve(this.elementsHighlighted);
          } else {
            reject(new Error('Failed to highlight elements'));
          }
        }
      } catch (error) {
        this.logCallback('Error highlighting elements: Content script not available');
        reject(error);
      }
    });
  }

  /**
   * Clear all selected elements
   * @returns {Promise} - Resolves when elements are cleared
   */
  clearAllElements() {
    return new Promise(async (resolve, reject) => {
      if (!this.tabManager.getSelectedTabId()) {
        this.logCallback('Cannot clear elements: No tab selected');
        reject(new Error('No tab selected'));
        return;
      }
      
      try {
        const response = await this.tabManager.sendMessageToSelectedTab({ type: 'clear-selected-elements' });
        
        if (response && response.success) {
          this.logCallback('All elements cleared');
          this.selectedElements = [];
          this.uiUpdater.displaySelectedElements([]);
          
          // Reset highlight state since there are no elements to highlight anymore
          this.elementsHighlighted = false;
          this.uiUpdater.updateHighlightButton(this.elementsHighlighted);
          
          resolve();
        } else {
          reject(new Error('Failed to clear elements'));
        }
      } catch (error) {
        this.logCallback('Error clearing elements: Content script not available');
        reject(error);
      }
    });
  }

  /**
   * Load selected elements from the current tab
   * @returns {Promise} - Resolves with array of elements
   */
  loadSelectedElements() {
    return new Promise(async (resolve, reject) => {
      if (!this.tabManager.getSelectedTabId()) {
        this.selectedElements = [];
        this.uiUpdater.displaySelectedElements([]);
        resolve([]);
        return;
      }
      
      try {
        const response = await this.tabManager.sendMessageToSelectedTab({ type: 'get-selected-elements' });
        
        if (response && response.elements) {
          this.selectedElements = response.elements;
          this.uiUpdater.displaySelectedElements(this.selectedElements);
          resolve(this.selectedElements);
        } else {
          this.selectedElements = [];
          this.uiUpdater.displaySelectedElements([]);
          resolve([]);
        }
      } catch (error) {
        this.selectedElements = [];
        this.uiUpdater.displaySelectedElements([]);
        resolve([]);
      }
    });
  }

  /**
   * Get the current selection mode state
   * @returns {boolean} - True if selection mode is active
   */
  isSelectionModeActive() {
    return this.selectionModeActive;
  }

  /**
   * Get the current highlight state
   * @returns {boolean} - True if elements are highlighted
   */
  areElementsHighlighted() {
    return this.elementsHighlighted;
  }

  /**
   * Reset the selection mode state (e.g., when a tab is refreshed)
   */
  resetSelectionMode() {
    this.selectionModeActive = false;
    this.elementsHighlighted = false; // Also reset the highlight state
    this.uiUpdater.updateSelectionButton(this.selectionModeActive);
    this.uiUpdater.updateHighlightButton(this.elementsHighlighted);
  }

  /**
   * Set the server URL for screenshot uploads
   * @param {string} url - Server URL
   */
  setServerUrl(url) {
    this.serverUrl = url;
  }

  /**
   * Capture screenshot of a selected element
   * @param {string} elementId - ID of the element to screenshot
   * @returns {Promise} - Resolves when screenshot is taken and uploaded
   */
  captureElementScreenshot(elementId) {
    return new Promise(async (resolve, reject) => {
      if (!this.tabManager.getSelectedTabId()) {
        this.logCallback('Cannot capture screenshot: No tab selected');
        reject(new Error('No tab selected'));
        return;
      }
      
      // Make sure we have a server URL
      if (!this.serverUrl) {
        // Try to infer the server URL if not set
        try {
          // If socket.io is connected, extract the base URL
          if (window.io && window.io.managers) {
            // Get the first socket manager URL
            for (const url in window.io.managers) {
              if (Object.prototype.hasOwnProperty.call(window.io.managers, url)) {
                this.serverUrl = url.replace(/\/socket\.io\/?$/, '');
                this.logCallback('Inferred server URL:', this.serverUrl);
                break;
              }
            }
          }
        } catch (error) {
          this.logCallback('Failed to infer server URL:', error.message);
        }
        
        if (!this.serverUrl) {
          this.logCallback('No server URL set for screenshot upload');
          reject(new Error('No server URL set for screenshot upload'));
          return;
        }
      }
      
      try {
        // Send message to content script to capture screenshot
        this.logCallback('Sending capture-element-screenshot message for element:', elementId);
        const response = await this.tabManager.sendMessageToSelectedTab({ 
          type: 'capture-element-screenshot', 
          elementId: elementId
        });
        
        if (response && response.success && response.imageData) {
          this.logCallback('Screenshot captured successfully, image data length:', response.imageData.length);
          
          // Upload the screenshot to the server via REST
          try {
            const uploadUrl = `${this.serverUrl}/api/screenshots`;
            this.logCallback('Uploading screenshot to:', uploadUrl);
            
            // Log data being sent
            this.logCallback('Screenshot POST data:', { 
              elementId, 
              imageDataLength: response.imageData ? response.imageData.length : 0,
              imageDataStart: response.imageData ? response.imageData.substring(0, 50) + '...' : 'none'
            });
            
            const uploadResponse = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                elementId: elementId,
                imageData: response.imageData
              })
            });
            
            this.logCallback('Screenshot upload response status:', uploadResponse.status);
            
            if (uploadResponse.ok) {
              const result = await uploadResponse.json();
              this.logCallback('Screenshot uploaded successfully:', result);
              resolve(result);
            } else {
              const error = await uploadResponse.text();
              this.logCallback('Failed to upload screenshot:', error);
              
              // Try the alternate endpoint as a fallback
              const alternateUrl = `${this.serverUrl}/api/zones/${elementId}/screenshot`;
              this.logCallback('Trying alternate endpoint:', alternateUrl);
              
              const alternateResponse = await fetch(alternateUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  screenshot: response.imageData
                })
              });
              
              if (alternateResponse.ok) {
                const alternateResult = await alternateResponse.json();
                this.logCallback('Screenshot uploaded successfully to alternate endpoint:', alternateResult);
                resolve(alternateResult);
              } else {
                const alternateError = await alternateResponse.text();
                this.logCallback('Failed to upload screenshot to alternate endpoint:', alternateError);
                reject(new Error(`Failed to upload screenshot: ${alternateError}`));
              }
            }
          } catch (uploadError) {
            this.logCallback('Error uploading screenshot:', uploadError.message);
            reject(uploadError);
          }
        } else {
          const errorMsg = (response && response.error) || 'Unknown error capturing screenshot';
          this.logCallback('Failed to capture screenshot:', errorMsg);
          reject(new Error(errorMsg));
        }
      } catch (error) {
        this.logCallback('Error capturing screenshot:', error.message);
        reject(error);
      }
    });
  }
}

// Export the class
export default ElementSelectionManager; 