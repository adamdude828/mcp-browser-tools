/**
 * UI Updater
 * Handles UI updates and rendering
 */

class UIUpdater {
  constructor() {
    this.logEntries = [];
    this.maxLogEntries = 50;
    this.tabId = null;
  }

  /**
   * Initialize the UI updater
   */
  initialize() {
    // Nothing to do here for now
  }

  /**
   * Set the current tab ID
   * @param {number} tabId - The tab ID
   */
  setTabId(tabId) {
    this.tabId = tabId;
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
    const selectedElementsList = document.getElementById('selectedElementsList');
    if (!selectedElementsList) {
      console.warn('⚠️ WARNING: Cannot find selected elements list element');
      if (this.log) {
        this.log('⚠️ WARNING: Cannot find selected elements list element');
      }
      return;
    }

    // Clear the list
    selectedElementsList.innerHTML = '';

    if (!elements || elements.length === 0) {
      // If no elements, show a placeholder message
      const noElementsItem = document.createElement('div');
      noElementsItem.className = 'no-elements-message';
      noElementsItem.textContent = 'No elements selected. Click "Select Elements" to begin.';
      selectedElementsList.appendChild(noElementsItem);
      return;
    }

    // Add each element to the list
    elements.forEach(element => {
      const elementItem = document.createElement('div');
      elementItem.className = 'selected-element-item element-item';
      elementItem.dataset.elementId = element.elementId;

      // Create the label
      const labelSpan = document.createElement('span');
      labelSpan.className = 'element-label';
      labelSpan.textContent = element.label || `Element ${element.elementId.substring(0, 6)}...`;
      elementItem.appendChild(labelSpan);

      // Create the tag info
      const tagInfo = document.createElement('span');
      tagInfo.className = 'element-tag-info';
      tagInfo.textContent = element.tagName || '';
      elementItem.appendChild(tagInfo);

      // Create delete button
      const deleteButton = document.createElement('button');
      deleteButton.className = 'element-delete-button';
      deleteButton.setAttribute('title', 'Delete this element');
      deleteButton.textContent = '×';
      deleteButton.onclick = async (e) => {
        e.stopPropagation(); // Prevent triggering the element's click event
        if (this.log) {
          this.log(`Deleting element ${element.elementId}`);
        } else {
          console.log(`Deleting element ${element.elementId}`);
        }
        
        try {
          // Send a message to delete this element
          const tab = await chrome.tabs.get(this.tabId);
          if (!tab) {
            if (this.log) {
              this.log('No tab found to delete element');
            }
            return;
          }
          
          chrome.tabs.sendMessage(this.tabId, {
            type: 'delete-element',
            elementId: element.elementId
          }, response => {
            if (chrome.runtime.lastError) {
              if (this.log) {
                this.log(`Error deleting element: ${chrome.runtime.lastError.message}`);
              }
              return;
            }
            
            if (response && response.success) {
              if (this.log) {
                this.log(`Element deleted: ${element.elementId}`);
              }
              // The content script will send a message that will trigger reloading elements
            } else {
              if (this.log) {
                this.log(`Failed to delete element: ${element.elementId}`, response ? response.error : 'Unknown error');
              }
            }
          });
        } catch (error) {
          if (this.log) {
            this.log(`Error deleting element: ${error.message}`);
          }
        }
      };
      elementItem.appendChild(deleteButton);

      // Add a tooltip with element info
      const tooltipText = `ID: ${element.elementId}\nTag: ${element.tagName || 'unknown'}\nXPath: ${element.xpath || 'n/a'}`;
      elementItem.setAttribute('title', tooltipText + '\nRight-click to capture screenshot');

      // Add to the list
      selectedElementsList.appendChild(elementItem);
    });

    // Add help text about screenshots
    const helpText = document.createElement('div');
    helpText.className = 'screenshot-help-text';
    helpText.textContent = 'Right-click on an element to capture a screenshot';
    selectedElementsList.appendChild(helpText);
  }
}

// Export the class
export default UIUpdater; 