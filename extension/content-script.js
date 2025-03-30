// Element Selection and Highlighting for Browser Connect
let selectionMode = false;
let currentHighlightedElement = null;
let selectedElements = new Map(); // Map to store labeled elements (elementId -> {element, label})
let nextElementId = 1;

// Styles for highlighting elements
const styles = `
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

// Inject styles
function injectStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

// Start selection mode
function startSelectionMode() {
  selectionMode = true;
  document.body.style.cursor = 'crosshair';
  console.log('Browser Connect: Element selection mode activated');
  
  // Add a visible indicator that selection mode is active
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
}

// Stop selection mode
function stopSelectionMode() {
  selectionMode = false;
  document.body.style.cursor = '';
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove('browser-connect-highlight');
    currentHighlightedElement = null;
  }
  
  // Remove the indicator
  const indicator = document.getElementById('browser-connect-mode-indicator');
  if (indicator) {
    document.body.removeChild(indicator);
  }
  
  console.log('Browser Connect: Element selection mode deactivated');
}

// Handle mouse movement for highlighting elements
function handleMouseMove(event) {
  if (!selectionMode) return;
  
  // Ignore our own UI elements
  if (event.target.closest('.browser-connect-modal, .browser-connect-overlay, .browser-connect-label, #browser-connect-mode-indicator')) {
    return;
  }
  
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove('browser-connect-highlight');
  }
  
  currentHighlightedElement = event.target;
  currentHighlightedElement.classList.add('browser-connect-highlight');
}

// Handle element selection
function handleClick(event) {
  if (!selectionMode) return;
  
  // Ignore our own UI elements
  if (event.target.closest('.browser-connect-modal, .browser-connect-overlay, .browser-connect-label, #browser-connect-mode-indicator')) {
    return;
  }
  
  // Prevent the click from triggering other elements
  event.preventDefault();
  event.stopPropagation();
  
  const selectedElement = event.target;
  
  // Show labeling modal
  showLabelingModal(selectedElement);
}

// Show modal for labeling the selected element
function showLabelingModal(element) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'browser-connect-overlay';
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'browser-connect-modal';
  
  // Create title
  const title = document.createElement('h3');
  title.textContent = 'Label this element';
  title.style.margin = '0 0 10px 0';
  
  // Create input
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter a label';
  
  // Create buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'buttons';
  
  // Create confirm button
  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Save';
  confirmButton.addEventListener('click', () => {
    const label = input.value.trim() || 'Unlabeled';
    
    // First remove modal and overlay to avoid issues with element repositioning
    try {
      document.body.removeChild(overlay);
      document.body.removeChild(modal);
    } catch (e) {
      console.error('Error removing modal:', e);
    }
    
    // Then label the element
    labelElement(element, label);
    stopSelectionMode();
  });
  
  // Create cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel';
  cancelButton.addEventListener('click', () => {
    try {
      document.body.removeChild(overlay);
      document.body.removeChild(modal);
    } catch (e) {
      console.error('Error removing modal:', e);
    }
    stopSelectionMode();
  });
  
  // Add buttons to container
  buttonsContainer.appendChild(confirmButton);
  buttonsContainer.appendChild(cancelButton);
  
  // Add all elements to modal
  modal.appendChild(title);
  modal.appendChild(input);
  modal.appendChild(buttonsContainer);
  
  // Add modal and overlay to the page
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // Focus the input
  input.focus();
  
  // Also handle Escape key to close the modal
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      try {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
      } catch (e) {
        console.error('Error removing modal:', e);
      }
      stopSelectionMode();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  
  document.addEventListener('keydown', keyHandler);
}

// Label and store the selected element
function labelElement(element, label) {
  // Remove highlight class
  element.classList.remove('browser-connect-highlight');
  // Add selected class
  element.classList.add('browser-connect-selected');
  
  // Create a unique ID for this element
  const elementId = `browser-connect-element-${nextElementId++}`;
  element.dataset.browserConnectId = elementId;
  
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
  
  // Store the element and its label
  selectedElements.set(elementId, {
    element,
    label,
    xpath: getXPath(element),
    cssSelector: getCssSelector(element)
  });
  
  // Send data to background script
  chrome.runtime.sendMessage({
    type: 'element-selected',
    data: {
      elementId,
      label,
      url: window.location.href,
      xpath: getXPath(element),
      cssSelector: getCssSelector(element),
      innerText: element.innerText.substring(0, 100),
      tagName: element.tagName
    }
  });
  
  console.log(`Browser Connect: Element labeled as "${label}"`);
}

// Get XPath for an element
function getXPath(element) {
  if (element.id !== '') {
    return `//*[@id="${element.id}"]`;
  }
  
  if (element === document.body) {
    return '/html/body';
  }
  
  let ix = 0;
  const siblings = element.parentNode.childNodes;
  
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    
    if (sibling === element) {
      return `${getXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
    }
    
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
}

// Get CSS selector for an element
function getCssSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className) {
    const classes = Array.from(element.classList).map(c => `.${c}`).join('');
    return classes;
  }
  
  let selector = element.tagName.toLowerCase();
  let parent = element.parentNode;
  
  if (parent && parent !== document.body) {
    selector = `${getCssSelector(parent)} > ${selector}`;
  }
  
  return selector;
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Browser Connect: Received message', message);
  
  if (message.type === 'toggle-selection-mode') {
    console.log('Browser Connect: Toggle selection mode message received');
    if (selectionMode) {
      stopSelectionMode();
    } else {
      startSelectionMode();
    }
    
    // Important: Always send response back
    sendResponse({ success: true, selectionMode });
    console.log('Browser Connect: Toggled selection mode to', selectionMode);
    return true; // Required to use sendResponse asynchronously
  }
  
  if (message.type === 'get-selected-elements') {
    const elements = Array.from(selectedElements.entries()).map(([id, data]) => ({
      id,
      label: data.label,
      xpath: data.xpath,
      cssSelector: data.cssSelector
    }));
    
    console.log('Browser Connect: Returning selected elements', elements);
    sendResponse({ elements });
    return true; // Required to use sendResponse asynchronously
  }
  
  if (message.type === 'console-log') {
    // Display the console log message in the page
    displayConsoleLog(message.data);
    sendResponse({ success: true });
    return true;
  }
  
  // For any other message, send a default response
  sendResponse({ success: false, error: 'Unknown message type' });
  return true;
});

// Function to display console log messages
function displayConsoleLog(logData) {
  // Format timestamp
  const timestamp = new Date(logData.timestamp).toLocaleTimeString();
  
  // Create or find the console element
  let consoleElement = document.querySelector('.browser-connect-console');
  if (!consoleElement) {
    consoleElement = document.createElement('div');
    consoleElement.className = 'browser-connect-console';
    
    // Add close button
    const closeButton = document.createElement('span');
    closeButton.className = 'browser-connect-console-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      document.body.removeChild(consoleElement);
    });
    
    consoleElement.appendChild(closeButton);
    document.body.appendChild(consoleElement);
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
  consoleElement.appendChild(logEntry);
  
  // Auto-scroll to bottom
  consoleElement.scrollTop = consoleElement.scrollHeight;
  
  // Also log to browser console
  if (logData.level === 'error') {
    console.error(`[Browser Connect] ${logData.message}`);
  } else {
    console.log(`[Browser Connect] ${logData.message}`);
  }
}

// For debugging: test if content script is properly loaded
console.log('Browser Connect: Content script loaded and ready');

// Initialize
injectStyles();

// Add event listeners
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('click', handleClick, true); // Use capture phase 