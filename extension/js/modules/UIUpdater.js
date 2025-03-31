/**
 * UI Updater
 * Handles UI updates and rendering
 */

class UIUpdater {
  constructor() {
    this.logEntries = [];
    this.maxLogEntries = 50;
  }

  /**
   * Initialize the UI updater
   */
  initialize() {
    // Nothing to do here for now
  }

  /**
   * Update UI based on connection status
   * @param {boolean} isConnected - Whether socket is connected
   * @param {string} serverUrl - Server URL
   * @param {string} customStatusText - Custom status text (optional)
   */
  updateConnectionStatus(isConnected, serverUrl, customStatusText = null) {
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

  /**
   * Show an error message
   * @param {string} message - Error message to show
   */
  showError(message) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = 'status-error';
    this.log('Error', message);
  }

  /**
   * Log a message to the UI
   * @param {string} message - Message to log
   * @param {any} data - Additional data to log (optional)
   */
  log(message, data) {
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
    while (logs.children.length > this.maxLogEntries) {
      logs.removeChild(logs.lastChild);
    }
    
    // Also log to console
    console.log(message, data);
    
    // Keep a copy in our array
    this.logEntries.unshift({ message, data, timestamp });
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries.pop();
    }
  }

  /**
   * Update the tabs list in the UI
   * @param {Array} tabs - Array of tabs
   * @param {number} selectedTabId - ID of the currently selected tab
   * @param {Function} selectTabCallback - Callback to call when a tab is selected
   */
  updateTabsList(tabs, selectedTabId, selectTabCallback) {
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
        selectTabCallback(tab);
      });
    });
  }

  /**
   * Update the active tab display
   * @param {Object} tab - The active tab
   */
  updateActiveTabDisplay(tab) {
    const activeTabDiv = document.getElementById('activeTab');
    
    if (!tab) {
      activeTabDiv.innerHTML = '<p>No tab selected</p>';
      return;
    }
    
    activeTabDiv.innerHTML = `
      <div class="active-tab-info">
        <img src="${tab.favIconUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="%23757575" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>'}" alt="Tab icon">
        <div>
          <div class="tab-title">${tab.title}</div>
          <div class="tab-url">${tab.url}</div>
        </div>
      </div>
    `;
  }

  /**
   * Update the selection button text based on mode
   * @param {boolean} selectionModeActive - Whether selection mode is active
   */
  updateSelectionButton(selectionModeActive) {
    const selectionBtn = document.getElementById('startSelectionBtn');
    
    if (selectionModeActive) {
      selectionBtn.textContent = 'Done Selecting';
      selectionBtn.classList.remove('primary');
      selectionBtn.classList.add('warning');
      selectionBtn.style.backgroundColor = '#FF9800'; // Orange
    } else {
      selectionBtn.textContent = 'Start Selection Mode';
      selectionBtn.classList.add('primary');
      selectionBtn.classList.remove('warning');
      selectionBtn.style.backgroundColor = ''; // Reset to default primary color
    }
  }

  /**
   * Update the highlight button text based on state
   * @param {boolean} elementsHighlighted - Whether elements are highlighted
   */
  updateHighlightButton(elementsHighlighted) {
    const highlightBtn = document.getElementById('highlightAllBtn');
    
    if (elementsHighlighted) {
      highlightBtn.textContent = 'Hide All';
      highlightBtn.classList.remove('secondary');
      highlightBtn.classList.add('neutral');
      highlightBtn.style.backgroundColor = '#9E9E9E'; // Gray
    } else {
      highlightBtn.textContent = 'Highlight All';
      highlightBtn.classList.add('secondary');
      highlightBtn.classList.remove('neutral');
      highlightBtn.style.backgroundColor = ''; // Reset to default secondary color
    }
  }

  /**
   * Display selected elements in the UI
   * @param {Array} elements - Array of selected elements
   */
  displaySelectedElements(elements) {
    const container = document.getElementById('selectedElementsList');
    
    if (!elements || elements.length === 0) {
      container.innerHTML = '<p>No elements selected yet.</p>';
      return;
    }
    
    // Sort elements by timestamp (newest first)
    elements.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // Create HTML
    container.innerHTML = '';
    
    // Add count header
    const header = document.createElement('div');
    header.className = 'elements-header';
    header.innerHTML = `<strong>${elements.length} element(s) selected</strong>`;
    container.appendChild(header);
    
    // Add each element
    elements.forEach((element, index) => {
      const elementItem = document.createElement('div');
      elementItem.className = 'element-item';
      elementItem.dataset.elementId = element.elementId;
      
      // Create a container for the label and delete button
      const labelContainer = document.createElement('div');
      labelContainer.className = 'element-label-container';
      labelContainer.style.display = 'flex';
      labelContainer.style.justifyContent = 'space-between';
      labelContainer.style.alignItems = 'center';
      labelContainer.style.marginBottom = '5px';
      
      // Create label
      const elementLabel = document.createElement('div');
      elementLabel.className = 'element-label';
      elementLabel.textContent = `${index + 1}. ${element.label}`;
      labelContainer.appendChild(elementLabel);
      
      // Create delete button
      const deleteButton = document.createElement('button');
      deleteButton.className = 'element-delete-btn';
      deleteButton.textContent = 'Delete';
      deleteButton.style.backgroundColor = '#f44336';
      deleteButton.style.color = 'white';
      deleteButton.style.border = 'none';
      deleteButton.style.borderRadius = '4px';
      deleteButton.style.padding = '3px 8px';
      deleteButton.style.fontSize = '12px';
      deleteButton.style.cursor = 'pointer';
      
      // Add event listener to delete button
      deleteButton.addEventListener('click', (event) => {
        event.preventDefault();
        // Send message to content script to delete this element
        chrome.tabs.sendMessage(
          chrome.devtools ? chrome.devtools.inspectedWindow.tabId : chrome.tabs.TAB_ID_NONE,
          { 
            type: 'delete-element',
            elementId: element.elementId
          }
        );
      });
      
      labelContainer.appendChild(deleteButton);
      elementItem.appendChild(labelContainer);
      
      const elementInfo = document.createElement('div');
      elementInfo.className = 'element-info';
      elementInfo.textContent = `${element.tagName || 'Unknown'} • ${element.cssSelector || 'No selector'}`;
      
      elementItem.appendChild(elementInfo);
      container.appendChild(elementItem);
    });
  }
}

// Export the class
export default UIUpdater; 