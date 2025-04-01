// Browser Connect Content Script
// This script manages element selection and highlighting in the browser tab
// It uses modularized components to handle different responsibilities

// Try to load ShadowDOMHighlighter if available
let ShadowDOMHighlighter;
try {
  // First, check if it's already in the window object (helpful for module systems)
  if (window.ShadowDOMHighlighter) {
    ShadowDOMHighlighter = window.ShadowDOMHighlighter;
    console.log('🔍 DEBUG: ShadowDOMHighlighter found in window object');
  } else {
    // Otherwise, load the script directly
    console.log('🔍 DEBUG: Loading ShadowDOMHighlighter script dynamically');
    
    // Create a script element to load the ShadowDOMHighlighter
    const script = document.createElement('script');
    script.type = 'text/javascript'; // Use standard script type
    script.src = chrome.runtime.getURL('js/direct/ShadowDOMHighlighter.js');
    script.onload = () => {
      console.log('🔍 DEBUG: ShadowDOMHighlighter script loaded successfully');
      // After script loads, check if it registered itself globally
      if (window.ShadowDOMHighlighter) {
        ShadowDOMHighlighter = window.ShadowDOMHighlighter;
        console.log('🔍 DEBUG: ShadowDOMHighlighter object found and initialized');
        // Reinitialize ElementSelector to use the new ShadowDOMHighlighter
        if (elementSelector) {
          console.log('🔍 DEBUG: Reinitializing element tracking with ShadowDOMHighlighter');
          elementSelector.initializeTracking();
        }
      } else {
        console.error('🚨 ERROR: ShadowDOMHighlighter script loaded but object not found in window');
      }
    };
    script.onerror = (error) => {
      console.error('🚨 ERROR: Failed to load ShadowDOMHighlighter script:', error);
    };
    document.head.appendChild(script);
  }
} catch (error) {
  console.error('🚨 ERROR: Failed to load ShadowDOMHighlighter:', error);
}

console.log('🔍 BROWSER CONNECT CONTENT SCRIPT LOADED', new Date().toISOString());

// Check for html2canvas
if (typeof html2canvas === 'undefined') {
  console.error('🚨 ERROR: html2canvas not loaded! Screenshots will not work!');
} else {
  console.log('🔍 DEBUG: html2canvas loaded successfully', typeof html2canvas);
}

// Global variable to track DOM readiness
let domIsReady = false;
let initializationAttempted = false;

// Initialize the element selector by loading ElementSelector directly 
// instead of importing as module (which doesn't work with content scripts)
let elementSelector;

// Global access for extension script functions - CRITICAL for access by executeScript
window.browserConnectAPI = {
  isReady: false,
  toggleSelectionMode: function() {
    console.log('🔍 DEBUG: Window API toggleSelectionMode called');
    if (!elementSelector) {
      console.error('🚨 ERROR: ElementSelector not available in window API');
      return { success: false, error: 'ElementSelector not initialized' };
    }
    const result = elementSelector.toggleSelectionMode();
    return { success: true, selectionMode: result };
  },
  getSelectedElements: function() {
    if (!elementSelector) return { elements: [] };
    return { elements: elementSelector.getSelectedElementsData() };
  },
  highlightElements: function() {
    if (!elementSelector) return { success: false };
    return { success: elementSelector.highlightAllSelectedElements() };
  },
  hideElements: function() {
    if (!elementSelector) return { success: false };
    return { success: elementSelector.hideAllSelectedElements() };
  },
  clearElements: function(reason) {
    if (!elementSelector) return { success: false };
    return { success: elementSelector.clearAllSelectedElements(reason || 'api-call') };
  },
  // Add screenshot capability to the browserConnectAPI
  captureElementScreenshot: function(elementId) {
    console.log('📸 DEBUG: Content script captureElementScreenshot called for element ID:', elementId);
    if (!elementSelector) {
      console.error('❌ ERROR: ElementSelector not initialized for screenshot capture');
      return { success: false, error: 'ElementSelector not initialized' };
    }
    
    if (typeof html2canvas === 'undefined') {
      console.error('❌ ERROR: html2canvas library not available for screenshot capture');
      return { success: false, error: 'html2canvas not available' };
    }
    
    try {
      // Use the findElementById helper function instead of direct querySelector
      const element = findElementById(elementId);
      if (!element) {
        console.error('❌ ERROR: Element not found for screenshot capture:', elementId);
        return { success: false, error: 'Element not found' };
      }
      
      console.log('📸 DEBUG: Element found for screenshot, dimensions:', {
        width: element.offsetWidth,
        height: element.offsetHeight,
        tagName: element.tagName,
        className: element.className
      });
      
      // Return a promise that will resolve with the screenshot data
      return new Promise((resolve, reject) => {
        console.log('📸 DEBUG: Starting html2canvas capture process');
        html2canvas(element, {
          allowTaint: true,
          useCORS: true,
          logging: false,
          scale: window.devicePixelRatio
        }).then(canvas => {
          console.log('📸 DEBUG: Canvas created successfully:', {
            width: canvas.width,
            height: canvas.height,
            devicePixelRatio: window.devicePixelRatio
          });
          
          // Convert canvas to base64 image data
          const imageData = canvas.toDataURL('image/png');
          console.log('📸 DEBUG: Screenshot captured successfully, data length:', imageData.length);
          
          resolve({ 
            success: true, 
            imageData: imageData,
            width: canvas.width,
            height: canvas.height
          });
        }).catch(error => {
          console.error('❌ ERROR: html2canvas screenshot capture failed:', error);
          reject({ success: false, error: error.message });
        });
      });
    } catch (error) {
      console.error('❌ ERROR: Exception in screenshot capture process:', error);
      return { success: false, error: error.message };
    }
  }
};

// Expose elementSelector globally for easier access from page context
window.elementSelector = null;

// Wait for DOM to be ready
function waitForDOM(callback) {
  console.log('🔍 DEBUG: Waiting for DOM to be ready');
  
  // Check if document is already complete
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('🔍 DEBUG: DOM already ready, state:', document.readyState);
    domIsReady = true;
    callback();
    return;
  }
  
  // Otherwise wait for DOMContentLoaded event
  console.log('🔍 DEBUG: Setting up DOMContentLoaded listener, current state:', document.readyState);
  document.addEventListener('DOMContentLoaded', function domLoadedHandler() {
    console.log('🔍 DEBUG: DOMContentLoaded event fired');
    document.removeEventListener('DOMContentLoaded', domLoadedHandler);
    domIsReady = true;
    callback();
  });
}

// Safely append child with checks
function safeAppendToBody(element) {
  if (!document || !document.body) {
    console.error('🚨 ERROR: document.body not available for appendChild');
    return false;
  }
  
  try {
    document.body.appendChild(element);
    return true;
  } catch (error) {
    console.error('🚨 ERROR: Failed to append to body:', error.message);
    return false;
  }
}

// Initialize the message handler
function initializeMessageHandler() {
  // Set up message listener
  console.log('🔍 DEBUG: Content script - initializeMessageHandler called');
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🔍 DEBUG: Content script received message', message);
    
    // Send an immediate acknowledgment of message receipt
    if (message.type === 'content-script-ready-check') {
      console.log('🔍 DEBUG: Responding to ready check');
      sendResponse({ received: true, domReady: domIsReady, initialized: !!elementSelector });
      return true;
    }
    
    // Always check if the content script is fully loaded and ready
    if (!elementSelector) {
      console.error('🚨 ERROR: ElementSelector not initialized yet');
      
      // Try to initialize now if we haven't tried before
      if (domIsReady && !initializationAttempted) {
        console.log('🔍 DEBUG: Attempting late initialization');
        initializationAttempted = true;
        injectElementSelector();
        
        // Still respond with error since we're not ready for this message yet
        sendResponse({ success: false, error: 'ElementSelector being initialized, please retry' });
      } else {
        sendResponse({ success: false, error: 'ElementSelector not initialized' });
      }
      return true;
    }
    
    if (message.type === 'toggle-selection-mode') {
      console.log('🔍 DEBUG: Content script - toggle-selection-mode message received');
      try {
        const result = elementSelector.toggleSelectionMode();
        console.log('🔍 DEBUG: Selection mode toggled to:', result);
        sendResponse({ success: true, selectionMode: elementSelector.selectionMode });
      } catch (error) {
        console.error('🚨 ERROR: Failed to toggle selection mode:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    
    if (message.type === 'get-selected-elements') {
      try {
        console.log('🔍 DEBUG: Processing get-selected-elements message');
        const elements = elementSelector.getSelectedElementsData();
        console.log(`🔍 DEBUG: Sending ${elements.length} elements in response`);
        sendResponse({ success: true, elements: elements });
      } catch (error) {
        console.error('🚨 ERROR: Error in get-selected-elements:', error);
        sendResponse({ success: false, elements: [], error: error.message });
      }
      return true;
    }
    
    if (message.type === 'highlight-all-elements') {
      elementSelector.highlightAllSelectedElements();
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'hide-all-elements') {
      elementSelector.hideAllSelectedElements();
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'clear-selected-elements') {
      elementSelector.clearAllSelectedElements('user-initiated');
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'clear-all-highlights') {
      elementSelector.clearElementHighlights();
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'delete-element') {
      elementSelector.deleteElement(message.elementId);
      sendResponse({ success: true });
      return true;
    }
    
    // Check if the message is meant to capture a screenshot
    if (message.type === 'capture-element-screenshot') {
      console.log('🔍 DEBUG: Received capture-element-screenshot message for element:', message.elementId);
      try {
        const element = findElementById(message.elementId);
        
        if (!element) {
          console.error('❌ ERROR: Element not found for screenshot:', message.elementId);
          console.log('🔍 DEBUG: Document current URL:', document.location.href);
          
          // Debug: Check how many elements exist with data-extension attributes
          const allExtensionElements = document.querySelectorAll('[data-extension-element-id]');
          console.log(`🔍 DEBUG: Found ${allExtensionElements.length} elements with data-extension-element-id attributes`);
          
          if (allExtensionElements.length > 0) {
            console.log('🔍 DEBUG: Listing available element IDs:');
            allExtensionElements.forEach(el => {
              console.log(`- ${el.getAttribute('data-extension-element-id')}: ${el.tagName} ${el.className}`);
            });
          }
          
          // Check if our element selector has selected elements
          if (elementSelector && elementSelector.selectedElements) {
            console.log(`🔍 DEBUG: Element selector has ${elementSelector.selectedElements.size} selected elements`);
            
            if (elementSelector.selectedElements.size > 0) {
              console.log('🔍 DEBUG: Listing available elements in the selectedElements map:');
              elementSelector.selectedElements.forEach((data, id) => {
                console.log(`- ${id}: ${data.element ? data.element.tagName : 'null'} (${data.label || 'no label'})`);
              });
            }
          }
          
          sendResponse({ success: false, error: 'Element not found' });
          return true;
        }
        
        console.log('🔍 DEBUG: Found element for screenshot, dimensions:', element.offsetWidth, 'x', element.offsetHeight);
        console.log('🔍 DEBUG: Element details:', {
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          textContent: element.textContent ? element.textContent.substring(0, 50) + '...' : '(no text)'
        });
        
        // Use html2canvas to capture the element
        console.log('🔍 DEBUG: Starting html2canvas capture...');
        
        // Check if html2canvas is available
        if (typeof html2canvas !== 'function') {
          console.error('🚨 ERROR: html2canvas is not available as a function:', typeof html2canvas);
          sendResponse({ success: false, error: 'html2canvas not available' });
          return true;
        }
        
        html2canvas(element, {
          allowTaint: true,
          useCORS: true,
          logging: true, // Enable logging for debugging
          scale: window.devicePixelRatio
        }).then(canvas => {
          // Convert canvas to base64 image data
          console.log('🔍 DEBUG: html2canvas capture successful, canvas size:', canvas.width, 'x', canvas.height);
          const imageData = canvas.toDataURL('image/png');
          console.log('🔍 DEBUG: Converted to image data, length:', imageData.length);
          
          // Send back the image data
          sendResponse({ 
            success: true, 
            imageData: imageData,
            width: canvas.width,
            height: canvas.height
          });
        }).catch(error => {
          console.error('Error capturing screenshot:', error);
          sendResponse({ success: false, error: error.message });
        });
        
        // Return true to indicate we'll call sendResponse asynchronously
        return true;
      } catch (error) {
        console.error('Error in screenshot capture:', error);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
    
    return true;
  });
}

// Get XPath for an element
function getXPath(element) {
  if (!element) return '';
  
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  if (element === document.body) {
    return '/html/body';
  }
  
  let ix = 0;
  const siblings = element.parentNode?.children || [];
  
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) {
      const path = getXPath(element.parentNode);
      const tag = element.tagName.toLowerCase();
      return `${path}/${tag}[${ix + 1}]`;
    }
    
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
  
  return '';
}

// Get a unique CSS selector for an element
function getCssSelector(element) {
  if (!element) return '';
  
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element === document.body) {
    return 'body';
  }
  
  // Try with classes if available
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(/\s+/).filter(c => c);
    if (classes.length) {
      const selector = `.${classes.join('.')}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }
  
  // Get a path
  const path = [];
  while (element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    if (element.id) {
      selector += `#${element.id}`;
      path.unshift(selector);
      break;
    } else {
      let sibling = element;
      let nth = 1;
      while (sibling.previousSibling) {
        sibling = sibling.previousSibling;
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          nth++;
        }
      }
      if (nth > 1) {
        selector += `:nth-of-type(${nth})`;
      }
    }
    path.unshift(selector);
    element = element.parentNode;
  }
  
  return path.join(' > ');
}

// Load the ElementSelector script directly
// This is a workaround for module loading issues in content scripts
function injectElementSelector() {
  console.log('🔍 DEBUG: Content script - injectElementSelector called');
  
  // Check if we can access DOM safely
  if (!document || !document.body) {
    console.error('🚨 ERROR: Cannot initialize ElementSelector, document.body not available');
    return;
  }
  
  // Create a simplified ElementSelector directly in the content script
  elementSelector = {
    selectionMode: false,
    selectedElements: new Map(),
    nextElementId: 1,
    highlightedElement: null,
    
    // Initialize shadow DOM highlighter if available
    shadowDOMHighlighter: null,
    useShadowDOM: false,
    
    // Initialize tracking
    initializeTracking() {
      console.log('🔍 DEBUG: Initializing element tracking...');
      
      // Check if ShadowDOMHighlighter is available
      if (window.ShadowDOMHighlighter || ShadowDOMHighlighter) {
        try {
          // Use the global version if available, otherwise use the module version
          const HighlighterClass = window.ShadowDOMHighlighter || ShadowDOMHighlighter;
          console.log('🔍 DEBUG: Found ShadowDOMHighlighter, creating instance');
          this.shadowDOMHighlighter = new HighlighterClass();
          this.useShadowDOM = true;
          this.shadowDOMHighlighter.setupElementTracking();
          console.log('🔍 DEBUG: Successfully initialized ShadowDOM highlighting for React compatibility');
          return true;
        } catch (error) {
          console.error('🚨 ERROR: Failed to initialize ShadowDOMHighlighter:', error);
          this.useShadowDOM = false;
        }
      } else {
        console.log('🔍 DEBUG: ShadowDOMHighlighter not available, using classic highlighting');
        this.useShadowDOM = false;
        
        // Set up a retry mechanism in case the script loads later
        if (!this._trackingRetryAttempted) {
          this._trackingRetryAttempted = true;
          
          console.log('🔍 DEBUG: Setting up retry for ShadowDOM initialization');
          setTimeout(() => {
            console.log('🔍 DEBUG: Checking for ShadowDOMHighlighter after delay...');
            if (window.ShadowDOMHighlighter) {
              console.log('🔍 DEBUG: ShadowDOMHighlighter available after delay, initializing');
              this.initializeTracking();
            } else {
              console.log('🔍 DEBUG: ShadowDOMHighlighter still not available after delay');
            }
          }, 2000); // Try again after 2 seconds (increased from 1 second)
        }
      }
      
      return false;
    },
    
    // Setup mouse event listeners
    setupEventListeners() {
      document.addEventListener('mousemove', this.handleMouseMove.bind(this));
      document.addEventListener('click', this.handleClick.bind(this), true); // Capture phase
      
      // Initialize tracking if using Shadow DOM
      this.initializeTracking();
    },
    
    // Remove event listeners
    removeEventListeners() {
      document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      document.removeEventListener('click', this.handleClick.bind(this), true);
      
      // Clean up shadow DOM highlighter if it exists
      if (this.shadowDOMHighlighter) {
        this.shadowDOMHighlighter.cleanup();
      }
    },
    
    // Handle socket messages via background script
    setupSocketMessageHandler() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handle socket messages forwarded by the background script
        if (message.type === 'socket-message') {
          if (message.event === 'delete-zone' && message.data && message.data.elementId) {
            this.deleteElement(message.data.elementId);
            sendResponse({ success: true });
            return true;
          }
        }
        return false;
      });
    },
    
    // Handle mouse movement for highlighting
    handleMouseMove(event) {
      if (!this.selectionMode) return;
      
      // Skip if it's one of our own UI elements
      if (event.target.closest('[data-browser-connect-highlight-host]') || 
          event.target.closest('[data-browser-connect-temp-highlight-host]') ||
          event.target.closest('#browser-connect-selection-indicator') || 
          event.target.closest('.browser-connect-element-highlight') ||
          event.target.closest('.browser-connect-modal')) {
        return;
      }
      
      // Highlight the element under the cursor
      this.highlightElement(event.target);
    },
    
    // Handle click on an element
    handleClick(event) {
      if (!this.selectionMode) return;
      
      // Skip if it's one of our own UI elements
      if (event.target.closest('[data-browser-connect-highlight-host]') || 
          event.target.closest('[data-browser-connect-temp-highlight-host]') ||
          event.target.closest('#browser-connect-selection-indicator') || 
          event.target.closest('.browser-connect-element-highlight') ||
          event.target.closest('.browser-connect-modal')) {
        return;
      }
      
      // Prevent the click from affecting the page
      event.preventDefault();
      event.stopPropagation();
      
      // Select the element - use best element finder if using Shadow DOM
      const elementToSelect = this.useShadowDOM 
        ? this.findBestElementToSelect(event.target) 
        : event.target;
        
      this.selectElement(elementToSelect);
    },
    
    // Highlight an element temporarily (during mouse hover)
    highlightElement(element) {
      // Clear previous highlight
      this.clearTempHighlight();
      
      // Select the best target element (may need to walk up the tree for React components)
      if (this.useShadowDOM) {
        const bestTarget = this.findBestElementToSelect(element);
        this.highlightedElement = bestTarget;
        this.shadowDOMHighlighter.createTemporaryHighlight(bestTarget);
        return;
      }
      
      // Fall back to classic highlighting if Shadow DOM is not available
      this.highlightedElement = element;
      
      const rect = element.getBoundingClientRect();
      const highlight = document.createElement('div');
      highlight.className = 'browser-connect-temp-highlight';
      highlight.style.position = 'fixed';
      highlight.style.top = `${rect.top}px`;
      highlight.style.left = `${rect.left}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.border = '2px solid #00a8ff';
      highlight.style.backgroundColor = 'rgba(0, 168, 255, 0.1)';
      highlight.style.zIndex = '999998';
      highlight.style.pointerEvents = 'none';
      
      document.body.appendChild(highlight);
    },
    
    // Clear temporary highlight
    clearTempHighlight() {
      if (this.useShadowDOM && this.shadowDOMHighlighter) {
        this.shadowDOMHighlighter.removeTemporaryHighlight();
        this.highlightedElement = null;
        return;
      }
      
      // Classic cleanup
      const highlights = document.querySelectorAll('.browser-connect-temp-highlight');
      highlights.forEach(el => el.remove());
      this.highlightedElement = null;
    },
    
    // Find the best element to select (for React apps)
    findBestElementToSelect(element) {
      // Look for React component containers
      let current = element;
      
      while (current && current !== document.body) {
        // Check for common React component indicators
        if (current.hasAttribute('data-reactroot') || 
            Object.keys(current).some(key => 
              key.startsWith('__react') || 
              key.startsWith('_reactFiber')
            )) {
          return current;
        }
        
        // Look for elements with data- attributes, which are often React components
        if (Array.from(current.attributes).some(attr => attr.name.startsWith('data-'))) {
          return current;
        }
        
        // Check if this element has a reasonable size (not tiny)
        const rect = current.getBoundingClientRect();
        if (rect.width >= 20 && rect.height >= 20 && current !== element) {
          return current;
        }
        
        current = current.parentElement;
      }
      
      // Fallback to original element
      return element;
    },
    
    // Select an element and ask for a label
    selectElement(element) {
      // Check if this element is already selected to prevent duplicates
      let alreadySelected = false;
      const alreadySelectedId = this.getElementIdIfSelected(element);
      
      if (alreadySelectedId) {
        console.log('Element is already selected with ID:', alreadySelectedId);
        // Flash the highlight to indicate it's already selected
        if (this.useShadowDOM && this.shadowDOMHighlighter) {
          const highlightData = this.shadowDOMHighlighter.highlightedElements.get(alreadySelectedId);
          if (highlightData && highlightData.highlightHost && highlightData.highlightHost.shadowRoot) {
            const highlight = highlightData.highlightHost.shadowRoot.querySelector('.highlight');
            if (highlight) {
              const originalBorder = highlight.style.border;
              highlight.style.border = '3px solid #FFC107'; // Yellow flash
              setTimeout(() => {
                highlight.style.border = originalBorder;
              }, 1000);
            }
          }
        } else {
          // Classic approach
          const highlight = document.querySelector(`.browser-connect-element-highlight[data-element-id="${alreadySelectedId}"]`);
          if (highlight) {
            const originalBorder = highlight.style.border;
            highlight.style.border = '3px solid #FFC107'; // Yellow flash
            setTimeout(() => {
              highlight.style.border = originalBorder;
            }, 1000);
          }
        }
        return; // Don't allow reselection
      }
      
      // Extract initial text suggestion, limited to 20 chars
      const textSuggestion = element.innerText ? 
        element.innerText.substring(0, 20).replace(/\s+/g, ' ').trim() : 
        element.tagName.toLowerCase();
      
      // Show a simple prompt for the label
      const label = prompt('Enter a label for this element:', textSuggestion);
      
      if (label === null) {
        // User cancelled
        return;
      }
      
      // Normalize label by removing excess whitespace including newlines
      const normalizedLabel = label.trim().replace(/\s+/g, ' ');
      
      console.log('Normalized label from', JSON.stringify(label), 'to', JSON.stringify(normalizedLabel));
      
      // Create a unique ID for the element
      const elementId = `browser-connect-element-${this.nextElementId++}`;
      
      // Get the HTML content, but truncate it for the initial socket message
      const fullHtml = element.outerHTML;
      const MAX_SOCKET_HTML_LENGTH = 1000; // Max HTML length to include in socket message
      const htmlIsTruncated = fullHtml.length > MAX_SOCKET_HTML_LENGTH;
      const truncatedHtml = htmlIsTruncated 
        ? fullHtml.substring(0, MAX_SOCKET_HTML_LENGTH) + '...' 
        : fullHtml;
        
      // For Shadow DOM implementation, get a stable selector
      const cssSelector = this.useShadowDOM && this.shadowDOMHighlighter
        ? this.shadowDOMHighlighter.getStableElementIdentifier(element)
        : getCssSelector(element);

      // Extract element information
      const elementData = {
        elementId,
        element,
        label: normalizedLabel, // Use normalized label
        xpath: getXPath(element),
        cssSelector: cssSelector,
        innerText: element.innerText ? element.innerText.substring(0, 100).replace(/\s+/g, ' ').trim() : '',
        tagName: element.tagName.toLowerCase(),
        html: truncatedHtml, // Use truncated HTML for socket message
        htmlTruncated: htmlIsTruncated, // Flag if HTML was truncated
        timestamp: Date.now()
      };
      
      // Create zone data (used for socket events)
      const zoneData = {
        elementId,
        label: normalizedLabel, // Use normalized label
        url: window.location.href,
        xpath: elementData.xpath,
        cssSelector: elementData.cssSelector,
        innerText: elementData.innerText,
        tagName: elementData.tagName,
        html: elementData.html, // Use truncated HTML
        htmlTruncated: elementData.htmlTruncated, // Flag if HTML was truncated
        timestamp: elementData.timestamp
      };
      
      // Add to selected elements map
      this.selectedElements.set(elementId, elementData);
      
      // Highlight the element permanently - using Shadow DOM if available
      this.addPermanentHighlight(element, normalizedLabel, elementId);
      
      // Notify extension that an element was selected AND send the zone data
      // Combined approach to avoid duplicates
      chrome.runtime.sendMessage({
        type: 'socket-emit',
        event: 'zone-added',
        data: zoneData
      });
      
      // Also send the element-selected message to ensure window UI updates
      chrome.runtime.sendMessage({
        type: 'element-selected',
        data: elementData
      });
      
      // If HTML was truncated, send the full HTML via REST API
      if (elementData.htmlTruncated) {
        console.log(`🔍 DEBUG: HTML was truncated (${fullHtml.length} chars), sending full HTML via REST API`);
        
        // Get the server URL from the extension
        chrome.runtime.sendMessage({ type: 'get-server-url' }, (response) => {
          if (response && response.serverUrl) {
            const serverUrl = response.serverUrl;
            console.log(`🔍 DEBUG: Got server URL: ${serverUrl}`);
            
            // Full URL for logging
            const apiUrl = `${serverUrl}/api/zones/${elementId}/html`;
            console.log(`🔍 DEBUG: Will send full HTML to endpoint: ${apiUrl}`);
            
            // Send the full HTML via fetch API with exponential backoff retry
            const sendFullHtml = (retryCount = 0, maxRetries = 3, delay = 1000) => {
              console.log(`🔍 DEBUG: Attempt ${retryCount + 1} to send full HTML (${fullHtml.length} chars) to ${apiUrl}`);
              
              fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  html: fullHtml
                })
              })
              .then(response => {
                console.log(`🔍 DEBUG: Received response with status: ${response.status}`);
                
                // Check if the response is OK before trying to parse JSON
                if (!response.ok) {
                  throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
                }
                
                // Try to parse JSON, but handle potential errors
                return response.text().then(text => {
                  console.log(`🔍 DEBUG: Response text: ${text}`);
                  try {
                    return JSON.parse(text);
                  } catch (e) {
                    console.error(`🚨 ERROR: Failed to parse JSON response: ${e.message}`);
                    console.log(`🔍 DEBUG: Raw response: ${text}`);
                    throw new Error('Invalid JSON response');
                  }
                });
              })
              .then(data => {
                console.log(`🔍 DEBUG: Full HTML sent successfully:`, data);
              })
              .catch(error => {
                console.error(`🚨 ERROR: Failed to send full HTML:`, error.message || error);
                
                // Log additional information to help debug
                console.log(`🔍 DEBUG Details for failed HTML send:`);
                console.log(`  URL: ${apiUrl}`);
                console.log(`  Element ID: ${elementId}`);
                console.log(`  HTML Length: ${fullHtml.length} chars`);
                console.log(`  Retry count: ${retryCount} of ${maxRetries}`);
                
                // Retry with exponential backoff
                if (retryCount < maxRetries) {
                  const nextDelay = delay * 2;
                  console.log(`🔍 DEBUG: Retrying in ${delay}ms (${retryCount + 1}/${maxRetries})`);
                  setTimeout(() => sendFullHtml(retryCount + 1, maxRetries, nextDelay), delay);
                } else {
                  console.log(`🔍 DEBUG: Max retries (${maxRetries}) reached, giving up on sending HTML`);
                }
              });
            };
            
            // Start the sending process
            sendFullHtml();
          } else {
            console.error(`🚨 ERROR: Failed to get server URL from extension`);
          }
        });
      }
      
      console.log('Element selected:', elementData);
    },
    
    // Helper method to check if an element is already selected
    getElementIdIfSelected(element) {
      let foundId = null;
      
      // Check if the element has a browserConnectId data attribute
      if (element.dataset && element.dataset.browserConnectId) {
        return element.dataset.browserConnectId;
      }
      
      // Check if any of our stored elements match this one
      this.selectedElements.forEach((data, id) => {
        if (data.element === element) {
          foundId = id;
        }
      });
      
      return foundId;
    },
    
    // Add permanent highlight to a selected element
    addPermanentHighlight(element, label, elementId) {
      // Add a data attribute to the element to mark it as selected
      // This helps prevent the same element from being selected multiple times
      try {
        element.dataset.browserConnectId = elementId;
      } catch (e) {
        console.log('Could not add dataset to element, will rely on object reference:', e);
      }
      
      // Use Shadow DOM highlighting if available
      if (this.useShadowDOM && this.shadowDOMHighlighter) {
        console.log('🔍 DEBUG: Using Shadow DOM for permanent highlight');
        const highlightHost = this.shadowDOMHighlighter.createIsolatedHighlight(element, elementId, label);
        
        // Add delete button click handler
        if (highlightHost && highlightHost.shadowRoot) {
          const deleteButton = highlightHost.shadowRoot.querySelector('.delete-button');
          if (deleteButton) {
            deleteButton.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              this.deleteElement(elementId);
            });
          }
        }
        
        return highlightHost;
      }
      
      // Fall back to classic highlighting
      const rect = element.getBoundingClientRect();
      
      // Create highlight container
      const highlight = document.createElement('div');
      highlight.className = 'browser-connect-element-highlight';
      highlight.setAttribute('data-element-id', elementId);
      highlight.style.position = 'absolute';
      highlight.style.top = `${window.scrollY + rect.top}px`;
      highlight.style.left = `${window.scrollX + rect.left}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.border = '2px solid #4CAF50';
      highlight.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
      highlight.style.zIndex = '999997';
      highlight.style.pointerEvents = 'none';
      
      // Add label
      const labelElement = document.createElement('div');
      labelElement.className = 'browser-connect-element-label';
      labelElement.textContent = label;
      labelElement.style.position = 'absolute';
      labelElement.style.top = '-20px';
      labelElement.style.left = '0';
      labelElement.style.backgroundColor = '#4CAF50';
      labelElement.style.color = 'white';
      labelElement.style.padding = '2px 5px';
      labelElement.style.borderRadius = '3px';
      labelElement.style.fontSize = '12px';
      labelElement.style.pointerEvents = 'none';
      
      // Add delete button
      const deleteButton = document.createElement('div');
      deleteButton.className = 'browser-connect-element-delete';
      deleteButton.textContent = '✖';
      deleteButton.style.position = 'absolute';
      deleteButton.style.top = '-20px';
      deleteButton.style.right = '0';
      deleteButton.style.backgroundColor = '#F44336';
      deleteButton.style.color = 'white';
      deleteButton.style.padding = '2px 5px';
      deleteButton.style.borderRadius = '3px';
      deleteButton.style.fontSize = '12px';
      deleteButton.style.cursor = 'pointer';
      deleteButton.style.pointerEvents = 'auto';
      
      // Add click event to delete button
      deleteButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.deleteElement(elementId);
      });
      
      highlight.appendChild(labelElement);
      highlight.appendChild(deleteButton);
      document.body.appendChild(highlight);
      
      return highlight;
    },
    
    // Delete a specific element by ID
    deleteElement(elementId) {
      // Check if element exists
      if (!this.selectedElements.has(elementId)) {
        console.error('Element not found:', elementId);
        return;
      }
      
      // Remove highlight based on implementation
      if (this.useShadowDOM && this.shadowDOMHighlighter) {
        this.shadowDOMHighlighter.removeHighlight(elementId);
      } else {
        // Classic approach
        const highlight = document.querySelector(`.browser-connect-element-highlight[data-element-id="${elementId}"]`);
        if (highlight) {
          highlight.remove();
        }
      }
      
      // Remove from selected elements map
      this.selectedElements.delete(elementId);
      
      // Emit socket event for deletion
      chrome.runtime.sendMessage({
        type: 'socket-emit',
        event: 'zones-deleted',
        data: {
          reason: 'user-deleted-single',
          elementIds: [elementId],
          url: window.location.href,
          timestamp: Date.now()
        }
      }, (response) => {
        if (response && response.success) {
          console.log('Sent zones-deleted socket event for element:', elementId);
        } else {
          console.error('Failed to send zones-deleted socket event');
        }
      });
      
      // Notify extension that elements were updated
      chrome.runtime.sendMessage({
        type: 'element-deleted',
        elementId: elementId
      });
      
      console.log('Element deleted:', elementId);
    },
    
    toggleSelectionMode() {
      console.log('🔍 DEBUG: ElementSelector - toggleSelectionMode called, current mode:', this.selectionMode);
      this.selectionMode = !this.selectionMode;
      document.body.style.cursor = this.selectionMode ? 'crosshair' : '';
      console.log('🔍 DEBUG: Selection mode toggled to:', this.selectionMode);
      
      // Show debug indicator with selection mode status
      try {
        const indicator = document.createElement('div');
        indicator.style.position = 'fixed';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.backgroundColor = this.selectionMode ? 'rgba(0, 200, 0, 0.9)' : 'rgba(200, 0, 0, 0.9)';
        indicator.style.color = 'white';
        indicator.style.padding = '8px 12px';
        indicator.style.borderRadius = '4px';
        indicator.style.zIndex = '2147483647'; // Maximum z-index
        indicator.style.fontSize = '14px';
        indicator.style.fontWeight = 'bold';
        indicator.style.fontFamily = 'Arial, sans-serif';
        indicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        indicator.textContent = `Selection Mode: ${this.selectionMode ? 'ON' : 'OFF'}`;
        document.body.appendChild(indicator);
        
        // Remove after 3 seconds
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 3000);
      } catch (error) {
        console.error('🚨 ERROR: Failed to show selection mode indicator', error);
      }
      
      if (this.selectionMode) {
        this.createSelectionIndicator();
        this.setupEventListeners();
        console.log('🔍 DEBUG: Selection mode activated - indicator created and events set up');
      } else {
        this.removeSelectionIndicator();
        this.clearTempHighlight();
        this.removeEventListeners();
        console.log('🔍 DEBUG: Selection mode deactivated - indicator removed and events cleaned up');
      }
      
      return this.selectionMode;
    },
    
    createSelectionIndicator() {
      try {
        console.log('🔍 DEBUG: Creating selection indicator');
        
        // Remove existing indicator if any
        this.removeSelectionIndicator();
        
        if (!document || !document.body) {
          console.error('🚨 ERROR: document.body not available for selection indicator');
          return false;
        }
        
        const indicator = document.createElement('div');
        indicator.id = 'browser-connect-selection-indicator';
        indicator.textContent = 'Selection Mode: ON';
        indicator.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background-color: rgba(76, 175, 80, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          z-index: 2147483647;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        
        return safeAppendToBody(indicator);
      } catch (error) {
        console.error('🚨 ERROR: Failed to create selection indicator:', error);
        return false;
      }
    },
    
    removeSelectionIndicator() {
      const indicator = document.getElementById('browser-connect-selection-indicator');
      if (indicator) {
        indicator.remove();
      }
    },
    
    // Get data for all selected elements
    getSelectedElementsData() {
      console.log('🔍 DEBUG: getSelectedElementsData called, elements count:', this.selectedElements.size);
      
      const elements = [];
      this.selectedElements.forEach((data, id) => {
        const { element, ...elementData } = data; // Remove actual DOM element reference
        elements.push(elementData);
      });
      
      // Log the elements list we're returning
      console.log('🔍 DEBUG: Returning elements:', elements.map(e => `${e.label} (${e.elementId})`));
      
      return elements;
    },
    
    // Highlight all selected elements
    highlightAllSelectedElements() {
      if (this.selectedElements.size === 0) {
        console.log('No elements to highlight');
        return false;
      }
      
      console.log('Highlighting all elements');
      
      // When using Shadow DOM, elements are always visible
      if (this.useShadowDOM) {
        return true;
      }
      
      // Classic approach
      this.selectedElements.forEach((data, elementId) => {
        const highlight = document.querySelector(`.browser-connect-element-highlight[data-element-id="${elementId}"]`);
        if (highlight) {
          highlight.style.display = 'block';
        } else {
          // Re-add the highlight if it's missing
          if (data.element && document.body.contains(data.element)) {
            this.addPermanentHighlight(data.element, data.label, elementId);
          }
        }
      });
      
      return true;
    },
    
    // Hide all selected elements
    hideAllSelectedElements() {
      if (this.selectedElements.size === 0) {
        console.log('No elements to hide');
        return false;
      }
      
      console.log('Hiding all elements');
      
      // When using Shadow DOM, don't actually hide them
      if (this.useShadowDOM) {
        return true;
      }
      
      // Classic approach
      document.querySelectorAll('.browser-connect-element-highlight').forEach(highlight => {
        highlight.style.display = 'none';
      });
      
      return true;
    },
    
    // Clear all selected elements
    clearAllSelectedElements(reason = 'manual') {
      if (this.selectedElements.size === 0) {
        console.log('No elements to clear');
        return true;
      }
      
      const elementIds = Array.from(this.selectedElements.keys());
      console.log(`Clearing ${elementIds.length} elements due to: ${reason}`);
      
      // Remove highlights based on implementation
      if (this.useShadowDOM && this.shadowDOMHighlighter) {
        this.shadowDOMHighlighter.removeAllHighlights();
      } else {
        // Classic approach
        document.querySelectorAll('.browser-connect-element-highlight').forEach(highlight => {
          highlight.remove();
        });
      }
      
      // Clear the selected elements map
      this.selectedElements.clear();
      
      // Emit socket event for bulk deletion
      if (elementIds.length > 0) {
        chrome.runtime.sendMessage({
          type: 'socket-emit',
          event: 'zones-deleted',
          data: {
            reason: reason,
            elementIds: elementIds,
            url: window.location.href,
            timestamp: Date.now()
          }
        });
        
        // Also notify extension UI
        chrome.runtime.sendMessage({
          type: 'elements-cleared',
          reason: reason
        });
      }
      
      return true;
    },
    
    // Create visual indicator for debugging purposes
    createDebugIndicator() {
      try {
        // Remove any existing debug indicator
        this.removeDebugIndicator();
        
        // Create indicator
        const indicator = document.createElement('div');
        indicator.id = 'browser-connect-debug-indicator';
        indicator.style.position = 'fixed';
        indicator.style.bottom = '10px';
        indicator.style.left = '10px';
        indicator.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';
        indicator.style.color = 'white';
        indicator.style.padding = '5px 10px';
        indicator.style.borderRadius = '4px';
        indicator.style.zIndex = '2147483647'; // Maximum z-index
        indicator.style.fontSize = '12px';
        indicator.style.fontFamily = 'monospace';
        indicator.textContent = 'Browser Connect: Script Loaded';
        document.body.appendChild(indicator);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          this.removeDebugIndicator();
        }, 5000);
        
        console.log('🔍 DEBUG: Created visual debug indicator');
      } catch (error) {
        console.error('🚨 ERROR: Failed to create debug indicator', error);
      }
    },
    
    // Remove debug indicator
    removeDebugIndicator() {
      try {
        const indicator = document.getElementById('browser-connect-debug-indicator');
        if (indicator) {
          indicator.remove();
        }
      } catch (error) {
        console.error('🚨 ERROR: Failed to remove debug indicator', error);
      }
    },
    
    clearElementHighlights() {
      // Remove all highlights but keep the selections in memory
      this.hideAllSelectedElements();
      return { success: true };
    }
  };
  
  // Also expose to window for access by executeScript
  window.elementSelector = elementSelector;
  console.log('🔍 DEBUG: elementSelector exposed to window object');
  
  // Continue with initialization
  try {
    elementSelector.setupEventListeners();
    elementSelector.setupSocketMessageHandler();
    window.browserConnectAPI.isReady = true;
    
    // Create a debug indicator to show that the script is loaded
    elementSelector.createDebugIndicator();
    
    console.log('🔍 DEBUG: ElementSelector successfully initialized');
    sendInitialReadyMessage();
  } catch (error) {
    console.error('🚨 ERROR: Failed to initialize ElementSelector:', error);
  }
}

// Send a message to the background script that we're ready
function sendInitialReadyMessage() {
  console.log('🔍 DEBUG: Sending initial content-script-ready message');
  try {
    chrome.runtime.sendMessage(
      { type: 'content-script-ready' },
      function(response) {
        console.log('🔍 DEBUG: Sent initial content-script-ready message, response:', response);
      }
    );
  } catch (error) {
    console.error('🚨 ERROR: Failed to send ready message:', error);
  }
}

// Verify that our script has access to the document
function verifyScriptContext() {
  console.log('🔍 DEBUG: Verifying script context');
  if (typeof document === 'undefined') {
    console.error('🚨 ERROR: No access to document');
    return false;
  }
  
  console.log('🔍 DEBUG: URL:', window.location.href);
  console.log('🔍 DEBUG: Running in context with access to DOM:', !!document.body);
  return true;
}

// Set up window unload to clean up
window.addEventListener('beforeunload', () => {
  console.log('🔍 DEBUG: Window is unloading, cleaning up');
  // Clean up ShadowDOM elements if they exist
  if (elementSelector && elementSelector.shadowDOMHighlighter) {
    elementSelector.shadowDOMHighlighter.cleanup();
  }
});

// Main initialization function
(function initialize() {
  // Wait for DOM to be ready, then initialize
  waitForDOM(() => {
    console.log('🔍 DEBUG: DOM is ready, initializing element selector');
    
    // Initialize messaging first to ensure we can receive messages
    initializeMessageHandler();
    
    // Inject element selector
    elementSelector = injectElementSelector();
    
    // Set browserConnectAPI as ready
    if (window.browserConnectAPI) {
      window.browserConnectAPI.isReady = true;
      console.log('🔍 DEBUG: browserConnectAPI marked as ready');
    }
    
    // Create visual debug indicator
    elementSelector.createDebugIndicator();
    
    // Mark as successful
    console.log('🔍 DEBUG: ElementSelector successfully initialized');
    
    // Send message that content script is ready
    sendInitialReadyMessage();
  });
  
  // Verify that we're in the right context
  verifyScriptContext();
})();

// Find element by ID, XPath, or CSS selector - to be used for screenshot capture
function findElementById(elementId) {
  // First try by data-extension-element-id attribute (standard approach)
  const selector = `[data-extension-element-id="${elementId}"]`;
  console.log('🔍 DEBUG: Looking for element with selector:', selector);
  
  const elementByAttribute = document.querySelector(selector);
  if (elementByAttribute) {
    console.log('🔍 DEBUG: Found element via data-extension-element-id attribute');
    return elementByAttribute;
  }
  
  console.log('🔍 DEBUG: Element not found via data-extension-element-id attribute, checking for browserConnectId attribute');
  
  // Check if we have the element in the elementSelector's selectedElements map
  if (elementSelector && elementSelector.selectedElements) {
    // Try to find by direct reference from the selectedElements map
    const selectedElementData = elementSelector.selectedElements.get(elementId);
    if (selectedElementData && selectedElementData.element) {
      console.log('🔍 DEBUG: Found element via selectedElements map reference');
      
      // Set the data-extension-element-id attribute if it doesn't exist
      if (!selectedElementData.element.hasAttribute('data-extension-element-id')) {
        try {
          selectedElementData.element.setAttribute('data-extension-element-id', elementId);
          console.log('🔍 DEBUG: Added missing data-extension-element-id attribute to the element');
        } catch (error) {
          console.error('🔍 ERROR: Could not set data-extension-element-id attribute:', error);
        }
      }
      
      return selectedElementData.element;
    }
    
    console.log('🔍 DEBUG: Element not found in selectedElements map by ID:', elementId);
  }

  // We couldn't find the element
  console.log('🔍 DEBUG: Element not found using any method');
  return null;
}

// Export a function for checking status from the console
window.checkBrowserConnectStatus = function() {
  const timestamp = new Date().toISOString();
  console.log(`🔍 BROWSER CONNECT STATUS CHECK (${timestamp})`);
  console.log(`📋 Content Script: ${typeof injectElementSelector === 'function' ? 'Loaded ✓' : 'Not loaded ✗'}`);
  console.log(`🔧 ShadowDOMHighlighter: ${window.ShadowDOMHighlighter ? 'Available ✓' : 'Not available ✗'}`);
  console.log(`🎯 elementSelector: ${window.elementSelector ? 'Initialized ✓' : 'Not initialized ✗'}`);
  console.log(`🔌 browserConnectAPI: ${window.browserConnectAPI && window.browserConnectAPI.isReady ? 'Ready ✓' : 'Not ready ✗'}`);
  
  // Create visual indicator
  try {
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    indicator.style.top = '10px';
    indicator.style.left = '10px';
    indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    indicator.style.color = 'white';
    indicator.style.padding = '10px';
    indicator.style.borderRadius = '5px';
    indicator.style.zIndex = '2147483647';
    indicator.style.fontFamily = 'monospace';
    indicator.style.fontSize = '12px';
    
    indicator.innerHTML = `
      <div style="font-weight:bold;margin-bottom:5px;">Browser Connect Status</div>
      <div style="color:${typeof injectElementSelector === 'function' ? '#4CAF50' : '#F44336'}">
        Content Script: ${typeof injectElementSelector === 'function' ? 'Loaded ✓' : 'Not loaded ✗'}
      </div>
      <div style="color:${window.ShadowDOMHighlighter ? '#4CAF50' : '#F44336'}">
        ShadowDOMHighlighter: ${window.ShadowDOMHighlighter ? 'Available ✓' : 'Not available ✗'}
      </div>
      <div style="color:${window.elementSelector ? '#4CAF50' : '#F44336'}">
        elementSelector: ${window.elementSelector ? 'Initialized ✓' : 'Not initialized ✗'}
      </div>
      <div style="color:${window.browserConnectAPI && window.browserConnectAPI.isReady ? '#4CAF50' : '#F44336'}">
        browserConnectAPI: ${window.browserConnectAPI && window.browserConnectAPI.isReady ? 'Ready ✓' : 'Not ready ✗'}
      </div>
    `;
    
    document.body.appendChild(indicator);
    
    // Add close button
    const closeBtn = document.createElement('div');
    closeBtn.textContent = 'X';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '5px';
    closeBtn.style.right = '5px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.addEventListener('click', () => indicator.remove());
    indicator.appendChild(closeBtn);
    
    return {
      success: true,
      contentScript: typeof injectElementSelector === 'function',
      shadowDOMHighlighter: !!window.ShadowDOMHighlighter,
      elementSelector: !!window.elementSelector,
      browserConnectAPI: !!(window.browserConnectAPI && window.browserConnectAPI.isReady),
    };
  } catch (error) {
    console.error('Failed to create status indicator:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// This function can be called from the console to manually initialize everything
window.initializeBrowserConnect = function() {
  console.log('🔍 BROWSER CONNECT: Manual initialization requested');
  
  try {
    // Step 1: Check ShadowDOMHighlighter
    let shadowDOMHighlighterAvailable = !!window.ShadowDOMHighlighter;
    console.log(`🔍 Step 1: ShadowDOMHighlighter ${shadowDOMHighlighterAvailable ? 'available ✓' : 'not available ✗'}`);
    
    if (!shadowDOMHighlighterAvailable) {
      console.log('🔍 Attempting to load ShadowDOMHighlighter from extension');
      
      // Create a temporary status indicator
      const statusElement = document.createElement('div');
      statusElement.style.position = 'fixed';
      statusElement.style.top = '50%';
      statusElement.style.left = '50%';
      statusElement.style.transform = 'translate(-50%, -50%)';
      statusElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      statusElement.style.color = 'white';
      statusElement.style.padding = '20px';
      statusElement.style.borderRadius = '10px';
      statusElement.style.zIndex = '2147483647';
      statusElement.style.fontFamily = 'monospace';
      statusElement.style.textAlign = 'center';
      statusElement.innerHTML = '<div style="font-size:16px;margin-bottom:10px;font-weight:bold;">Initializing Browser Connect</div><div id="bc-init-status">Loading ShadowDOMHighlighter...</div>';
      document.body.appendChild(statusElement);
      
      const updateStatus = (message, color = 'white') => {
        const statusDiv = document.getElementById('bc-init-status');
        if (statusDiv) {
          statusDiv.innerHTML += `<div style="color:${color}">${message}</div>`;
        }
      };
      
      // Try to inject the script
      try {
        // Get URL from extension
        const message = { type: 'direct-inject-scripts' };
        
        // Update status
        updateStatus('Requesting direct injection from extension...', '#FFC107');
        
        // Send message to extension
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(message, function(response) {
            if (chrome.runtime.lastError) {
              updateStatus(`Error: ${chrome.runtime.lastError.message}`, '#F44336');
              setTimeout(() => statusElement.remove(), 5000);
              return;
            }
            
            if (response && response.success) {
              updateStatus('Direct injection succeeded! ✓', '#4CAF50');
              updateStatus('Verifying components...', '#2196F3');
              
              // Verify components after a short delay
              setTimeout(() => {
                const shadowDOMHighlighterAvailable = !!window.ShadowDOMHighlighter;
                const elementSelectorAvailable = !!window.elementSelector;
                const browserConnectAPIAvailable = !!(window.browserConnectAPI && window.browserConnectAPI.isReady);
                
                updateStatus(`ShadowDOMHighlighter: ${shadowDOMHighlighterAvailable ? 'Available ✓' : 'Not available ✗'}`, 
                             shadowDOMHighlighterAvailable ? '#4CAF50' : '#F44336');
                updateStatus(`elementSelector: ${elementSelectorAvailable ? 'Available ✓' : 'Not available ✗'}`, 
                             elementSelectorAvailable ? '#4CAF50' : '#F44336');
                updateStatus(`browserConnectAPI: ${browserConnectAPIAvailable ? 'Available ✓' : 'Not available ✗'}`, 
                             browserConnectAPIAvailable ? '#4CAF50' : '#F44336');
                
                if (shadowDOMHighlighterAvailable && elementSelectorAvailable && browserConnectAPIAvailable) {
                  updateStatus('All components ready! Browser Connect initialized successfully.', '#4CAF50');
                } else {
                  updateStatus('Some components failed to initialize.', '#F44336');
                }
                
                // Remove status after delay
                setTimeout(() => statusElement.remove(), 5000);
              }, 1000);
            } else {
              updateStatus(`Error: ${response ? response.error : 'Unknown error'}`, '#F44336');
              setTimeout(() => statusElement.remove(), 5000);
            }
          });
        } else {
          updateStatus('Error: Chrome runtime API not available', '#F44336');
          setTimeout(() => statusElement.remove(), 5000);
        }
      } catch (error) {
        updateStatus(`Error: ${error.message}`, '#F44336');
        setTimeout(() => statusElement.remove(), 5000);
        return {
          success: false,
          error: error.message
        };
      }
    } else {
      console.log('🔍 ShadowDOMHighlighter already available, checking elementSelector');
      
      // Step 2: Create elementSelector if needed
      if (!window.elementSelector) {
        console.log('🔍 elementSelector not available, creating it');
        
        try {
          // Create a simplified ElementSelector
          window.elementSelector = {
            selectionMode: false,
            selectedElements: new Map(),
            nextElementId: 1,
            highlightedElement: null,
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
            
            // Initialize tracking
            initializeTracking() {
              console.log('🔍 DEBUG: Initializing tracking with ShadowDOMHighlighter');
              this.shadowDOMHighlighter.setupElementTracking();
              return true;
            },
            
            // Debug indicator
            createDebugIndicator(message = 'Manual Init: Success') {
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
          
          // Initialize tracking
          window.elementSelector.initializeTracking();
          console.log('🔍 elementSelector created and initialized');
        } catch (error) {
          console.error('🚨 ERROR: Failed to create elementSelector:', error);
          return {
            success: false,
            error: error.message
          };
        }
      } else {
        console.log('🔍 elementSelector already available');
      }
      
      // Step 3: Create browserConnectAPI if needed
      if (!window.browserConnectAPI || !window.browserConnectAPI.isReady) {
        console.log('🔍 browserConnectAPI not available or not ready, creating it');
        
        try {
          window.browserConnectAPI = {
            isReady: true,
            toggleSelectionMode: function() {
              return window.elementSelector.toggleSelectionMode();
            }
          };
          console.log('🔍 browserConnectAPI created and set to ready');
        } catch (error) {
          console.error('🚨 ERROR: Failed to create browserConnectAPI:', error);
          return {
            success: false,
            error: error.message
          };
        }
      } else {
        console.log('🔍 browserConnectAPI already available and ready');
      }
      
      // Create visual indicator of success
      const indicator = document.createElement('div');
      indicator.style.position = 'fixed';
      indicator.style.top = '50%';
      indicator.style.left = '50%';
      indicator.style.transform = 'translate(-50%, -50%)';
      indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      indicator.style.color = 'white';
      indicator.style.padding = '20px';
      indicator.style.borderRadius = '10px';
      indicator.style.zIndex = '2147483647';
      indicator.style.fontFamily = 'monospace';
      indicator.style.textAlign = 'center';
      indicator.innerHTML = '<div style="font-size:16px;margin-bottom:10px;font-weight:bold;">Browser Connect Initialized</div><div style="color:#4CAF50">All components are ready ✓</div>';
      document.body.appendChild(indicator);
      
      // Remove after 5 seconds
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.remove();
        }
      }, 5000);
      
      if (window.elementSelector && typeof window.elementSelector.createDebugIndicator === 'function') {
        window.elementSelector.createDebugIndicator('Manual initialization successful');
      }
      
      return {
        success: true,
        shadowDOMHighlighter: true,
        elementSelector: true,
        browserConnectAPI: true
      };
    }
  } catch (error) {
    console.error('🚨 ERROR: Exception during manual initialization:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 