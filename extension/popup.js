/**
 * Popup main script
 * Initializes and connects the popup modules
 */

// Import modules
import { 
  ConnectionManager, 
  ElementDisplayManager, 
  SelectionManager, 
  UIUtils 
} from './js/popup-modules/index.js';

// Initialize modules in sequence with dependencies
document.addEventListener('DOMContentLoaded', () => {
  // First initialize UI utilities
  const uiUtils = new UIUtils();
  
  // Initialize selection manager
  const selectionManager = new SelectionManager(uiUtils);
  window.selectionManager = selectionManager; // Make available globally for debug purposes
  
  // Initialize element display manager
  const elementDisplayManager = new ElementDisplayManager(uiUtils);
  
  // Initialize connection manager last as it depends on the others
  const connectionManager = new ConnectionManager(uiUtils);
  
  // Check connection status
  connectionManager.checkConnectionStatus();
  
  // Load selected elements
  elementDisplayManager.loadSelectedElements();
  
  // Forward selection events to server
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'element-selected') {
      // Already handled by ElementDisplayManager for UI
      
      // Forward to server if connected, but only if not already being forwarded (no forSocket flag)
      // AND not already processed
      if (!message.forSocket && !message.processed) {
        // Mark as processed to prevent duplicates
        message.processed = true;
        
        const socket = connectionManager.getSocketConnection();
        if (socket && socket.connected) {
          socket.emit('selected-element', message.data);
          uiUtils.log('Forwarded selected element to server', message.data);
        }
      }
    }
  });
});