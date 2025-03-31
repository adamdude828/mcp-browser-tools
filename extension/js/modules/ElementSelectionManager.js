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
        this.loadSelectedElements(); // Update the UI
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
}

// Export the class
export default ElementSelectionManager; 