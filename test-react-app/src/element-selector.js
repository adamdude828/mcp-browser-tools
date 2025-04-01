/**
 * Basic Element Selector Implementation
 * This file contains a simple implementation to test element selection in React
 */

import testHarness from './test-harness';

// Create a basic CSS selector from an element
function getCssSelector(element) {
  if (!element || element === document || element === document.body) {
    return null;
  }
  
  let selector = element.tagName.toLowerCase();
  
  if (element.id) {
    selector += `#${element.id}`;
  } else if (element.className) {
    // Get class names (avoid synthetic React classes)
    const classList = Array.from(element.classList)
      .filter(cls => !cls.startsWith('react-') && !cls.match(/^[a-z]+[A-Z]/));
    
    if (classList.length > 0) {
      selector += `.${classList.join('.')}`;
    }
  }
  
  // Add data-testid if available (common in React testing)
  if (element.dataset.testid) {
    selector += `[data-testid="${element.dataset.testid}"]`;
  }
  
  return selector;
}

// Get XPath for an element
function getXPath(element) {
  if (!element) return '';
  
  const paths = [];
  
  // Use nodeName for elements
  for (; element && element.nodeType === Node.ELEMENT_NODE; 
       element = element.parentNode) {
    let index = 0;
    let hasId = false;
    
    // If element has ID, use that (common for React)
    if (element.id) {
      paths.unshift(`//${element.nodeName.toLowerCase()}[@id="${element.id}"]`);
      hasId = true;
      break;
    }
    
    // Get index of element
    for (let sibling = element.previousSibling; sibling; 
         sibling = sibling.previousSibling) {
      if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
      
      if (sibling.nodeName === element.nodeName) {
        index++;
      }
    }
    
    const tagName = element.nodeName.toLowerCase();
    const pathIndex = index ? `[${index + 1}]` : '';
    paths.unshift(`${tagName}${pathIndex}`);
  }
  
  return '/' + paths.join('/');
}

// Create a highlight box for selected element 
function createHighlight(element) {
  if (!element) return null;
  
  const rect = element.getBoundingClientRect();
  
  // Create highlight element
  const highlight = document.createElement('div');
  highlight.className = 'browser-connect-highlight';
  highlight.style.position = 'absolute';
  highlight.style.top = `${window.scrollY + rect.top}px`;
  highlight.style.left = `${window.scrollX + rect.left}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
  highlight.style.border = '2px solid #4CAF50';
  highlight.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
  highlight.style.zIndex = '10000';
  highlight.style.pointerEvents = 'none';
  highlight.style.boxSizing = 'border-box';
  
  // Create label
  const label = document.createElement('div');
  label.className = 'browser-connect-element-label';
  label.textContent = element.tagName.toLowerCase();
  label.style.position = 'absolute';
  label.style.top = '-24px';
  label.style.left = '0';
  label.style.backgroundColor = '#4CAF50';
  label.style.color = 'white';
  label.style.padding = '2px 8px';
  label.style.fontSize = '12px';
  label.style.borderRadius = '4px';
  label.style.fontFamily = 'Arial, sans-serif';
  
  // Add label to highlight
  highlight.appendChild(label);
  
  // Add to document
  document.body.appendChild(highlight);
  
  return highlight;
}

// Enable element selection
function enableElementSelection() {
  document.body.style.cursor = 'crosshair';
  document.addEventListener('click', handleElementClick, true);
  testHarness.logEvent('Element selection mode enabled', 'info');
}

// Current selected elements
const selectedElements = new Map();

// Handle element click for selection
function handleElementClick(event) {
  // Prevent default browser behavior and event propagation
  event.preventDefault();
  event.stopPropagation();
  
  // Ignore clicks on our own UI elements
  if (event.target.closest('.browser-connect-highlight') || 
      event.target.closest('#selection-test-harness')) {
    return;
  }
  
  // Get the element to select
  const element = event.target;
  
  // Try to select the element
  try {
    const elementId = `element-${Date.now()}`;
    const cssSelector = getCssSelector(element);
    const xpath = getXPath(element);
    
    // Create highlight
    const highlight = createHighlight(element);
    
    if (highlight) {
      // Store element data
      selectedElements.set(elementId, {
        element,
        highlight,
        cssSelector,
        xpath,
        timestamp: Date.now()
      });
      
      // Log the successful selection
      testHarness.trackSelectionAttempt(element, true);
      
      // Log selection details
      testHarness.logEvent('Element selected', 'info', {
        elementTagName: element.tagName,
        cssSelector,
        xpath
      });
    } else {
      // Log the failed selection
      testHarness.trackSelectionAttempt(element, false);
    }
  } catch (error) {
    console.error('Error selecting element:', error);
    testHarness.logEvent('Error selecting element', 'error', { 
      error: error.message 
    });
    testHarness.trackSelectionAttempt(element, false);
  }
}

// Clear all selected elements
function clearSelectedElements() {
  selectedElements.forEach((data, elementId) => {
    if (data.highlight && document.body.contains(data.highlight)) {
      document.body.removeChild(data.highlight);
    }
  });
  
  selectedElements.clear();
  testHarness.logEvent('All element selections cleared', 'info');
}

// Disable element selection
function disableElementSelection() {
  document.body.style.cursor = '';
  document.removeEventListener('click', handleElementClick, true);
  testHarness.logEvent('Element selection mode disabled', 'info');
}

// Add UI controls for selection
function addSelectionControls() {
  const controls = document.createElement('div');
  controls.id = 'selection-controls';
  controls.style.position = 'fixed';
  controls.style.top = '10px';
  controls.style.left = '10px';
  controls.style.zIndex = '10000';
  controls.style.backgroundColor = '#f0f0f0';
  controls.style.border = '1px solid #ccc';
  controls.style.padding = '10px';
  controls.style.borderRadius = '4px';
  
  controls.innerHTML = `
    <button id="enable-selection">Enable Selection</button>
    <button id="disable-selection">Disable Selection</button>
    <button id="clear-selections">Clear Selections</button>
  `;
  
  document.body.appendChild(controls);
  
  // Add event listeners
  document.getElementById('enable-selection').addEventListener('click', enableElementSelection);
  document.getElementById('disable-selection').addEventListener('click', disableElementSelection);
  document.getElementById('clear-selections').addEventListener('click', clearSelectedElements);
}

// Initialize on page load
window.addEventListener('load', () => {
  // Add selection controls
  addSelectionControls();
  
  // Set up MutationObserver to monitor highlights
  const observer = new MutationObserver(mutations => {
    // Check if selected elements need updating
    selectedElements.forEach((data, elementId) => {
      const { element, highlight } = data;
      
      // Check if element is still in DOM
      if (!document.body.contains(element)) {
        // Element is gone, remove highlight
        if (highlight && document.body.contains(highlight)) {
          document.body.removeChild(highlight);
        }
        
        // Remove from tracking
        selectedElements.delete(elementId);
        testHarness.logEvent('Selected element removed from DOM', 'warning', {
          elementId,
          cssSelector: data.cssSelector
        });
      } else {
        // Element is still in DOM, update highlight position
        const rect = element.getBoundingClientRect();
        
        if (highlight && document.body.contains(highlight)) {
          highlight.style.top = `${window.scrollY + rect.top}px`;
          highlight.style.left = `${window.scrollX + rect.left}px`;
          highlight.style.width = `${rect.width}px`;
          highlight.style.height = `${rect.height}px`;
        }
      }
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
  
  testHarness.logEvent('Element selector initialized', 'info');
}); 