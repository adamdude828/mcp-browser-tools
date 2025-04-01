// Window tracking
let windowId = null;

// Track content script readiness by tab ID
const contentScriptReadyTabs = new Set();

// Queue of pending tasks by tab ID
const pendingTasks = new Map();

// Server URL
let serverUrl = null;

// Debug helper function
function logDebug(message, data) {
  const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
  console.log(`🔍 DEBUG [${timestamp}]: ${message}`, data || '');
}

function logError(message, data) {
  const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
  console.error(`🚨 ERROR [${timestamp}]: ${message}`, data || '');
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  logDebug('Extension installed');
  // Set default server URL
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (!result.serverUrl) {
      logDebug('Setting default server URL');
      chrome.storage.sync.set({ serverUrl: "http://localhost:3000" });
    } else {
      serverUrl = result.serverUrl; // Initialize server URL from storage
    }
  });
});

// Load server URL from storage on startup
chrome.storage.sync.get(['serverUrl'], (result) => {
  if (result.serverUrl) {
    serverUrl = result.serverUrl;
    logDebug('Loaded server URL from storage:', serverUrl);
  }
});

// When extension icon is clicked
chrome.action.onClicked.addListener(() => {
  logDebug('Extension icon clicked');
  if (windowId) {
    // Focus existing window
    logDebug('Focusing existing extension window', windowId);
    chrome.windows.update(windowId, { focused: true });
  } else {
    // Create new window
    logDebug('Creating new extension window');
    chrome.windows.create({
      url: chrome.runtime.getURL('window.html'),
      type: 'popup',
      width: 800,
      height: 600
    }, (window) => {
      windowId = window.id;
      logDebug('Created extension window with ID', windowId);
    });
  }
});

// Track window closure
chrome.windows.onRemoved.addListener((removedWindowId) => {
  if (removedWindowId === windowId) {
    logDebug('Extension window closed', removedWindowId);
    windowId = null;
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logDebug('Received message', { type: message.type, sender: sender.id });
  
  // Handle get-server-url message
  if (message.type === 'get-server-url') {
    logDebug('Received get-server-url request');
    sendResponse({ serverUrl: serverUrl });
    return true;
  }

  // Handle content script ready message
  if (message.type === 'content-script-ready') {
    // Mark this tab as having a ready content script
    if (sender.tab && sender.tab.id) {
      logDebug('Content script ready in tab', { tabId: sender.tab.id, url: sender.tab.url });
      contentScriptReadyTabs.add(sender.tab.id);
      
      // Check if there are pending tasks for this tab
      if (pendingTasks.has(sender.tab.id)) {
        const tasks = pendingTasks.get(sender.tab.id);
        logDebug('Processing pending tasks for tab', { tabId: sender.tab.id, count: tasks.length });
        
        // Execute pending tasks
        tasks.forEach(task => setTimeout(task, 100));
        
        // Clear pending tasks
        pendingTasks.delete(sender.tab.id);
      }
      
      sendResponse({ success: true, received: true });
    }
    return true;
  }

  if (message.type === 'toggle-selection-mode-from-popup') {
    logDebug('Received toggle-selection-mode-from-popup message');
    toggleSelectionMode();
    sendResponse({ success: true });
    return true;
  }
  
  // For messages from content script to popup or window, just forward them
  if (message.type === 'element-selected' || 
      message.type === 'elements-cleared') {
    logDebug('Forwarding message from content script', message.type);
    
    // Forward to any open popups and windows
    chrome.runtime.sendMessage(message);
    
    // If this message should also be sent to socket, create and forward a socket-emit message
    if (message.type === 'element-selected' && message.forSocket) {
      logDebug('Creating socket-emit message for zone-added from element-selected');
      chrome.runtime.sendMessage({
        type: 'socket-emit',
        event: 'zone-added',
        data: message.data,
        processed: false // Initialize as not processed yet
      });
      
      // Mark the original message as processed to prevent duplicates
      message.processed = true;
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle socket-emit messages from content scripts
  if (message.type === 'socket-emit') {
    logDebug('Received socket-emit message', { event: message.event });
    // Forward to window.js which handles socket connections
    chrome.runtime.sendMessage(message);
    sendResponse({ success: true });
    return true;
  }
  
  // Handle socket-message events from window.js to forward to content scripts
  if (message.type === 'socket-message') {
    logDebug('Received socket-message to forward to content script', { event: message.event });
    
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        logDebug('Found active tab for forwarding', { tabId: activeTab.id, url: activeTab.url });
        
        // Check if we can access the tab
        if (activeTab.url && !activeTab.url.startsWith('chrome://')) {
          // Forward the message to the content script
          chrome.tabs.sendMessage(activeTab.id, message, (response) => {
            if (chrome.runtime.lastError) {
              logError('Error forwarding socket message', chrome.runtime.lastError);
            } else {
              logDebug('Socket message forwarded successfully', response);
            }
          });
        } else {
          logError('Cannot forward message to restricted URL', activeTab.url);
        }
      } else {
        logError('No active tab found for forwarding message');
      }
    });
    
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'verify-content-script') {
    logDebug('Received verify-content-script request');
    
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
        logError('No active tab found for verification');
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      const activeTab = tabs[0];
      logDebug('Verifying content script in active tab', { id: activeTab.id, url: activeTab.url });
      
      // Check if we can access the tab
      if (!activeTab.url || activeTab.url.startsWith('chrome://') || 
          activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:')) {
        logError('Cannot verify restricted URL', activeTab.url);
        sendResponse({ 
          success: false, 
          error: 'Cannot access this page due to browser restrictions', 
          url: activeTab.url 
        });
        return;
      }
      
      try {
        const result = await verifyContentScript(activeTab.id);
        sendResponse({ success: true, result, tabId: activeTab.id, url: activeTab.url });
      } catch (error) {
        logError('Error during content script verification', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    
    return true; // Indicate we'll send response asynchronously
  }

  // Handle direct-inject-scripts message
  if (message.type === 'direct-inject-scripts') {
    logDebug('Received direct-inject-scripts request');
    
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
        logError('No active tab found for direct injection');
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      const activeTab = tabs[0];
      logDebug('Performing direct script injection in active tab', { id: activeTab.id, url: activeTab.url });
      
      try {
        const result = await injectDirectScripts(activeTab.id);
        logDebug('Direct script injection complete', result);
        sendResponse({
          success: true,
          message: 'Direct script injection completed',
          result: result
        });
      } catch (error) {
        logError('Direct script injection failed', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    
    return true;
  }
});

// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-selection-mode') {
    logDebug('Keyboard shortcut pressed: toggle-selection-mode');
    toggleSelectionMode();
  }
});

// Track tab navigation events to update readiness state
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Tab is navigating, so content script will need to be reinjected
    if (contentScriptReadyTabs.has(tabId)) {
      logDebug('Tab navigating, marking content script as not ready', tabId);
      contentScriptReadyTabs.delete(tabId);
    }
  }
});

// Track tab changes to detect when a tab becomes active
chrome.tabs.onActivated.addListener((activeInfo) => {
  logDebug('Tab activated', activeInfo);
  
  // Set a small delay before checking content script status
  setTimeout(() => {
    checkContentScriptStatus(activeInfo.tabId)
      .then(status => {
        logDebug('Content script status check for newly activated tab', { 
          tabId: activeInfo.tabId, 
          status: status 
        });
        
        // If content script not loaded or not initialized, try to help by auto-injecting
        if (!status.success || !status.initialized) {
          logDebug('Content script not properly loaded, attempting automatic recovery');
          
          // Get tab info to make sure we're working with a compatible URL
          chrome.tabs.get(activeInfo.tabId, (tab) => {
            if (chrome.runtime.lastError) {
              logError('Could not get tab info', chrome.runtime.lastError.message);
              return;
            }
            
            // Skip for restricted URLs
            if (!tab.url || tab.url.startsWith('chrome://') || 
                tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
              logDebug('Skipping content script recovery for restricted URL', tab.url);
              return;
            }
            
            // Try to inject content script
            logDebug('Automatically injecting content script to aid debugging');
            
            // First try to display a diagnostic indicator in the page
            chrome.scripting.executeScript({
              target: { tabId: activeInfo.tabId },
              function: () => {
                try {
                  console.log('🔍 BROWSER CONNECT: Diagnostic check running');
                  
                  // Create diagnostic log in page
                  const diagnostic = document.createElement('div');
                  diagnostic.id = 'browser-connect-diagnostic';
                  diagnostic.style.position = 'fixed';
                  diagnostic.style.bottom = '10px';
                  diagnostic.style.right = '10px';
                  diagnostic.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                  diagnostic.style.color = 'white';
                  diagnostic.style.padding = '10px';
                  diagnostic.style.borderRadius = '5px';
                  diagnostic.style.zIndex = '2147483647';
                  diagnostic.style.maxWidth = '300px';
                  diagnostic.style.maxHeight = '200px';
                  diagnostic.style.overflow = 'auto';
                  diagnostic.style.fontFamily = 'monospace';
                  diagnostic.style.fontSize = '12px';
                  diagnostic.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
                  
                  // Add diagnostic information
                  const addLog = (message, type = 'info') => {
                    const entry = document.createElement('div');
                    entry.style.marginBottom = '5px';
                    entry.style.borderLeft = `3px solid ${type === 'error' ? 'red' : type === 'warning' ? 'orange' : 'green'}`;
                    entry.style.paddingLeft = '5px';
                    entry.textContent = message;
                    diagnostic.appendChild(entry);
                  };
                  
                  addLog('Browser Connect Diagnostic', 'info');
                  addLog(`URL: ${window.location.href}`, 'info');
                  addLog(`Time: ${new Date().toISOString()}`, 'info');
                  
                  // Check for script objects
                  addLog(`ShadowDOMHighlighter: ${window.ShadowDOMHighlighter ? 'Found ✓' : 'Missing ✗'}`, 
                         window.ShadowDOMHighlighter ? 'info' : 'error');
                  
                  addLog(`elementSelector: ${window.elementSelector ? 'Found ✓' : 'Missing ✗'}`, 
                         window.elementSelector ? 'info' : 'error');
                  
                  addLog(`browserConnectAPI: ${window.browserConnectAPI ? 'Found ✓' : 'Missing ✗'}`, 
                         window.browserConnectAPI ? 'info' : 'error');
                  
                  document.body.appendChild(diagnostic);
                  
                  // Remove after 20 seconds
                  setTimeout(() => {
                    if (diagnostic.parentNode) {
                      diagnostic.remove();
                    }
                  }, 20000);
                  
                  return {
                    success: true,
                    shadowDOMHighlighter: !!window.ShadowDOMHighlighter,
                    elementSelector: !!window.elementSelector,
                    browserConnectAPI: !!window.browserConnectAPI,
                    location: window.location.href
                  };
                } catch (error) {
                  console.error('Error creating diagnostic element:', error);
                  return { success: false, error: error.message };
                }
              }
            }).then(results => {
              logDebug('Diagnostic script executed', results[0]?.result);
              
              // Now try to inject content script if needed
              if (!status.success || !status.initialized) {
                injectContentScript(activeInfo.tabId)
                  .then(result => {
                    logDebug('Auto-injection result', result);
                  })
                  .catch(error => {
                    logError('Auto-injection failed', error);
                  });
              }
            }).catch(error => {
              logError('Diagnostic script execution failed', error);
            });
          });
        }
      })
      .catch(error => {
        logError('Error checking content script status', error);
      });
  }, 1000); // Delay to give the tab time to fully load
});

// Function to toggle selection mode
function toggleSelectionMode() {
  logDebug('========== SELECTION MODE TOGGLE INITIATED ==========');
  
  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      logError('No active tab found');
      return;
    }
    
    const activeTab = tabs[0];
    logDebug('Active tab found', { id: activeTab.id, url: activeTab.url });
    
    // Check if we can access the tab (some URLs like chrome:// cannot be accessed)
    if (!activeTab.url || activeTab.url.startsWith('chrome://')) {
      logError('Cannot access this page - restricted URL', activeTab.url);
      return;
    }
    
    // Use a more direct approach for sites with restrictive CSP
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: directToggleSelectionMode
    }).then(results => {
      logDebug('Direct toggle attempted', results);
    }).catch(err => {
      logError('Direct toggle failed', err.message);
      
      // If direct toggle failed, try script injection
      if (contentScriptReadyTabs.has(activeTab.id)) {
        logDebug('Content script already ready in tab', activeTab.id);
        sendToggleMessage(activeTab.id);
      } else {
        logDebug('Content script not ready in tab, attempting injection', activeTab.id);
        injectAndToggle(activeTab);
      }
    });
  });
}

// This function is injected directly into the page context
function directToggleSelectionMode() {
  console.log('🔍 DEBUG: Direct toggle selection mode executed');
  
  // Try to access existing API
  if (window.browserConnectAPI && window.browserConnectAPI.isReady) {
    return window.browserConnectAPI.toggleSelectionMode();
  }
  
  if (window.bcToggleSelectionMode) {
    return { success: true, result: window.bcToggleSelectionMode() };
  }
  
  // Element selector not initialized, create a simple visible indicator to show state
  try {
    // Create and inject minimal element selector
    const indicator = document.createElement('div');
    indicator.id = 'browser-connect-direct-toggle-indicator';
    indicator.style.position = 'fixed';
    indicator.style.top = '10px';
    indicator.style.right = '10px';
    indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    indicator.style.color = 'white';
    indicator.style.padding = '8px 15px';
    indicator.style.borderRadius = '4px';
    indicator.style.zIndex = '2147483647';
    indicator.style.fontSize = '14px';
    indicator.style.fontFamily = 'Arial, sans-serif';
    indicator.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    indicator.textContent = 'Content script not loaded';
    document.body.appendChild(indicator);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 5000);
    
    return { 
      success: false, 
      error: 'Content script not initialized',
      indicator: 'created'
    };
  } catch (e) {
    console.error('Error creating indicator:', e);
    return { 
      success: false, 
      error: e.message || 'Unknown error'
    };
  }
}

// Modified injectAndToggle to use more direct methods
function injectAndToggle(tab) {
  logDebug('Injecting content script into tab', { id: tab.id, url: tab.url });
  
  // Verify the tab is valid for injection
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    logError('Cannot inject content script to restricted URL', tab.url);
    return;
  }
  
  // First try MAIN world injection for our minimal selector - this has better chances with restricted CSP
  logDebug('Trying minimal selector injection first (better for CSP restrictive sites)');
  
  const extensionUrl = chrome.runtime.getURL('minimal-selector.js');
  logDebug('Using minimal selector from extension URL', extensionUrl);
  
  // Inject script tag directly into page - this works better with strict CSP
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (scriptUrl) => {
      return new Promise((resolve, reject) => {
        try {
          console.log('Injecting script from:', scriptUrl);
          
          // Create script element
          const script = document.createElement('script');
          script.src = scriptUrl;
          script.type = 'text/javascript';
          script.onload = () => {
            console.log('Minimal selector script loaded successfully');
            resolve({ success: true, method: 'script-tag' });
          };
          script.onerror = (error) => {
            console.error('Error loading minimal selector script:', error);
            reject({ success: false, error: 'Failed to load script' });
          };
          
          // Add to document
          document.head.appendChild(script);
          
          // Also add a message handler for communication
          window.addEventListener('message', function(event) {
            if (event.source !== window) return;
            
            const data = event.data;
            if (!data || data.source !== 'browser-connect-minimal-selector') return;
            
            console.log('Received message from minimal selector:', data);
            
            // Try to forward to extension if possible
            try {
              chrome.runtime.sendMessage(data.message);
            } catch (e) {
              console.error('Could not forward message to extension:', e);
            }
          });
        } catch (err) {
          console.error('Error injecting script tag:', err);
          reject({ success: false, error: err.message });
        }
      });
    },
    args: [extensionUrl]
  }).then(results => {
    logDebug('Minimal selector injection result', results);
    
    // Wait a bit and then try to toggle selection mode
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Try to use our window API
          try {
            console.log('Attempting to toggle selection mode after minimal script injection');
            
            // Use minimal selector directly
            if (window.bcToggleSelectionMode) {
              console.log('Using bcToggleSelectionMode');
              const result = window.bcToggleSelectionMode();
              return { success: true, selectionMode: result, method: 'direct' };
            }
            
            // Try the API
            if (window.browserConnectAPI && window.browserConnectAPI.toggleSelectionMode) {
              console.log('Using browserConnectAPI.toggleSelectionMode');
              const result = window.browserConnectAPI.toggleSelectionMode();
              return { success: true, result: result, method: 'api' };
            }
            
            // Try BrowserConnect
            if (window.BrowserConnect && window.BrowserConnect.toggleSelectionMode) {
              console.log('Using BrowserConnect.toggleSelectionMode');
              const result = window.BrowserConnect.toggleSelectionMode();
              return { success: true, selectionMode: result, method: 'namespace' };
            }
            
            // Nothing found
            return { success: false, error: 'No toggle function found after script injection' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
      }).then(toggleResults => {
        logDebug('Toggle after minimal script injection', toggleResults);
      }).catch(toggleErr => {
        logError('Failed to toggle after minimal script injection', toggleErr.message);
      });
    }, 750);
  }).catch(err => {
    logError('Minimal selector injection failed', err.message);
    
    // Fall back to standard content script injection
    logDebug('Falling back to standard content script injection');
    
    // Try ISOLATED world first which often works better with restrictive CSP
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js'],
      world: "ISOLATED"
    }).then(() => {
      logDebug('ISOLATED world content script injected successfully');
      
      // Wait a bit to let the script initialize
      setTimeout(() => {
        sendToggleMessage(tab.id);
      }, 750);
    }).catch(isolatedErr => {
      logError('ISOLATED world injection failed', isolatedErr.message);
      
      // Fall back to MAIN world
      logDebug('Trying MAIN world injection as fallback');
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
        world: "MAIN"
      }).then(() => {
        logDebug('MAIN world content script injected successfully');
        
        setTimeout(() => {
          sendToggleMessage(tab.id);
        }, 750);
      }).catch(mainErr => {
        logError('All injection attempts failed', mainErr.message);
        
        // Show user feedback about the issue
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              const indicator = document.createElement('div');
              indicator.style.position = 'fixed';
              indicator.style.top = '10px';
              indicator.style.left = '10px';
              indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
              indicator.style.color = 'white';
              indicator.style.padding = '10px';
              indicator.style.borderRadius = '4px';
              indicator.style.zIndex = '2147483647';
              indicator.style.fontWeight = 'bold';
              indicator.textContent = 'Browser Connect: Site CSP blocked script injection';
              document.body.appendChild(indicator);
              
              // Remove after 5 seconds
              setTimeout(() => {
                if (indicator.parentNode) {
                  indicator.remove();
                }
              }, 5000);
              
              return { success: true, error: 'CSP notification shown' };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }
        });
      });
    });
  });
}

function sendToggleMessage(tabId) {
  logDebug('Sending toggle-selection-mode message to tab', tabId);
  
  // Use executeScript to inject and immediately run a toggle function in the page context
  // This is more reliable than message passing
  logDebug('Executing toggle script in page context');
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: toggleSelectionModeInPage
  }).then(results => {
    // Script executed successfully
    logDebug('Toggle script executed', { result: results[0]?.result });
    
    // Also try regular message passing as a backup approach
    tryToggleViaMessage(tabId);
  }).catch(err => {
    logError('Failed to execute toggle script', err.message);
    
    // Fall back to message passing
    tryToggleViaMessage(tabId);
  });
}

// This function runs directly in the page context 
function toggleSelectionModeInPage() {
  console.log('🔍 DEBUG: Running toggle function in page context');
  
  // Try using the window API first (preferred approach)
  if (typeof window.browserConnectAPI === 'object' && window.browserConnectAPI.isReady) {
    try {
      console.log('🔍 DEBUG: Using window.browserConnectAPI');
      const result = window.browserConnectAPI.toggleSelectionMode();
      console.log('🔍 DEBUG: browserConnectAPI toggle result:', result);
      return result;
    } catch (apiError) {
      console.error('🚨 ERROR: Error using browserConnectAPI:', apiError);
      // Fall through to other approaches
    }
  } else {
    console.log('🔍 DEBUG: browserConnectAPI not ready or not found');
  }
  
  // Try using the direct method we exposed
  if (typeof window.bcToggleSelectionMode === 'function') {
    try {
      console.log('🔍 DEBUG: Using direct bcToggleSelectionMode method');
      const result = window.bcToggleSelectionMode();
      console.log('🔍 DEBUG: Direct toggle result:', result);
      return { success: true, result };
    } catch (directError) {
      console.error('🚨 ERROR: Error using direct toggle method:', directError);
      // Fall through to the next approach
    }
  } else {
    console.log('🔍 DEBUG: bcToggleSelectionMode not found in window context');
  }
  
  // Check if elementSelector exists in the page context
  if (typeof window.bcElementSelector !== 'undefined' && window.bcElementSelector) {
    // Directly call the toggle function
    try {
      console.log('🔍 DEBUG: Using window.bcElementSelector.toggleSelectionMode');
      const result = window.bcElementSelector.toggleSelectionMode();
      console.log('🔍 DEBUG: Page context toggle result:', result);
      return { success: true, result };
    } catch (error) {
      console.error('🚨 ERROR: Error toggling in page context:', error);
      return { success: false, error: error.message };
    }
  } else if (typeof window.elementSelector !== 'undefined' && window.elementSelector) {
    try {
      console.log('🔍 DEBUG: Using window.elementSelector.toggleSelectionMode');
      const result = window.elementSelector.toggleSelectionMode();
      console.log('🔍 DEBUG: Page context toggle result:', result);
      return { success: true, result };
    } catch (error) {
      console.error('🚨 ERROR: Error toggling in page context with elementSelector:', error);
      return { success: false, error: error.message };
    }
  } else {
    console.warn('🚨 ERROR: No elementSelector found in any context in page');
    return { success: false, error: 'elementSelector not found in any context' };
  }
}

function tryToggleViaMessage(tabId) {
  logDebug('Trying toggle via message to tab', tabId);
  
  // Wrap in try-catch to handle any unexpected errors
  try {
    chrome.tabs.sendMessage(tabId, { type: 'toggle-selection-mode' }, (response) => {
      // Handle potential errors
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message;
        logError('Error sending toggle message', errorMessage);
        
        // Check if this is a "Receiving end does not exist" error, indicating content script issues
        if (errorMessage.includes("Receiving end does not exist")) {
          logDebug('Content script communication issue detected, attempting recovery');
          
          // Try to get tab info
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
              logError('Could not get tab info', chrome.runtime.lastError.message);
              return;
            }
            
            // Mark as not ready
            contentScriptReadyTabs.delete(tabId);
            
            // Try direct script execution as a fallback
            logDebug('Attempting direct script execution as fallback');
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => {
                // Create a visible indicator to show we're trying to recover
                try {
                  const indicator = document.createElement('div');
                  indicator.style.position = 'fixed';
                  indicator.style.top = '10px';
                  indicator.style.right = '10px';
                  indicator.style.backgroundColor = 'rgba(255, 165, 0, 0.9)';
                  indicator.style.color = 'white';
                  indicator.style.padding = '10px';
                  indicator.style.borderRadius = '4px';
                  indicator.style.zIndex = '2147483647';
                  indicator.style.fontWeight = 'bold';
                  indicator.textContent = 'Browser Connect: Reconnecting...';
                  document.body.appendChild(indicator);
                  
                  // Auto-remove after 3 seconds
                  setTimeout(() => {
                    if (indicator.parentNode) {
                      indicator.parentNode.removeChild(indicator);
                    }
                  }, 3000);
                  
                  return { success: true, message: 'Created recovery indicator' };
                } catch (e) {
                  return { success: false, error: e.message };
                }
              }
            }).then(() => {
              // Try a different script injection approach
              logDebug('Trying a different content script injection approach');
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content-script.js'],
                world: "ISOLATED"
              }).then(() => {
                logDebug('Content script re-injection succeeded');
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, { type: 'toggle-selection-mode' }, (retryResponse) => {
                    if (chrome.runtime.lastError) {
                      logError('Final toggle attempt failed', chrome.runtime.lastError.message);
                    } else {
                      logDebug('Toggle succeeded after re-injection', retryResponse);
                    }
                  });
                }, 500);
              }).catch(err => {
                logError('Re-injection failed', err.message);
                
                // Last resort: try with the MAIN world
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  files: ['content-script.js'],
                  world: "MAIN"
                }).catch(finalErr => {
                  logError('All injection attempts failed', finalErr.message);
                });
              });
            });
          });
        }
      } else if (response && response.success) {
        logDebug('Selection mode toggled successfully via message', { selectionMode: response.selectionMode });
      } else if (response) {
        logError('Error response from content script', response.error || 'Unknown error');
      } else {
        logError('Empty response from content script');
      }
    });
  } catch (unexpectedError) {
    logError('Unexpected error in tryToggleViaMessage', unexpectedError.message);
  }
}

// Function to handle server connection
function connectToServer(url) {
  logDebug('Connecting to server', url);
  serverUrl = url; // Store the server URL
  
  // Check if server is available
  fetch(`${url}/status`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      logDebug('Server is available', data);
      // Store URL in sync storage
      chrome.storage.sync.set({ serverUrl: url });
      // Notify connection status
      chrome.runtime.sendMessage({
        type: 'server-connection-status',
        status: 'connected',
        serverUrl: url
      });
    })
    .catch(error => {
      logError('Server is not available', error.message);
      // Notify connection status
      chrome.runtime.sendMessage({
        type: 'server-connection-status',
        status: 'error',
        error: error.message,
        serverUrl: url
      });
    });
}

// Function to update server URL
function updateServerUrl(url) {
  if (url && url.trim()) {
    serverUrl = url.trim();
    // Store in sync storage
    chrome.storage.sync.set({ serverUrl });
    
    logDebug('Server URL updated:', serverUrl);
    return true;
  }
  return false;
}

// Function to verify if the content script is loaded in a tab
function verifyContentScript(tabId) {
  logDebug('Verifying content script in tab', tabId);
  
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: 'content-script-ready-check' }, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          logError('Content script verification failed', error.message);
          resolve({ 
            loaded: false, 
            error: error.message,
            message: 'Content script not loaded or not responsive' 
          });
          return;
        }
        
        if (!response) {
          logError('Content script verification - no response');
          resolve({ 
            loaded: false, 
            error: 'No response from content script',
            message: 'Content script did not respond to verification' 
          });
          return;
        }
        
        logDebug('Content script verification success', response);
        resolve({ 
          loaded: true, 
          initialized: response.initialized || false,
          domReady: response.domReady || false,
          message: 'Content script is loaded and responsive' 
        });
      });
    } catch (error) {
      logError('Error during content script verification', error.message);
      resolve({ 
        loaded: false, 
        error: error.message,
        message: 'Exception during content script verification' 
      });
    }
  });
}

// Last resort function to inject both required scripts directly
function injectDirectScripts(tabId) {
  logDebug(`Performing direct script injection for tab ${tabId}`);
  
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        logError('Could not get tab info', chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError);
        return;
      }
      
      // Skip for restricted URLs
      if (!tab.url || tab.url.startsWith('chrome://') || 
          tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        logError('Cannot inject scripts to restricted URL', tab.url);
        reject(new Error('Cannot inject to restricted URL'));
        return;
      }
      
      // Get the extension URLs for our scripts
      const shadowDOMUrl = chrome.runtime.getURL('js/direct/ShadowDOMHighlighter.js');
      
      // 1. First, inject the ShadowDOMHighlighter script
      chrome.scripting.executeScript({
        target: { tabId },
        function: injectScriptTag,
        args: [shadowDOMUrl, 'ShadowDOMHighlighter']
      }).then(result1 => {
        logDebug('ShadowDOMHighlighter injection result', result1);
        
        // 2. Wait a moment to ensure ShadowDOMHighlighter has loaded
        setTimeout(() => {
          // 3. Now create the elementSelector directly in the page
          chrome.scripting.executeScript({
            target: { tabId },
            function: createElementSelector
          }).then(result2 => {
            logDebug('ElementSelector creation result', result2);
            resolve({
              success: true,
              shadowDOMResult: result1[0]?.result,
              elementSelectorResult: result2[0]?.result
            });
          }).catch(error2 => {
            logError('ElementSelector creation failed', error2);
            reject(error2);
          });
        }, 500);
      }).catch(error1 => {
        logError('ShadowDOMHighlighter injection failed', error1);
        reject(error1);
      });
    });
  });
}

// Helper function to inject a script tag - runs in page context
function injectScriptTag(scriptUrl, scriptName) {
  try {
    console.log(`🔍 DEBUG: Injecting ${scriptName} script tag from ${scriptUrl}`);
    
    // First, remove any existing script with same id
    const existingScript = document.getElementById(`bc-${scriptName}`);
    if (existingScript) {
      console.log(`🔍 DEBUG: Removing existing ${scriptName} script`);
      existingScript.remove();
    }
    
    // Create a new script element
    const script = document.createElement('script');
    script.id = `bc-${scriptName}`;
    script.src = scriptUrl;
    script.type = 'text/javascript';
    
    // Create a promise to track loading
    return new Promise((resolve, reject) => {
      script.onload = () => {
        console.log(`🔍 DEBUG: ${scriptName} script loaded successfully`);
        
        // For ShadowDOMHighlighter, check if it actually registered globally
        if (scriptName === 'ShadowDOMHighlighter') {
          if (window.ShadowDOMHighlighter) {
            console.log('🔍 DEBUG: ShadowDOMHighlighter found in window object ✓');
            resolve({ success: true, registered: true });
          } else {
            console.error('🚨 ERROR: ShadowDOMHighlighter not found in window object after loading ✗');
            resolve({ success: true, registered: false });
          }
        } else {
          resolve({ success: true });
        }
      };
      
      script.onerror = (error) => {
        console.error(`🚨 ERROR: Failed to load ${scriptName} script:`, error);
        reject({ success: false, error: 'Script loading failed' });
      };
      
      // Add to document head
      document.head.appendChild(script);
      console.log(`🔍 DEBUG: ${scriptName} script tag added to document`);
    });
  } catch (error) {
    console.error(`🚨 ERROR: Exception injecting ${scriptName} script:`, error);
    return { success: false, error: error.message };
  }
}

// Function to create elementSelector directly in the page context
function createElementSelector() {
  try {
    console.log('🔍 DEBUG: Creating elementSelector directly');
    
    // Verify ShadowDOMHighlighter is available
    if (!window.ShadowDOMHighlighter) {
      console.error('🚨 ERROR: ShadowDOMHighlighter not available, cannot create elementSelector');
      
      // Create a visual indicator
      const indicator = document.createElement('div');
      indicator.style.position = 'fixed';
      indicator.style.top = '10px';
      indicator.style.left = '10px';
      indicator.style.backgroundColor = 'rgba(255,0,0,0.9)';
      indicator.style.color = 'white';
      indicator.style.padding = '10px';
      indicator.style.borderRadius = '5px';
      indicator.style.zIndex = '2147483647';
      indicator.style.fontFamily = 'monospace';
      indicator.textContent = 'ERROR: ShadowDOMHighlighter not available ✗';
      document.body.appendChild(indicator);
      
      // Remove after 10 seconds
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.remove();
        }
      }, 10000);
      
      return { success: false, error: 'ShadowDOMHighlighter not available' };
    }
    
    // Create the basic elementSelector object
    window.elementSelector = {
      selectionMode: false,
      selectedElements: new Map(),
      nextElementId: 1,
      highlightedElement: null,
      
      // Initialize shadow DOM highlighter
      shadowDOMHighlighter: new window.ShadowDOMHighlighter(),
      useShadowDOM: true,
      
      // Minimal version of required methods
      toggleSelectionMode() {
        console.log('🔍 DEBUG: Toggling selection mode');
        this.selectionMode = !this.selectionMode;
        
        const indicator = document.createElement('div');
        indicator.style.position = 'fixed';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.backgroundColor = this.selectionMode ? 'rgba(0,200,0,0.9)' : 'rgba(200,0,0,0.9)';
        indicator.style.color = 'white';
        indicator.style.padding = '8px 15px';
        indicator.style.borderRadius = '5px';
        indicator.style.zIndex = '2147483647';
        indicator.textContent = `Selection Mode: ${this.selectionMode ? 'ON' : 'OFF'}`;
        document.body.appendChild(indicator);
        
        // Remove after 3 seconds
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.remove();
          }
        }, 3000);
        
        return this.selectionMode;
      },
      
      // Placeholder for other methods
      initializeTracking() {
        console.log('🔍 DEBUG: Initializing tracking with ShadowDOMHighlighter');
        this.shadowDOMHighlighter.setupElementTracking();
        return true;
      },
      
      createDebugIndicator(message = 'Direct Injection: Success') {
        try {
          const indicator = document.createElement('div');
          indicator.id = 'browser-connect-debug-indicator';
          indicator.style.position = 'fixed';
          indicator.style.bottom = '40px';
          indicator.style.left = '10px';
          indicator.style.backgroundColor = 'rgba(0,255,0,0.9)';
          indicator.style.color = 'white';
          indicator.style.padding = '8px 15px';
          indicator.style.borderRadius = '5px';
          indicator.style.zIndex = '2147483647';
          indicator.style.fontFamily = 'monospace';
          indicator.textContent = message;
          document.body.appendChild(indicator);
          
          // Remove after 10 seconds
          setTimeout(() => {
            if (indicator.parentNode) {
              indicator.remove();
            }
          }, 10000);
          
          return true;
        } catch (error) {
          console.error('🚨 ERROR: Failed to create debug indicator:', error);
          return false;
        }
      }
    };
    
    // Create window.browserConnectAPI
    window.browserConnectAPI = {
      isReady: true,
      toggleSelectionMode: function() {
        return window.elementSelector.toggleSelectionMode();
      }
    };
    
    // Initialize tracking
    window.elementSelector.initializeTracking();
    
    // Create a visual indicator of success
    window.elementSelector.createDebugIndicator('Direct Injection: elementSelector created successfully ✓');
    
    return { 
      success: true,
      elementSelector: !!window.elementSelector,
      browserConnectAPI: !!window.browserConnectAPI
    };
  } catch (error) {
    console.error('🚨 ERROR: Exception creating elementSelector:', error);
    return { success: false, error: error.message };
  }
} 