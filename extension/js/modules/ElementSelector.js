// Element Selection Module for Browser Connect
// Handles the selection and management of elements on the page

import ElementHighlighter from './ElementHighlighter.js';
import UIManager from './UIManager.js';
import DOMUtils from './DOMUtils.js';

/**
 * Class to manage element selection and tracking
 */
class ElementSelector {
  /**
   * Constructor - initialize element selector
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    console.log('🔍 BROWSER CONNECT: ElementSelector initialized', new Date().toISOString());
    
    this.selectionMode = false;
    this.selectedElements = new Map(); // Map to store labeled elements (elementId -> {element, label, etc})
    this.nextElementId = 1;
    
    // Initialize dependencies
    this.highlighter = new ElementHighlighter();
    this.ui = new UIManager();
    
    // Bind methods to maintain this context
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    
    // Add event listeners
    this.setupEventListeners();
    
    console.log('Browser Connect: Element Selector initialized');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true); // Use capture phase
    
    // Add tab change detection
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Tab is being hidden - the user is navigating away
        console.log('Tab visibility changed to hidden, clearing selections');
        this.clearAllSelectedElements('tab-changed');
      }
    });
    
    // Listen for messages from the extension background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Browser Connect: Received message', message);
      
      if (message.type === 'toggle-selection-mode') {
        this.toggleSelectionMode();
        sendResponse({ success: true, selectionMode: this.selectionMode });
        return true;
      }
      
      if (message.type === 'get-selected-elements') {
        const elements = this.getSelectedElementsData();
        sendResponse({ elements });
        return true;
      }
      
      if (message.type === 'highlight-all-elements') {
        this.highlightAllSelectedElements();
        sendResponse({ success: true });
        return true;
      }
      
      if (message.type === 'hide-all-elements') {
        this.hideAllSelectedElements();
        sendResponse({ success: true });
        return true;
      }
      
      if (message.type === 'clear-selected-elements') {
        this.clearAllSelectedElements('user-initiated');
        sendResponse({ success: true });
        return true;
      }
      
      if (message.type === 'clear-all-highlights') {
        this.clearElementHighlights();
        sendResponse({ success: true });
        return true;
      }
      
      if (message.type === 'console-log') {
        this.ui.displayConsoleLog(message.data);
        sendResponse({ success: true });
        return true;
      }
      
      // For any other message, send a default response
      sendResponse({ success: false, error: 'Unknown message type' });
      return true;
    });
  }

  /**
   * Toggle selection mode on/off
   */
  toggleSelectionMode() {
    if (this.selectionMode) {
      this.stopSelectionMode();
    } else {
      this.startSelectionMode();
    }
    
    console.log('Browser Connect: Selection mode toggled to', this.selectionMode);
  }

  /**
   * Start selection mode
   */
  startSelectionMode() {
    this.selectionMode = true;
    document.body.style.cursor = 'crosshair';
    
    // Add a visible indicator
    this.highlighter.createSelectionModeIndicator();
    
    // Auto-highlight all selected elements when entering selection mode
    this.highlightAllSelectedElements();
    
    console.log('Browser Connect: Element selection mode activated');
  }

  /**
   * Stop selection mode
   */
  stopSelectionMode() {
    this.selectionMode = false;
    document.body.style.cursor = '';
    
    // Remove temporary highlight
    this.highlighter.clearHighlight();
    
    // Remove the indicator
    this.highlighter.removeSelectionModeIndicator();
    
    console.log('Browser Connect: Element selection mode deactivated');
  }

  /**
   * Handle mouse movement for highlighting elements
   * @param {MouseEvent} event - Mouse move event
   */
  handleMouseMove(event) {
    if (!this.selectionMode) return;
    
    // Ignore our own UI elements
    if (DOMUtils.isBrowserConnectElement(event.target)) {
      return;
    }
    
    this.highlighter.highlightElement(event.target);
  }

  /**
   * Handle element selection
   * @param {MouseEvent} event - Click event
   */
  handleClick(event) {
    if (!this.selectionMode) return;
    
    // Ignore our own UI elements
    if (DOMUtils.isBrowserConnectElement(event.target)) {
      return;
    }
    
    // Prevent the click from triggering other elements
    event.preventDefault();
    event.stopPropagation();
    
    // Show labeling modal
    this.showLabelingModal(event.target);
  }

  /**
   * Show modal for labeling the selected element
   * @param {HTMLElement} element - The element to label
   */
  showLabelingModal(element) {
    this.ui.showInputModal({
      title: 'Label this element',
      placeholder: 'Enter a label',
      confirmText: 'Save',
      cancelText: 'Cancel'
    })
    .then(label => {
      this.labelElement(element, label || 'Unlabeled');
    })
    .catch(error => {
      console.log('Labeling canceled:', error.message);
      // Keep selection mode active - don't stop it
    });
  }

  /**
   * Label and store the selected element
   * @param {HTMLElement} element - The element to label
   * @param {string} label - The label to apply to the element
   */
  labelElement(element, label) {
    // Mark element as selected
    this.highlighter.markElementAsSelected(element);
    
    // Create a unique ID for this element
    const elementId = `browser-connect-element-${this.nextElementId++}`;
    element.dataset.browserConnectId = elementId;
    
    // Add label to element
    this.highlighter.addLabelToElement(element, label);
    
    // Get the HTML content of the element
    const outerHTML = element.outerHTML;
    
    // Debug: Log the captured HTML content
    console.log('Browser Connect: Captured HTML content:', outerHTML);
    
    // Create element data
    const elementData = {
      elementId,
      label,
      url: window.location.href,
      xpath: DOMUtils.getXPath(element),
      cssSelector: DOMUtils.getCssSelector(element),
      innerText: element.innerText ? element.innerText.substring(0, 100) : '',
      tagName: element.tagName,
      html: outerHTML, // Add the HTML content
      timestamp: Date.now()
    };
    
    // Debug: Log the element data being sent
    console.log('Browser Connect: Element data to be sent:', JSON.stringify({
      ...elementData,
      html: elementData.html.length > 50 ? 
            elementData.html.substring(0, 50) + '... [truncated for log]' : 
            elementData.html
    }));
    
    // Store the element and its data
    this.selectedElements.set(elementId, {
      element,
      label,
      xpath: DOMUtils.getXPath(element),
      cssSelector: DOMUtils.getCssSelector(element),
      html: outerHTML, // Store the HTML content
      timestamp: Date.now()
    });
    
    // Send data to background script
    chrome.runtime.sendMessage({
      type: 'element-selected',
      data: elementData
    });
    
    // Also emit a socket event for the server
    chrome.runtime.sendMessage({
      type: 'socket-emit',
      event: 'zone-added',
      data: elementData
    });
    
    console.log(`Browser Connect: Element labeled as "${label}"`);
  }

  /**
   * Get data about all selected elements
   * @returns {Array} Array of selected element data
   */
  getSelectedElementsData() {
    return Array.from(this.selectedElements.entries()).map(([id, data]) => ({
      id,
      label: data.label,
      xpath: data.xpath,
      cssSelector: data.cssSelector,
      tagName: data.element ? data.element.tagName : 'UNKNOWN',
      timestamp: data.timestamp || Date.now()
    }));
  }

  /**
   * Highlight all selected elements
   */
  highlightAllSelectedElements() {
    const count = this.selectedElements.size;
    if (count === 0) {
      console.log('No elements to highlight');
      return;
    }
    
    // Show status notification
    this.highlighter.showStatusNotification(`${count} element(s) highlighted`, 'success');
    
    // Ensure all elements have their label displayed
    this.selectedElements.forEach((data) => {
      if (data.element) {
        this.highlighter.markElementAsSelected(data.element);
        
        // Make sure the label is visible
        let labelElement = data.element.querySelector('.browser-connect-label');
        if (!labelElement) {
          this.highlighter.addLabelToElement(data.element, data.label);
        } else {
          labelElement.style.display = '';  // Reset to default display
        }
      }
    });
  }

  /**
   * Hide all selected elements (just visually)
   */
  hideAllSelectedElements() {
    const count = this.selectedElements.size;
    if (count === 0) {
      console.log('No elements to hide');
      return;
    }
    
    // Show status notification
    this.highlighter.showStatusNotification(`${count} element(s) hidden`, 'default');
    
    // Hide all elements
    this.selectedElements.forEach((data) => {
      if (data.element) {
        this.highlighter.unmarkSelectedElement(data.element);
        
        // Hide the label if it exists
        const labelElement = data.element.querySelector('.browser-connect-label');
        if (labelElement) {
          labelElement.style.display = 'none';
        }
      }
    });
  }

  /**
   * Clear all selected elements
   * @param {string} reason - Reason for clearing elements
   */
  clearAllSelectedElements(reason = 'user-initiated') {
    // Get element IDs before clearing the map
    const elementIds = Array.from(this.selectedElements.keys());
    
    // Clear existing selections
    this.selectedElements.forEach((data, id) => {
      const { element } = data;
      if (element) {
        try {
          // Remove selection highlights and labels
          element.classList.remove('browser-connect-highlight', 'browser-connect-selected');
          this.highlighter.removeLabelFromElement(element);
          
          // Remove custom dataset
          delete element.dataset.browserConnectId;
        } catch (e) {
          console.error('Error removing element selection:', e);
        }
      }
    });
    
    // Clear the collection
    this.selectedElements.clear();
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'elements-cleared',
      reason
    });
    
    // Also emit a socket event for the server
    chrome.runtime.sendMessage({
      type: 'socket-emit',
      event: 'zones-deleted',
      data: {
        reason,
        elementIds,
        url: window.location.href,
        timestamp: Date.now()
      }
    });
    
    console.log('Browser Connect: All element selections cleared');
  }

  /**
   * Clear element highlights without clearing selection list
   */
  clearElementHighlights() {
    this.selectedElements.forEach((data) => {
      if (data.element) {
        this.highlighter.unmarkSelectedElement(data.element);
        this.highlighter.removeLabelFromElement(data.element);
      }
    });
    
    console.log('All element highlights cleared');
  }
}

export default ElementSelector; 