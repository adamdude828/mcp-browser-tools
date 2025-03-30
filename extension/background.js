// Window tracking
let windowId = null;

// Element selection tracking
let selectedElements = [];

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Default server URL
  chrome.storage.sync.set({ serverUrl: "http://localhost:3000" });
});

// When extension icon is clicked
chrome.action.onClicked.addListener(() => {
  if (windowId) {
    // Focus existing window
    chrome.windows.update(windowId, { focused: true });
  } else {
    // Create new window
    chrome.windows.create({
      url: chrome.runtime.getURL('window.html'),
      type: 'popup',
      width: 800,
      height: 600
    }, (window) => {
      windowId = window.id;
    });
  }
});

// Track window closure
chrome.windows.onRemoved.addListener((removedWindowId) => {
  if (removedWindowId === windowId) {
    windowId = null;
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'element-selected') {
    // Store the selected element data
    const elementData = message.data;
    elementData.timestamp = Date.now();
    selectedElements.push(elementData);
    
    console.log('Element selected:', elementData);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'get-selected-elements') {
    sendResponse({ elements: selectedElements });
    return true;
  }
  
  if (message.type === 'toggle-selection-mode-from-popup') {
    console.log('Received toggle-selection-mode-from-popup message');
    toggleSelectionMode();
    sendResponse({ success: true });
    return true;
  }
});

// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-selection-mode') {
    console.log('Keyboard shortcut pressed: toggle-selection-mode');
    toggleSelectionMode();
  }
});

// Function to toggle selection mode
function toggleSelectionMode() {
  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      console.error('No active tab found');
      return;
    }
    
    const activeTab = tabs[0];
    
    // Check if we can access the tab (some URLs like chrome:// cannot be accessed)
    if (!activeTab.url || activeTab.url.startsWith('chrome://')) {
      console.error('Cannot access this page - restricted URL');
      return;
    }
    
    // Try to send a message to the content script
    chrome.tabs.sendMessage(activeTab.id, { type: 'toggle-selection-mode' }, (response) => {
      // Check if there was an error (content script might not be loaded)
      if (chrome.runtime.lastError) {
        console.log('Error sending message to content script, injecting it now:', chrome.runtime.lastError);
        
        // Content script is not loaded, try to inject it
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content-script.js']
        }).then(() => {
          console.log('Content script injected, trying to toggle selection mode again');
          
          // Try again after a short delay to ensure the script is loaded
          setTimeout(() => {
            chrome.tabs.sendMessage(activeTab.id, { type: 'toggle-selection-mode' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Failed to toggle selection mode after injection:', chrome.runtime.lastError);
              } else {
                console.log('Selection mode toggled after injection:', response);
              }
            });
          }, 500);
        }).catch(err => {
          console.error('Failed to inject content script:', err);
        });
        
        return;
      }
      
      // Content script responded
      if (response && response.success) {
        console.log('Selection mode toggled successfully:', response.selectionMode);
      } else {
        console.error('Unexpected response from content script:', response);
      }
    });
  });
} 