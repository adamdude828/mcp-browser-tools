// Element Highlighting Module for Browser Connect
// Handles the visual highlighting of elements on the page

/**
 * Class to manage element highlighting
 */
class ElementHighlighter {
  constructor() {
    this.currentHighlightedElement = null;
    this.styles = this.getHighlightStyles();
    this.injectStyles();
  }

  /**
   * Get the CSS styles for highlighting elements
   * @returns {string} CSS styles
   */
  getHighlightStyles() {
    return `
      .browser-connect-highlight {
        outline: 2px solid #2196F3 !important;
        outline-offset: 1px !important;
        position: relative !important;
      }
      
      .browser-connect-selected {
        outline: 2px solid #4CAF50 !important;
        outline-offset: 1px !important;
        position: relative !important;
      }
      
      .browser-connect-label {
        position: absolute;
        top: -25px;
        left: 0;
        background-color: #4CAF50;
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 12px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      }
    `;
  }

  /**
   * Inject styles into the document head
   */
  injectStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = this.styles;
    document.head.appendChild(styleElement);
    console.log('Browser Connect: Highlight styles injected');
  }

  /**
   * Highlight an element temporarily during hover
   * @param {HTMLElement} element - The element to highlight
   */
  highlightElement(element) {
    if (this.currentHighlightedElement) {
      this.currentHighlightedElement.classList.remove('browser-connect-highlight');
    }
    
    this.currentHighlightedElement = element;
    this.currentHighlightedElement.classList.add('browser-connect-highlight');
  }

  /**
   * Clear the current highlight from an element
   */
  clearHighlight() {
    if (this.currentHighlightedElement) {
      this.currentHighlightedElement.classList.remove('browser-connect-highlight');
      this.currentHighlightedElement = null;
    }
  }

  /**
   * Add selection highlight to an element
   * @param {HTMLElement} element - The element to mark as selected
   */
  markElementAsSelected(element) {
    element.classList.remove('browser-connect-highlight');
    element.classList.add('browser-connect-selected');
  }

  /**
   * Remove selection highlight from an element
   * @param {HTMLElement} element - The element to unmark
   */
  unmarkSelectedElement(element) {
    element.classList.remove('browser-connect-selected');
  }

  /**
   * Add a label to a selected element
   * @param {HTMLElement} element - The element to label
   * @param {string} label - The label text
   * @returns {HTMLElement} The created label element
   */
  addLabelToElement(element, label) {
    // Create label element
    const labelElement = document.createElement('div');
    labelElement.className = 'browser-connect-label';
    labelElement.textContent = label;
    
    // Adjust position if element is at the top of the page
    const rect = element.getBoundingClientRect();
    if (rect.top < 30) {
      labelElement.style.top = 'auto';
      labelElement.style.bottom = '-25px';
    }
    
    // Add label to element
    element.style.position = 'relative';
    element.appendChild(labelElement);
    
    return labelElement;
  }

  /**
   * Remove a label from an element
   * @param {HTMLElement} element - The element containing the label
   */
  removeLabelFromElement(element) {
    const label = element.querySelector('.browser-connect-label');
    if (label) {
      label.remove();
    }
  }

  /**
   * Create and display a selection mode indicator
   * @returns {HTMLElement} The created indicator element
   */
  createSelectionModeIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'browser-connect-mode-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background-color: rgba(33, 150, 243, 0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 3px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 10000;
      font-size: 12px;
    `;
    indicator.textContent = 'Selection Mode: ON';
    document.body.appendChild(indicator);
    return indicator;
  }

  /**
   * Remove the selection mode indicator
   */
  removeSelectionModeIndicator() {
    const indicator = document.getElementById('browser-connect-mode-indicator');
    if (indicator) {
      document.body.removeChild(indicator);
    }
  }

  /**
   * Display a status notification on the page
   * @param {string} message - The message to display
   * @param {string} type - The type of notification (success, info, etc.)
   * @param {number} duration - How long to show the notification (ms)
   */
  showStatusNotification(message, type = 'success', duration = 3000) {
    const colors = {
      success: 'rgba(76, 175, 80, 0.9)',
      info: 'rgba(33, 150, 243, 0.9)',
      warning: 'rgba(255, 152, 0, 0.9)',
      error: 'rgba(244, 67, 54, 0.9)',
      default: 'rgba(158, 158, 158, 0.9)'
    };
    
    const statusIndicator = document.createElement('div');
    statusIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background-color: ${colors[type] || colors.default};
      color: white;
      padding: 10px;
      border-radius: 4px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    statusIndicator.textContent = message;
    document.body.appendChild(statusIndicator);
    
    // Remove after specified duration
    setTimeout(() => {
      if (statusIndicator.parentNode) {
        document.body.removeChild(statusIndicator);
      }
    }, duration);
    
    return statusIndicator;
  }
}

export default ElementHighlighter; 