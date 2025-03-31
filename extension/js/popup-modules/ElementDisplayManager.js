/**
 * ElementDisplayManager.js
 * Manages the display and management of selected elements in the popup
 */

class ElementDisplayManager {
  constructor(uiUtils) {
    this.uiUtils = uiUtils;
    this.selectedElements = [];
    
    // Cache DOM elements
    this.selectedElementsContainer = document.getElementById('selectedElements');
    this.highlightAllBtn = document.getElementById('highlightAllBtn');
    this.clearSelectionsBtn = document.getElementById('clearSelectionsBtn');
    
    // Set up event listeners
    this.highlightAllBtn.addEventListener('click', () => this.highlightAllElements());
    this.clearSelectionsBtn.addEventListener('click', () => this.clearAllSelections());
    
    // Listen for elements-cleared event
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'elements-cleared') {
        console.log('Elements cleared due to:', message.reason);
        this.loadSelectedElements(); // Reload (empty) elements
      }
    });
    
    // Set up message listener for element selection
    this.setupMessageListeners();
  }

  /**
   * Setup message listeners
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'element-selected') {
        // Refresh the selected elements list
        this.loadSelectedElements();
        
        // Forward to server if connected (this will be handled by ConnectionManager)
      }
    });
  }

  /**
   * Load selected elements from content script
   */
  loadSelectedElements() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error('No active tab found');
        this.displaySelectedElements([]); // Show empty list
        return;
      }
      
      const activeTab = tabs[0];
      
      // Check if we can access the tab
      if (!activeTab.url || activeTab.url.startsWith('chrome://')) {
        console.error('Cannot access this page - restricted URL');
        this.displaySelectedElements([]); // Show empty list
        return;
      }
      
      chrome.tabs.sendMessage(activeTab.id, { type: 'get-selected-elements' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting elements:', chrome.runtime.lastError);
          this.displaySelectedElements([]); // Show empty list
          return;
        }
        
        // Process the elements into the format we need
        const elements = response.elements.map(element => ({
          id: element.id,
          label: element.label,
          cssSelector: element.cssSelector,
          xpath: element.xpath,
          tagName: element.cssSelector.split(' ')[0], // Extract tag from selector
          timestamp: element.timestamp
        }));
        
        this.selectedElements = elements;
        this.displaySelectedElements(elements);
      });
    });
  }

  /**
   * Display selected elements in the UI
   * @param {Array} elements - List of selected elements
   */
  displaySelectedElements(elements) {
    this.selectedElementsContainer.innerHTML = '';
    
    if (elements.length === 0) {
      this.selectedElementsContainer.innerHTML = '<p>No elements selected yet.</p>';
      return;
    }
    
    // Sort elements by timestamp (newest first)
    elements.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // Create header for the list
    const header = document.createElement('div');
    header.className = 'element-list-header';
    header.innerHTML = `<strong>${elements.length} element(s) selected</strong>`;
    this.selectedElementsContainer.appendChild(header);
    
    elements.forEach((element, index) => {
      const elementItem = document.createElement('div');
      elementItem.className = 'element-item';
      
      const elementLabel = document.createElement('div');
      elementLabel.className = 'element-label';
      elementLabel.textContent = `${index + 1}. ${element.label}`;
      
      const elementInfo = document.createElement('div');
      elementInfo.className = 'element-info';
      elementInfo.textContent = `${element.tagName || 'Unknown'} • ${element.cssSelector || 'No selector'}`;
      
      elementItem.appendChild(elementLabel);
      elementItem.appendChild(elementInfo);
      this.selectedElementsContainer.appendChild(elementItem);
    });
  }

  /**
   * Highlight all selected elements on the current page
   */
  highlightAllElements() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];
      
      // Check if we can access the tab
      if (!activeTab.url || activeTab.url.startsWith('chrome://')) {
        this.uiUtils.showError('Cannot access this page - restricted URL');
        return;
      }
      
      chrome.tabs.sendMessage(activeTab.id, { type: 'highlight-all-elements' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error highlighting elements:', chrome.runtime.lastError);
          return;
        }
        
        this.uiUtils.log('Highlighted all selected elements');
      });
    });
  }

  /**
   * Clear all selections on the current page
   */
  clearAllSelections() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];
      
      // Check if we can access the tab
      if (!activeTab.url || activeTab.url.startsWith('chrome://')) {
        this.uiUtils.showError('Cannot access this page - restricted URL');
        return;
      }
      
      chrome.tabs.sendMessage(activeTab.id, { type: 'clear-selected-elements' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing elements:', chrome.runtime.lastError);
          return;
        }
        
        // Update the display
        this.loadSelectedElements();
        
        this.uiUtils.log('Cleared all selected elements');
      });
    });
  }

  /**
   * Get the list of selected elements
   * @returns {Array} The list of selected elements
   */
  getSelectedElements() {
    return this.selectedElements;
  }
}

export default ElementDisplayManager; 