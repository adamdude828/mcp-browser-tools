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
const elementManager = new ElementSelectionManager(tabManager, uiUpdater);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set up UI
  uiUpdater.initialize();
  
  // Initialize tab manager
  tabManager.initialize(uiUpdater.log.bind(uiUpdater));
  
  // Initialize element selection manager
  elementManager.initialize(uiUpdater.log.bind(uiUpdater));

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
  
  // Listen for socket-emit messages from content scripts via background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    return false;
  });
  
  // Load tabs on startup
  loadTabs();
  
  // Refresh tabs periodically
  setInterval(loadTabs, 5000);
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
      elementManager.resetSelectionMode();
      
      // Update the UI
      uiUpdater.updateActiveTabDisplay(updatedTab);
      
      // Refresh the tabs list to show the selected tab
      loadTabs();
      
      // Load selected elements for this tab
      elementManager.loadSelectedElements();
      
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
          elementManager.loadSelectedElements(); // Refresh the elements list
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
  elementManager.toggleSelectionMode()
    .catch(error => {
      uiUpdater.log('Error toggling selection mode', error.message);
    });
}

// Toggle element highlighting
function toggleElementHighlight() {
  elementManager.toggleHighlightElements()
    .catch(error => {
      uiUpdater.log('Error toggling element highlight', error.message);
    });
}

// Clear all selected elements
function clearAllElements() {
  elementManager.clearAllElements()
    .catch(error => {
      uiUpdater.log('Error clearing elements', error.message);
    });
} 