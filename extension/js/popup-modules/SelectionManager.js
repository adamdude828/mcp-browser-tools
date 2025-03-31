/**
 * SelectionManager.js
 * Manages element selection mode and interaction with content script
 */

class SelectionManager {
  constructor(uiUtils) {
    this.uiUtils = uiUtils;
    this.selectionModeActive = false;
    
    // Cache DOM elements
    this.startSelectionBtn = document.getElementById('startSelectionBtn');
    
    // Set up event listeners
    this.startSelectionBtn.addEventListener('click', () => this.toggleSelectionMode());
  }

  /**
   * Toggle element selection mode
   */
  toggleSelectionMode() {
    console.log('Toggling selection mode from popup');
    
    // Show a notification to the user
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #2196F3;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 9999;
      font-weight: bold;
    `;
    notification.textContent = 'Selection mode activating...';
    document.body.appendChild(notification);
    
    // Call the background script to toggle selection mode
    chrome.runtime.sendMessage({ type: 'toggle-selection-mode-from-popup' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error toggling selection mode:', chrome.runtime.lastError);
        notification.textContent = 'Error activating selection mode';
        notification.style.backgroundColor = '#f44336';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
        return;
      }
      
      // If successful, close the popup to get out of the way
      window.close();
    });
  }

  /**
   * Update selection button state based on active state
   */
  updateSelectionButtonState() {
    if (this.selectionModeActive) {
      this.startSelectionBtn.textContent = 'Stop Selection Mode';
      this.startSelectionBtn.style.backgroundColor = '#f44336';
    } else {
      this.startSelectionBtn.textContent = 'Start Selection Mode';
      this.startSelectionBtn.style.backgroundColor = '#2196F3';
    }
  }

  /**
   * Set selection mode state
   * @param {boolean} active - Whether selection mode is active
   */
  setSelectionModeActive(active) {
    this.selectionModeActive = active;
    this.updateSelectionButtonState();
  }

  /**
   * Get selection mode state
   * @returns {boolean} Whether selection mode is active
   */
  isSelectionModeActive() {
    return this.selectionModeActive;
  }
}

export default SelectionManager; 