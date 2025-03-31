// UI Manager Module for Browser Connect
// Handles UI components like modals, overlays, and console output

/**
 * Class to manage UI components
 */
class UIManager {
  constructor() {
    this.consoleElement = null;
    this.injectStyles();
  }

  /**
   * Inject UI-related styles into the document
   */
  injectStyles() {
    const styles = `
      .browser-connect-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: white;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      }
      
      .browser-connect-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        z-index: 10000;
      }
      
      .browser-connect-modal input {
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      
      .browser-connect-modal button {
        padding: 8px 16px;
        background-color: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .browser-connect-modal button.cancel {
        background-color: #f44336;
      }
      
      .browser-connect-modal .buttons {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
      }
      
      .browser-connect-console {
        position: fixed;
        bottom: 10px;
        right: 10px;
        background-color: rgba(0, 0, 0, 0.8);
        color: #00ff00;
        font-family: monospace;
        padding: 10px;
        border-radius: 5px;
        max-width: 400px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 10000;
        font-size: 12px;
        line-height: 1.5;
        transition: all 0.3s ease;
      }
      
      .browser-connect-console-entry {
        margin-bottom: 5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 5px;
      }
      
      .browser-connect-console-entry.error {
        color: #ff5555;
      }
      
      .browser-connect-console-timestamp {
        color: #aaaaaa;
        font-size: 10px;
        margin-right: 5px;
      }
      
      .browser-connect-console-close {
        position: absolute;
        top: 5px;
        right: 5px;
        color: white;
        cursor: pointer;
        font-size: 14px;
      }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
    console.log('Browser Connect: UI styles injected');
  }

  /**
   * Show a modal dialog with a text input
   * @param {Object} options - Modal options
   * @returns {Promise} Promise that resolves with input value or rejects if canceled
   */
  showInputModal(options = {}) {
    const {
      title = 'Input',
      placeholder = 'Enter value',
      defaultValue = '',
      confirmText = 'Save',
      cancelText = 'Cancel'
    } = options;
    
    return new Promise((resolve, reject) => {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'browser-connect-overlay';
      
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'browser-connect-modal';
      
      // Create title
      const titleElement = document.createElement('h3');
      titleElement.textContent = title;
      titleElement.style.margin = '0 0 10px 0';
      
      // Create input
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.value = defaultValue;
      
      // Create buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'buttons';
      
      // Create confirm button
      const confirmButton = document.createElement('button');
      confirmButton.textContent = confirmText;
      confirmButton.addEventListener('click', () => {
        const value = input.value.trim();
        
        try {
          document.body.removeChild(overlay);
          document.body.removeChild(modal);
        } catch (e) {
          console.error('Error removing modal:', e);
        }
        
        resolve(value || defaultValue);
      });
      
      // Create cancel button
      const cancelButton = document.createElement('button');
      cancelButton.textContent = cancelText;
      cancelButton.className = 'cancel';
      cancelButton.addEventListener('click', () => {
        try {
          document.body.removeChild(overlay);
          document.body.removeChild(modal);
        } catch (e) {
          console.error('Error removing modal:', e);
        }
        
        reject(new Error('User canceled'));
      });
      
      // Add buttons to container
      buttonsContainer.appendChild(confirmButton);
      buttonsContainer.appendChild(cancelButton);
      
      // Add all elements to modal
      modal.appendChild(titleElement);
      modal.appendChild(input);
      modal.appendChild(buttonsContainer);
      
      // Add modal and overlay to the page
      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      
      // Focus the input
      input.focus();
      
      // Handle Escape key
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          try {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
          } catch (e) {
            console.error('Error removing modal:', e);
          }
          
          document.removeEventListener('keydown', keyHandler);
          reject(new Error('User canceled'));
        }
      };
      
      document.addEventListener('keydown', keyHandler);
    });
  }

  /**
   * Show a confirmation dialog
   * @param {Object} options - Confirmation options
   * @returns {Promise} Promise that resolves if confirmed or rejects if canceled
   */
  showConfirmDialog(options = {}) {
    const {
      title = 'Confirm',
      message = 'Are you sure?',
      confirmText = 'Yes',
      cancelText = 'No'
    } = options;
    
    return new Promise((resolve, reject) => {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'browser-connect-overlay';
      
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'browser-connect-modal';
      
      // Create title
      const titleElement = document.createElement('h3');
      titleElement.textContent = title;
      titleElement.style.margin = '0 0 10px 0';
      
      // Create message
      const messageElement = document.createElement('p');
      messageElement.textContent = message;
      messageElement.style.margin = '0 0 15px 0';
      
      // Create buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'buttons';
      
      // Create confirm button
      const confirmButton = document.createElement('button');
      confirmButton.textContent = confirmText;
      confirmButton.addEventListener('click', () => {
        try {
          document.body.removeChild(overlay);
          document.body.removeChild(modal);
        } catch (e) {
          console.error('Error removing modal:', e);
        }
        
        resolve(true);
      });
      
      // Create cancel button
      const cancelButton = document.createElement('button');
      cancelButton.textContent = cancelText;
      cancelButton.className = 'cancel';
      cancelButton.addEventListener('click', () => {
        try {
          document.body.removeChild(overlay);
          document.body.removeChild(modal);
        } catch (e) {
          console.error('Error removing modal:', e);
        }
        
        reject(new Error('User canceled'));
      });
      
      // Add buttons to container
      buttonsContainer.appendChild(confirmButton);
      buttonsContainer.appendChild(cancelButton);
      
      // Add all elements to modal
      modal.appendChild(titleElement);
      modal.appendChild(messageElement);
      modal.appendChild(buttonsContainer);
      
      // Add modal and overlay to the page
      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      
      // Handle Escape key
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          try {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
          } catch (e) {
            console.error('Error removing modal:', e);
          }
          
          document.removeEventListener('keydown', keyHandler);
          reject(new Error('User canceled'));
        }
      };
      
      document.addEventListener('keydown', keyHandler);
    });
  }

  /**
   * Display a console log message
   * @param {Object} logData - Log data with message, level, and timestamp
   */
  displayConsoleLog(logData) {
    // Format timestamp
    const timestamp = new Date(logData.timestamp).toLocaleTimeString();
    
    // Create or find the console element
    if (!this.consoleElement) {
      this.consoleElement = document.createElement('div');
      this.consoleElement.className = 'browser-connect-console';
      
      // Add close button
      const closeButton = document.createElement('span');
      closeButton.className = 'browser-connect-console-close';
      closeButton.textContent = '×';
      closeButton.addEventListener('click', () => {
        document.body.removeChild(this.consoleElement);
        this.consoleElement = null;
      });
      
      this.consoleElement.appendChild(closeButton);
      document.body.appendChild(this.consoleElement);
    }
    
    // Create a new log entry
    const logEntry = document.createElement('div');
    logEntry.className = 'browser-connect-console-entry';
    if (logData.level === 'error') {
      logEntry.classList.add('error');
    }
    
    // Add timestamp
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'browser-connect-console-timestamp';
    timestampSpan.textContent = timestamp;
    
    // Add message
    const messageText = document.createTextNode(logData.message);
    
    // Combine elements
    logEntry.appendChild(timestampSpan);
    logEntry.appendChild(messageText);
    
    // Add to console
    this.consoleElement.appendChild(logEntry);
    
    // Auto-scroll to bottom
    this.consoleElement.scrollTop = this.consoleElement.scrollHeight;
    
    // Also log to browser console
    if (logData.level === 'error') {
      console.error(`[Browser Connect] ${logData.message}`);
    } else {
      console.log(`[Browser Connect] ${logData.message}`);
    }
  }
}

export default UIManager; 