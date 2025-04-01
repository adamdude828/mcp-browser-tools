/**
 * Browser Connect Extension - Window UI
 * Main window script that initializes and uses the modular components
 */

import { 
  SocketConnectionManager, 
  TabManager, 
  UIUpdater, 
  ElementSelectionManager 
} from './js/modules/index.js';

// Create instances of our modules
const uiUpdater = new UIUpdater();
const tabManager = new TabManager();
const socketManager = new SocketConnectionManager();
const elementSelectionManager = new ElementSelectionManager(tabManager, uiUpdater);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set up UI
  uiUpdater.initialize();
  
  // Initialize tab manager
  tabManager.initialize(uiUpdater.log.bind(uiUpdater));
  
  // Initialize element selection manager
  elementSelectionManager.initialize(uiUpdater.log.bind(uiUpdater));

  // Check if Socket.IO is loaded
  if (typeof io === 'undefined') {
    uiUpdater.showError('Socket.IO not loaded. Please reload the extension.');
    uiUpdater.log('Error: Socket.IO not loaded');
    document.getElementById('connectBtn').disabled = true;
  } else {
    uiUpdater.log('Socket.IO loaded successfully', io.version || 'unknown version');
  }

  // Load saved server URL
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      document.getElementById('serverUrl').value = result.serverUrl;
    }
  });
  
  // Set up event listeners
  document.getElementById('connectBtn').addEventListener('click', connect);
  document.getElementById('disconnectBtn').addEventListener('click', disconnect);
  
  // Set up element selection buttons
  document.getElementById('startSelectionBtn').addEventListener('click', startElementSelection);
  document.getElementById('highlightAllBtn').addEventListener('click', toggleElementHighlight);
  document.getElementById('clearSelectionsBtn').addEventListener('click', clearAllElements);
  document.getElementById('reloadZonesBtn').addEventListener('click', reloadZones);
  
  // Add debug button for content script verification
  const debugBtn = document.createElement('button');
  debugBtn.id = 'verifyContentScriptBtn';
  debugBtn.className = 'btn btn-secondary btn-sm';
  debugBtn.innerHTML = '<i class="fas fa-bug"></i> Verify Content Script';
  debugBtn.title = 'Check if content script is properly loaded in the active tab';
  debugBtn.addEventListener('click', verifyContentScript);
  
  // Add to buttons container
  const buttonsContainer = document.querySelector('.action-buttons');
  if (buttonsContainer) {
    buttonsContainer.appendChild(debugBtn);
  }
  
  // Listen for custom refresh zones event from socket handler
  window.addEventListener('browser-connect-refresh-zones', (event) => {
    uiUpdater.log(`Received server request to refresh zones (requestId: ${event.detail.requestId})`);
    reloadZones();
  });
  
  // Listen for socket-emit messages from content scripts via background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Debug all messages received to diagnose the zone issue
    console.log('Window.js: Received message:', message);
    
    if (message.type === 'socket-emit' && socketManager.isConnected()) {
      // Debug: Check if the message contains HTML content when zone-added event
      if (message.event === 'zone-added' && message.data) {
        console.log('Window.js: zone-added event with data:', {
          label: message.data.label,
          elementId: message.data.elementId,
          hasHtml: !!message.data.html,
          htmlLength: message.data.html ? message.data.html.length : 0,
          htmlSample: message.data.html ? 
            (message.data.html.substring(0, 50) + (message.data.html.length > 50 ? '...' : '')) : 
            'none'
        });
        
        // Ensure we load selected elements when a zone is added
        elementSelectionManager.loadSelectedElements();
      }
      
      // Check if this message has already been processed to prevent duplicates
      if (message.processed) {
        // This message was already processed, don't send it again
        sendResponse({ success: true, skipped: true });
        return true;
      }
      
      // Mark as processed so other handlers don't duplicate it
      message.processed = true;
      
      // Forward the event to the server through the socket connection
      const eventSummary = message.event === 'zone-added' 
        ? `${message.event} (label: ${message.data.label})` 
        : message.event;
      
      uiUpdater.log('Emitting socket event:', eventSummary);
      
      socketManager.emit(message.event, message.data, (acknowledgement) => {
        if (acknowledgement) {
          uiUpdater.log('Server acknowledged event:', eventSummary);
        }
      });
      
      sendResponse({ success: true });
      return true;
    }
    
    // Also listen for element-selected events directly
    if (message.type === 'element-selected') {
      console.log('Window.js: Received element-selected event:', message);
      // Make sure we update the UI
      elementSelectionManager.loadSelectedElements();
      return true;
    }
    
    return false;
  });
  
  // Load tabs on startup
  loadTabs();
  
  // Refresh tabs periodically
  setInterval(loadTabs, 5000);

  // Set up event listeners
  setupEventListeners();
});

// Load and display all tabs
function loadTabs() {
  tabManager.loadTabs()
    .then(tabs => {
      uiUpdater.updateTabsList(
        tabs, 
        tabManager.getSelectedTabId(), 
        selectTab
      );
    })
    .catch(error => {
      uiUpdater.log('Error loading tabs', error.message);
    });
}

// Select a tab to control
function selectTab(tab) {
  tabManager.selectTab(tab)
    .then(() => {
      // Get the tab again to make sure we have the most up-to-date info
      return tabManager.getTabById(tab.id);
    })
    .then(updatedTab => {
      // Reset selection mode state
      elementSelectionManager.resetSelectionMode();
      
      // Update the tab ID in UIUpdater
      uiUpdater.setTabId(updatedTab.id);
      
      // Update the UI
      uiUpdater.updateActiveTabDisplay(updatedTab);
      
      // Refresh the tabs list to show the selected tab
      loadTabs();
      
      // Load selected elements for this tab
      elementSelectionManager.loadSelectedElements();
      
      // Send to server if connected
      if (socketManager.isConnected()) {
        const tabData = {
          id: updatedTab.id,
          url: updatedTab.url,
          title: updatedTab.title,
          favIconUrl: updatedTab.favIconUrl
        };
        
        socketManager.emit('active-tab-update', tabData, (acknowledgement) => {
          if (acknowledgement) {
            uiUpdater.log('Server acknowledged tab update');
          }
        });
        
        uiUpdater.log('Sent tab info to server:', updatedTab.title);
      }
    })
    .catch(error => {
      uiUpdater.log('Error selecting tab', error.message);
    });
}

// Connect to server
function connect() {
  const serverUrl = document.getElementById('serverUrl').value.trim();
  if (!serverUrl) {
    uiUpdater.showError('Please enter a valid server URL');
    return;
  }
  
  // Save URL
  chrome.storage.sync.set({ serverUrl });
  
  // Update UI
  uiUpdater.updateConnectionStatus(false, serverUrl, 'Connecting...');
  
  // Connect to the server
  socketManager.connect(serverUrl, uiUpdater.log.bind(uiUpdater))
    .then(() => {
      // Update UI
      uiUpdater.updateConnectionStatus(true, serverUrl);
      
      // If a tab is already selected, send it
      if (tabManager.getSelectedTabId()) {
        tabManager.getTabById(tabManager.getSelectedTabId())
          .then(tab => {
            const tabData = {
              id: tab.id,
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl
            };
            
            socketManager.emit('active-tab-update', tabData);
            uiUpdater.log('Sent initial tab info to server:', tab.title);
          })
          .catch(error => {
            uiUpdater.log('Selected tab no longer exists, selecting none');
            tabManager.selectTab(null);
            uiUpdater.updateActiveTabDisplay(null);
          });
      }
      
      // Set up socket event listeners
      socketManager.setupSocketEvents(tabManager);
      
      // Set up element selected event listener
      socketManager.on('element-selected', (data) => {
        if (data && data.elementId) {
          uiUpdater.log('Element selected event from server:', data.label || data.elementId);
          elementSelectionManager.loadSelectedElements(); // Refresh the elements list
        }
      });
    })
    .catch(error => {
      uiUpdater.showError(`Connection error: ${error.message}`);
    });
}

// Disconnect from server
function disconnect() {
  socketManager.disconnect();
  uiUpdater.updateConnectionStatus(false, document.getElementById('serverUrl').value);
}

// Start or stop element selection mode
function startElementSelection() {
  elementSelectionManager.toggleSelectionMode()
    .catch(error => {
      uiUpdater.log('Error toggling selection mode', error.message);
    });
}

// Toggle element highlighting
function toggleElementHighlight() {
  elementSelectionManager.toggleHighlightElements()
    .catch(error => {
      uiUpdater.log('Error toggling element highlight', error.message);
    });
}

// Clear all selected elements
function clearAllElements() {
  elementSelectionManager.clearAllElements()
    .catch(error => {
      uiUpdater.log('Error clearing elements', error.message);
    });
}

// Reload all zones and refresh screenshots
function reloadZones() {
  uiUpdater.log('Reloading all zones and refreshing screenshots...');
  
  // First load the selected elements to get the current list
  elementSelectionManager.loadSelectedElements()
    .then(elements => {
      // Detailed logging about what elements we found
      uiUpdater.log(`Found ${elements.length} zones to reload`);
      
      if (elements.length === 0) {
        uiUpdater.log('No zones found to reload');
        return;
      }
      
      // Log each element's details for debugging
      elements.forEach((element, index) => {
        uiUpdater.log(`Zone ${index + 1}: ID=${element.elementId}, Label=${element.label || 'No Label'}, Tag=${element.tagName}`);
        console.log('Detailed zone info:', element);
      });
      
      // Capture screenshots for each element one by one
      const capturePromises = elements.map(element => {
        // Add detailed log before attempting capture
        uiUpdater.log(`Attempting to capture screenshot for zone: ${element.label || element.elementId}`);
        
        return elementSelectionManager.captureElementScreenshot(element.elementId)
          .then((result) => {
            uiUpdater.log(`✅ Successfully refreshed screenshot for zone: ${element.label || element.elementId}`);
            console.log('Screenshot capture result:', result);
            return true;
          })
          .catch(error => {
            uiUpdater.log(`❌ Failed to refresh screenshot for zone: ${element.label || element.elementId}`, error.message);
            console.error('Screenshot capture error:', error);
            return false;
          });
      });
      
      // When all are done, show summary
      Promise.allSettled(capturePromises)
        .then(results => {
          const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
          uiUpdater.log(`Reload complete: ${successful} of ${elements.length} zones refreshed successfully`);
        });
    })
    .catch(error => {
      uiUpdater.log('Error reloading zones', error.message);
      console.error('Error in reloadZones:', error);
    });
}

// Handle element click for screenshots
function handleZoneScreenshot(event) {
  // Prevent default right-click behavior
  event.preventDefault();
  
  // Get the element ID from the data attribute
  const elementItem = event.target.closest('.selected-element-item');
  if (!elementItem) {
    console.error('No element item found for screenshot');
    return;
  }
  
  const elementId = elementItem.dataset.elementId;
  const elementLabel = elementItem.querySelector('.element-label')?.textContent;
  
  if (!elementId) {
    console.error('No element ID found for screenshot');
    return;
  }
  
  console.log(`Taking screenshot of element: ${elementLabel} (${elementId})`);
  
  // Disable the button while processing
  elementItem.classList.add('screenshot-processing');
  
  // Show a loading indicator
  const loadingSpan = document.createElement('span');
  loadingSpan.className = 'loading-indicator';
  loadingSpan.textContent = ' (Capturing...)';
  elementItem.appendChild(loadingSpan);
  
  // Capture the screenshot using ElementSelectionManager
  elementSelectionManager.captureElementScreenshot(elementId)
    .then(result => {
      console.log('Screenshot captured and uploaded:', result);
      // Update UI to indicate success
      if (loadingSpan) {
        loadingSpan.textContent = ' (Captured ✓)';
        setTimeout(() => {
          loadingSpan.remove();
        }, 2000);
      }
    })
    .catch(error => {
      console.error('Error capturing screenshot:', error);
      // Update UI to indicate failure
      if (loadingSpan) {
        loadingSpan.textContent = ' (Failed ✗)';
        setTimeout(() => {
          loadingSpan.remove();
        }, 2000);
      }
    })
    .finally(() => {
      // Re-enable the button
      elementItem.classList.remove('screenshot-processing');
    });
}

// Set up event listeners
function setupEventListeners() {
  // Add event listener for right-click on selected elements
  document.addEventListener('contextmenu', function(event) {
    const elementItem = event.target.closest('.selected-element-item');
    if (elementItem) {
      handleZoneScreenshot(event);
    }
  });
}

// Set server URL for ElementSelectionManager
socketManager.onConnect((socket) => {
  // ... existing code ...
  
  // Set the server URL for screenshot uploads (remove /socket.io)
  const baseServerUrl = socketManager.serverUrl.replace(/\/socket\.io\/?$/, '');
  elementSelectionManager.setServerUrl(baseServerUrl);
});

// Verify content script in active tab
function verifyContentScript() {
  uiUpdater.log('Verifying content script in active tab...');
  
  chrome.runtime.sendMessage({ type: 'verify-content-script' }, (response) => {
    if (chrome.runtime.lastError) {
      uiUpdater.log('Error verifying content script', chrome.runtime.lastError.message);
      return;
    }
    
    if (!response || !response.success) {
      uiUpdater.log('Verification failed', response?.error || 'Unknown error');
      return;
    }
    
    const result = response.result;
    
    if (result.loaded) {
      uiUpdater.log('✅ Content script is loaded and responding', {
        tabId: response.tabId,
        initialized: result.initialized ? 'Yes' : 'No',
        domReady: result.domReady ? 'Yes' : 'No'
      });
      
      // If we have a tab ID, offer to reload the content script or reinitialize ShadowDOM
      if (response.tabId) {
        // Create actions container
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'mt-2';
        
        // Create reload button
        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'btn btn-sm btn-warning me-2';
        reloadBtn.textContent = 'Reload Script';
        reloadBtn.addEventListener('click', () => {
          reloadContentScript(response.tabId);
        });
        actionsContainer.appendChild(reloadBtn);
        
        // Create reinitialize Shadow DOM button
        const reinitBtn = document.createElement('button');
        reinitBtn.className = 'btn btn-sm btn-info';
        reinitBtn.textContent = 'Reinit ShadowDOM';
        reinitBtn.title = 'Reload the ShadowDOMHighlighter and re-initialize element tracking';
        reinitBtn.addEventListener('click', () => {
          reinitializeShadowDOM(response.tabId);
        });
        actionsContainer.appendChild(reinitBtn);
        
        // Add to log entry
        const logEntry = document.querySelector('.log-entry:last-child');
        if (logEntry) {
          logEntry.appendChild(actionsContainer);
        }
      }
    } else {
      uiUpdater.log('❌ Content script verification failed', {
        error: result.error || 'Unknown error',
        tabId: response.tabId,
        url: response.url
      });
      
      // Offer to inject the content script
      const injectBtn = document.createElement('button');
      injectBtn.className = 'btn btn-sm btn-primary ms-2';
      injectBtn.textContent = 'Force Inject Script';
      injectBtn.addEventListener('click', () => {
        injectContentScript(response.tabId);
      });
      
      // Add to log entry
      const logEntry = document.querySelector('.log-entry:last-child');
      if (logEntry) {
        logEntry.appendChild(injectBtn);
      }
    }
  });
}

// Reload content script in a tab
function reloadContentScript(tabId) {
  uiUpdater.log(`Reloading content script in tab ${tabId}...`);
  
  chrome.tabs.reload(tabId, {}, () => {
    if (chrome.runtime.lastError) {
      uiUpdater.log('Error reloading tab', chrome.runtime.lastError.message);
    } else {
      uiUpdater.log('Tab reloaded successfully. Please wait a moment and try again.');
    }
  });
}

// Force inject content script
function injectContentScript(tabId) {
  uiUpdater.log(`Forcing content script injection into tab ${tabId}...`);
  
  chrome.tabs.executeScript(tabId, { file: 'content-script.js' }, (results) => {
    if (chrome.runtime.lastError) {
      uiUpdater.log('Error injecting content script', chrome.runtime.lastError.message);
    } else {
      uiUpdater.log('Content script injection attempted', results);
      
      // Verify after a short delay
      setTimeout(() => {
        verifyContentScript();
      }, 1000);
    }
  });
}

// Reinitialize ShadowDOM in the content script
function reinitializeShadowDOM(tabId) {
  uiUpdater.log(`Reinitializing ShadowDOM in tab ${tabId}...`);
  
  chrome.tabs.executeScript(tabId, {
    code: `
      // Attempt to reload the ShadowDOMHighlighter
      try {
        // Create a script element to load the ShadowDOMHighlighter
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = '${chrome.runtime.getURL('js/direct/ShadowDOMHighlighter.js')}';
        script.onload = () => {
          console.log('🔍 DEBUG: ShadowDOMHighlighter reloaded successfully');
          // Try to reinitialize tracking
          if (window.elementSelector) {
            console.log('🔍 DEBUG: Reinitializing element tracking');
            window.elementSelector.initializeTracking();
          } else {
            console.error('🚨 ERROR: elementSelector not found in window');
          }
        };
        script.onerror = (error) => {
          console.error('🚨 ERROR: Failed to reload ShadowDOMHighlighter:', error);
        };
        
        // Remove any existing script first
        const existingScript = document.querySelector('script[src*="ShadowDOMHighlighter.js"]');
        if (existingScript) {
          existingScript.remove();
        }
        
        // Add the new script
        document.head.appendChild(script);
        
        // Return success
        "ShadowDOM reinitialization triggered";
      } catch (error) {
        console.error('🚨 ERROR: Failed to reinitialize ShadowDOM:', error);
        error.message;
      }
    `
  }, (results) => {
    if (chrome.runtime.lastError) {
      uiUpdater.log('Error reinitializing ShadowDOM', chrome.runtime.lastError.message);
    } else {
      uiUpdater.log('ShadowDOM reinitialization attempt', results?.[0]?.result || 'No result');
    }
  });
} 