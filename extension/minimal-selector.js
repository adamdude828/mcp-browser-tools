/**
 * Minimal Selector - A lightweight version of the element selector
 * that works in restrictive CSP environments
 */

(function() {
  console.log('🔍 DEBUG: Minimal selector loaded');
  
  // Create global namespace to avoid conflicts
  window.BrowserConnect = window.BrowserConnect || {};
  
  // Setup state
  let selectionModeActive = false;
  let tempHighlight = null;
  let selectedElements = [];
  let nextElementId = 1;
  
  // Create indicator to show status
  function showIndicator(message, color) {
    try {
      const indicator = document.createElement('div');
      indicator.style.position = 'fixed';
      indicator.style.top = '10px';
      indicator.style.right = '10px';
      indicator.style.backgroundColor = color || 'rgba(0, 128, 255, 0.8)';
      indicator.style.color = 'white';
      indicator.style.padding = '10px';
      indicator.style.borderRadius = '4px';
      indicator.style.zIndex = '2147483647';
      indicator.style.fontWeight = 'bold';
      indicator.textContent = message;
      document.body.appendChild(indicator);
      
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.remove();
        }
      }, 3000);
      
      return true;
    } catch (e) {
      console.error('Error creating indicator:', e);
      return false;
    }
  }
  
  // Create the minimal element selector
  window.BrowserConnect.toggleSelectionMode = function() {
    selectionModeActive = !selectionModeActive;
    console.log('Selection mode toggled to:', selectionModeActive);
    
    if (selectionModeActive) {
      document.body.style.cursor = 'crosshair';
      showIndicator('Selection Mode: ON', 'rgba(0, 200, 0, 0.9)');
      
      // Add event listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('click', handleClick, true);
    } else {
      document.body.style.cursor = '';
      showIndicator('Selection Mode: OFF', 'rgba(200, 0, 0, 0.9)');
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick, true);
      
      // Clear any temporary highlight
      if (tempHighlight && tempHighlight.parentNode) {
        tempHighlight.remove();
        tempHighlight = null;
      }
    }
    
    return selectionModeActive;
  };
  
  // Get a basic CSS selector for an element
  function getSimpleSelector(element) {
    if (!element) return '';
    
    if (element.id) {
      return `#${element.id}`;
    }
    
    let selector = element.tagName.toLowerCase();
    if (element.className) {
      const classes = element.className.split(/\s+/).filter(c => c);
      if (classes.length) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    return selector;
  }
  
  // Handle mousemove for highlighting
  function handleMouseMove(event) {
    if (!selectionModeActive) return;
    
    // Skip if it's one of our own indicators
    if (event.target.id === 'bc-temp-highlight' || 
        event.target.classList.contains('bc-element-highlight') ||
        event.target.classList.contains('bc-element-label')) {
      return;
    }
    
    // Clear previous highlight
    if (tempHighlight && tempHighlight.parentNode) {
      tempHighlight.remove();
    }
    
    // Create new highlight
    const rect = event.target.getBoundingClientRect();
    tempHighlight = document.createElement('div');
    tempHighlight.id = 'bc-temp-highlight';
    tempHighlight.style.position = 'fixed';
    tempHighlight.style.top = rect.top + 'px';
    tempHighlight.style.left = rect.left + 'px';
    tempHighlight.style.width = rect.width + 'px';
    tempHighlight.style.height = rect.height + 'px';
    tempHighlight.style.border = '2px solid #00a8ff';
    tempHighlight.style.backgroundColor = 'rgba(0, 168, 255, 0.1)';
    tempHighlight.style.zIndex = '999999';
    tempHighlight.style.pointerEvents = 'none';
    document.body.appendChild(tempHighlight);
  }
  
  // Handle click for selection
  function handleClick(event) {
    if (!selectionModeActive) return;
    
    // Skip if it's our own UI element
    if (event.target.id === 'bc-temp-highlight' || 
        event.target.classList.contains('bc-element-highlight') ||
        event.target.classList.contains('bc-element-label')) {
      return;
    }
    
    // Prevent default action
    event.preventDefault();
    event.stopPropagation();
    
    // Get text content for suggestion
    const textContent = event.target.innerText || '';
    const suggestion = textContent.substring(0, 20).trim() || event.target.tagName.toLowerCase();
    
    // Ask for a label
    const label = prompt('Enter a label for this element:', suggestion);
    
    if (label === null) return; // User cancelled
    
    // Generate a unique ID
    const elementId = `bc-element-${nextElementId++}`;
    
    // Add to selected elements
    selectedElements.push({
      element: event.target,
      elementId: elementId,
      label: label.trim(),
      cssSelector: getSimpleSelector(event.target),
      innerText: textContent.substring(0, 100).trim(),
      timestamp: Date.now()
    });
    
    // Show confirmation
    showIndicator(`Element "${label}" selected`, 'rgba(0, 200, 0, 0.9)');
    
    // Create permanent highlight
    const rect = event.target.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'bc-element-highlight';
    highlight.dataset.elementId = elementId;
    highlight.style.position = 'absolute';
    highlight.style.top = (window.scrollY + rect.top) + 'px';
    highlight.style.left = (window.scrollX + rect.left) + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.border = '2px solid #4CAF50';
    highlight.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
    highlight.style.zIndex = '999998';
    document.body.appendChild(highlight);
    
    // Add label
    const labelElement = document.createElement('div');
    labelElement.className = 'bc-element-label';
    labelElement.textContent = label;
    labelElement.style.position = 'absolute';
    labelElement.style.top = '-22px';
    labelElement.style.left = '0';
    labelElement.style.backgroundColor = '#4CAF50';
    labelElement.style.color = 'white';
    labelElement.style.padding = '2px 5px';
    labelElement.style.borderRadius = '3px';
    labelElement.style.fontSize = '12px';
    highlight.appendChild(labelElement);
    
    // Add delete button
    const deleteButton = document.createElement('div');
    deleteButton.className = 'bc-element-delete';
    deleteButton.textContent = '✖';
    deleteButton.style.position = 'absolute';
    deleteButton.style.top = '-22px';
    deleteButton.style.right = '0';
    deleteButton.style.backgroundColor = '#F44336';
    deleteButton.style.color = 'white';
    deleteButton.style.padding = '2px 5px';
    deleteButton.style.borderRadius = '3px';
    deleteButton.style.fontSize = '12px';
    deleteButton.style.cursor = 'pointer';
    
    // Add click handler for delete button
    deleteButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Remove highlight
      highlight.remove();
      
      // Remove from selected elements
      const index = selectedElements.findIndex(item => item.elementId === elementId);
      if (index !== -1) {
        selectedElements.splice(index, 1);
      }
      
      showIndicator('Element deleted', 'rgba(255, 0, 0, 0.8)');
    });
    
    highlight.appendChild(deleteButton);
    
    // Try to notify extension if possible
    try {
      const message = {
        type: 'element-selected',
        data: {
          elementId,
          label: label.trim(),
          url: window.location.href,
          cssSelector: getSimpleSelector(event.target),
          innerText: textContent.substring(0, 100).trim(),
          timestamp: Date.now()
        }
      };
      
      if (window.postMessage) {
        window.postMessage({
          source: 'browser-connect-minimal-selector',
          message
        }, '*');
      }
    } catch (e) {
      console.error('Could not notify extension:', e);
    }
  }
  
  // Add to window for access by background script
  window.bcToggleSelectionMode = window.BrowserConnect.toggleSelectionMode;
  
  window.browserConnectAPI = {
    isReady: true,
    toggleSelectionMode: window.BrowserConnect.toggleSelectionMode,
    getSelectedElements: function() {
      return { 
        elements: selectedElements.map(item => ({
          elementId: item.elementId,
          label: item.label,
          cssSelector: item.cssSelector,
          innerText: item.innerText,
          timestamp: item.timestamp
        }))
      };
    },
    clearElements: function() {
      // Remove all highlights
      document.querySelectorAll('.bc-element-highlight').forEach(el => el.remove());
      selectedElements = [];
      return { success: true };
    }
  };
  
  // Show indicator that script is loaded
  showIndicator('Browser Connect: Ready', 'rgba(0, 128, 255, 0.9)');
  
  // Add a listener for messages from extension
  window.addEventListener('message', function(event) {
    // Only listen to messages from our extension
    if (event.source !== window || !event.data || event.data.source !== 'browser-connect-extension') {
      return;
    }
    
    const message = event.data.message;
    console.log('Received message from extension:', message);
    
    if (message.type === 'toggle-selection-mode') {
      const result = window.BrowserConnect.toggleSelectionMode();
      
      // Respond back to extension
      window.postMessage({
        source: 'browser-connect-minimal-selector',
        response: {
          type: 'toggle-selection-mode-response',
          requestId: message.requestId,
          success: true,
          selectionMode: result
        }
      }, '*');
    }
  });
  
  console.log('🔍 DEBUG: Minimal selector initialized');
})(); 