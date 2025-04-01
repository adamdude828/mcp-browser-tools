/**
 * ShadowDOMHighlighter
 * A module that handles element highlighting using Shadow DOM for style isolation.
 * This implementation addresses React-specific issues by isolating styles and 
 * maintaining stable references to elements through React re-renders.
 */

class ShadowDOMHighlighter {
  constructor() {
    this.highlightedElements = new Map(); // Map of elementId -> highlight host element
    this.tempHighlight = null; // Temporary highlight during selection
    
    // Log initialization
    console.log('🔍 DEBUG: ShadowDOMHighlighter initialized');
  }

  /**
   * Create an isolated highlight using Shadow DOM
   * @param {HTMLElement} element - The element to highlight
   * @param {string} elementId - Unique ID for the element
   * @param {string} label - Label to display with the highlight
   * @returns {HTMLElement} - The created highlight host element
   */
  createIsolatedHighlight(element, elementId, label) {
    // Create a shadow DOM host
    const highlightHost = document.createElement('div');
    highlightHost.setAttribute('data-browser-connect-highlight-host', '');
    highlightHost.setAttribute('data-element-id', elementId);
    document.body.appendChild(highlightHost);
    
    // Attach shadow DOM
    const shadow = highlightHost.attachShadow({ mode: 'open' }); // Changed to open mode for easier debugging
    
    // Position the host element based on the target element
    this.updateHighlightPosition(highlightHost, element);
    
    // Add styles and content to shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      .highlight {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 2px solid #4CAF50;
        background-color: rgba(76, 175, 80, 0.2);
        box-sizing: border-box;
        pointer-events: none;
      }
      .label {
        position: absolute;
        top: -24px;
        left: 0;
        background-color: #4CAF50;
        color: white;
        padding: 2px 8px;
        font-size: 12px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        pointer-events: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 150px;
      }
      .delete-button {
        position: absolute;
        top: -24px;
        right: 0;
        background-color: #F44336;
        color: white;
        padding: 2px 8px;
        font-size: 12px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        cursor: pointer;
        pointer-events: auto;
      }
    `;
    
    // Create highlight content
    const highlight = document.createElement('div');
    highlight.className = 'highlight';
    
    // Create label
    const labelElement = document.createElement('div');
    labelElement.className = 'label';
    labelElement.textContent = label || element.tagName.toLowerCase();
    
    // Create delete button
    const deleteButton = document.createElement('div');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '✖';
    deleteButton.setAttribute('part', 'delete-button'); // For external access if needed
    
    // Add elements to shadow DOM
    shadow.appendChild(style);
    shadow.appendChild(highlight);
    shadow.appendChild(labelElement);
    shadow.appendChild(deleteButton);
    
    // Store reference to the highlighted element
    this.highlightedElements.set(elementId, {
      highlightHost,
      element,
      cssSelector: this.getStableElementIdentifier(element)
    });
    
    return highlightHost;
  }

  /**
   * Create a temporary highlight for element hover or selection preview
   * @param {HTMLElement} element - The element to highlight temporarily
   * @returns {HTMLElement} - The created temporary highlight element
   */
  createTemporaryHighlight(element) {
    // Remove any existing temporary highlight
    this.removeTemporaryHighlight();
    
    // Create a shadow DOM host for the temporary highlight
    const tempHighlightHost = document.createElement('div');
    tempHighlightHost.setAttribute('data-browser-connect-temp-highlight-host', '');
    document.body.appendChild(tempHighlightHost);
    
    // Attach shadow DOM
    const shadow = tempHighlightHost.attachShadow({ mode: 'closed' });
    
    // Position the host element based on the target element
    this.updateHighlightPosition(tempHighlightHost, element);
    
    // Add styles and content to shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      .temp-highlight {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 2px solid #2196F3;
        background-color: rgba(33, 150, 243, 0.2);
        box-sizing: border-box;
        pointer-events: none;
      }
    `;
    
    // Create highlight content
    const tempHighlight = document.createElement('div');
    tempHighlight.className = 'temp-highlight';
    
    // Add elements to shadow DOM
    shadow.appendChild(style);
    shadow.appendChild(tempHighlight);
    
    // Store reference to the temporary highlight
    this.tempHighlight = tempHighlightHost;
    
    return tempHighlightHost;
  }

  /**
   * Get a stable identifier for an element that can survive React re-renders
   * @param {HTMLElement} element - The element to identify
   * @returns {string} - A CSS selector that should find the same element after React updates
   */
  getStableElementIdentifier(element) {
    // First try to get React-specific identifiers
    const reactId = this.getReactElementId(element);
    if (reactId) {
      return reactId;
    }
    
    // If no React ID found, fall back to a complex CSS selector
    let selector = '';
    
    // Use data attributes as they're usually stable in React apps
    const dataAttributes = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => `[${attr.name}="${attr.value.replace(/"/g, '\\"')}"]`)
      .join('');
    
    if (dataAttributes) {
      // If we have data attributes, use them with the element tag
      selector = `${element.tagName.toLowerCase()}${dataAttributes}`;
    } else {
      // Otherwise build a basic path
      let path = [];
      let current = element;
      
      while (current && current !== document.body && path.length < 5) {
        let currentSelector = current.tagName.toLowerCase();
        
        // Add id if it exists
        if (current.id) {
          currentSelector += `#${current.id}`;
        } 
        // Add classes if they exist and aren't auto-generated React classes
        else if (current.className && typeof current.className === 'string') {
          const classes = current.className.split(' ')
            .filter(cls => 
              cls && 
              !cls.startsWith('react-') && 
              !/^[a-z0-9]{7,}$/.test(cls) // Skip likely hashed classnames
            )
            .map(cls => `.${cls}`)
            .join('');
          
          if (classes) {
            currentSelector += classes;
          }
        }
        
        // Use nth-child for better specificity
        const siblings = Array.from(current.parentNode?.children || []);
        const index = siblings.indexOf(current);
        if (index !== -1) {
          currentSelector += `:nth-child(${index + 1})`;
        }
        
        path.unshift(currentSelector);
        current = current.parentNode;
      }
      
      selector = path.join(' > ');
    }
    
    return selector;
  }

  /**
   * Try to extract React-specific element IDs or identifiers
   * @param {HTMLElement} element - The React element to identify
   * @returns {string|null} - A React-specific selector or null if not found
   */
  getReactElementId(element) {
    // Check for React Fiber internal properties
    const reactKey = Object.keys(element).find(key => 
      key.startsWith('__reactFiber$') || 
      key.startsWith('__reactInternalInstance$') ||
      key.startsWith('__reactProps$')
    );
    
    if (reactKey) {
      // We found a React element, use a combination of tag and any stable attributes
      const tag = element.tagName.toLowerCase();
      
      // Look for stable attributes that might survive re-renders
      const id = element.id ? `#${element.id}` : '';
      const role = element.getAttribute('role') ? `[role="${element.getAttribute('role')}"]` : '';
      
      // Add any data-testid or similar test attributes that are likely stable
      const testId = element.getAttribute('data-testid') ? `[data-testid="${element.getAttribute('data-testid')}"]` : '';
      
      return `${tag}${id}${role}${testId}`;
    }
    
    // Check for React root element
    if (element.hasAttribute('data-reactroot')) {
      return '[data-reactroot]';
    }
    
    return null;
  }

  /**
   * Update the position of a highlight overlay based on the current position of the target element
   * @param {HTMLElement} highlightHost - The highlight host element to update
   * @param {HTMLElement} element - The target element being highlighted
   */
  updateHighlightPosition(highlightHost, element) {
    if (!element || !document.body.contains(element)) {
      // Element is no longer in the DOM
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    
    // Set position properties
    highlightHost.style.position = 'absolute';
    highlightHost.style.top = `${window.scrollY + rect.top}px`;
    highlightHost.style.left = `${window.scrollX + rect.left}px`;
    highlightHost.style.width = `${rect.width}px`;
    highlightHost.style.height = `${rect.height}px`;
    highlightHost.style.pointerEvents = 'none';
    highlightHost.style.zIndex = '2147483646'; // Very high but one less than max
    
    return true;
  }

  /**
   * Remove a highlight for a specific element
   * @param {string} elementId - The ID of the element to remove highlighting for
   */
  removeHighlight(elementId) {
    const highlightData = this.highlightedElements.get(elementId);
    if (highlightData && highlightData.highlightHost) {
      if (document.body.contains(highlightData.highlightHost)) {
        document.body.removeChild(highlightData.highlightHost);
      }
      this.highlightedElements.delete(elementId);
    }
  }

  /**
   * Remove the temporary highlight
   */
  removeTemporaryHighlight() {
    if (this.tempHighlight && document.body.contains(this.tempHighlight)) {
      document.body.removeChild(this.tempHighlight);
      this.tempHighlight = null;
    }
  }

  /**
   * Remove all highlights
   */
  removeAllHighlights() {
    // Remove all permanent highlights
    this.highlightedElements.forEach((highlightData, elementId) => {
      this.removeHighlight(elementId);
    });
    
    // Clear the map
    this.highlightedElements.clear();
    
    // Remove temporary highlight if it exists
    this.removeTemporaryHighlight();
  }

  /**
   * Setup element tracking to handle DOM mutations that might affect highlighted elements
   */
  setupElementTracking() {
    // Create a MutationObserver to track DOM changes
    this.observer = new MutationObserver((mutations) => {
      let needsUpdate = false;
      
      // Check if any mutations affect our selected elements
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          needsUpdate = true;
        }
      });
      
      if (needsUpdate) {
        // Update the highlight positions for all tracked elements
        this.highlightedElements.forEach((data, elementId) => {
          // Try to find the element by selector
          const selector = data.cssSelector;
          try {
            const element = document.querySelector(selector);
            
            if (element && document.body.contains(element)) {
              // Update the element reference and position
              data.element = element;
              this.updateHighlightPosition(data.highlightHost, element);
            } else if (data.element && document.body.contains(data.element)) {
              // Fallback to the existing element reference if it's still valid
              this.updateHighlightPosition(data.highlightHost, data.element);
            } else {
              // Element no longer exists, but keep the highlight visible
              // In React apps, elements might be temporarily removed and re-added
              console.log(`Element for selector "${selector}" not found in DOM, keeping highlight`);
            }
          } catch (e) {
            console.error(`Error updating highlight position for ${elementId}:`, e);
          }
        });
      }
    });
    
    // Start observing the entire document for changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    console.log('Element tracking setup with MutationObserver');
  }

  /**
   * Clean up and stop tracking
   */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.removeAllHighlights();
  }
}

// Register globally in the window object for content script accessibility
try {
  if (typeof window !== 'undefined') {
    window.ShadowDOMHighlighter = ShadowDOMHighlighter;
    console.log('🔍 DEBUG: ShadowDOMHighlighter registered globally');
  }
} catch (e) {
  console.error('Error registering ShadowDOMHighlighter globally:', e);
}

// For CommonJS environments (if needed)
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = ShadowDOMHighlighter; 
} 