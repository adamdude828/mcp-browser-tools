/**
 * Test Harness for Element Selection
 * This script instruments the page to track element selection issues
 */

// Store references to selected elements for tracking
const selectedElements = new Map();
let totalSelectionAttempts = 0;
let failedSelectionAttempts = 0;
let logs = [];

// Log function with timestamp
function logEvent(message, type = 'info', details = {}) {
  const timestamp = new Date().toISOString();
  const log = { timestamp, message, type, details };
  logs.push(log);
  console.log(`[${timestamp}] [${type}]`, message, details);
  
  // Update UI if log display exists
  updateLogDisplay();
}

function updateLogDisplay() {
  const logDisplay = document.getElementById('selection-log-display');
  if (logDisplay) {
    logDisplay.innerHTML = logs
      .map(log => `<div class="log-entry ${log.type}">[${log.timestamp.split('T')[1].split('.')[0]}] ${log.message}</div>`)
      .join('');
  }
}

// Track when element selection is attempted
function trackSelectionAttempt(element, success) {
  totalSelectionAttempts++;
  
  if (!success) {
    failedSelectionAttempts++;
    logEvent(`Selection attempt failed`, 'error', {
      elementTagName: element.tagName,
      elementId: element.id,
      elementClasses: element.className,
    });
  } else {
    const elementId = `sel-${Date.now()}`;
    selectedElements.set(elementId, {
      element,
      timestamp: Date.now(),
      tagName: element.tagName,
      classes: element.className,
      id: element.id,
    });
    
    logEvent(`Element selected successfully`, 'success', {
      elementId,
      elementTagName: element.tagName,
    });
  }
  
  // Update stats display
  updateStats();
}

// Track when a selected element is lost (can't be referenced anymore)
function trackElementLost(elementId, reason) {
  if (selectedElements.has(elementId)) {
    const elementInfo = selectedElements.get(elementId);
    logEvent(`Element reference lost`, 'warning', {
      elementId,
      reason,
      elementTagName: elementInfo.tagName,
      timeSinceSelection: Date.now() - elementInfo.timestamp + 'ms',
    });
    
    selectedElements.delete(elementId);
    updateStats();
  }
}

// Update statistics display
function updateStats() {
  const statsDisplay = document.getElementById('selection-stats');
  if (statsDisplay) {
    statsDisplay.innerHTML = `
      <div>Total Selection Attempts: ${totalSelectionAttempts}</div>
      <div>Failed Attempts: ${failedSelectionAttempts}</div>
      <div>Success Rate: ${totalSelectionAttempts > 0 
        ? Math.round(((totalSelectionAttempts - failedSelectionAttempts) / totalSelectionAttempts) * 100) 
        : 0}%</div>
      <div>Currently Tracked Elements: ${selectedElements.size}</div>
    `;
  }
}

// Create test UI for tracking selection
function createTestHarnessUI() {
  const harness = document.createElement('div');
  harness.id = 'selection-test-harness';
  harness.style.position = 'fixed';
  harness.style.bottom = '0';
  harness.style.right = '0';
  harness.style.width = '400px';
  harness.style.maxHeight = '300px';
  harness.style.backgroundColor = '#f0f0f0';
  harness.style.border = '1px solid #ccc';
  harness.style.padding = '10px';
  harness.style.zIndex = '10000';
  harness.style.overflow = 'auto';
  harness.style.fontSize = '12px';
  harness.style.fontFamily = 'monospace';
  
  harness.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
      <h3 style="margin: 0;">Element Selection Test Harness</h3>
      <button id="toggle-harness" style="background: none; border: none; cursor: pointer;">-</button>
    </div>
    <div id="harness-content">
      <div id="selection-stats"></div>
      <div id="selection-log-display" style="margin-top: 10px; max-height: 200px; overflow: auto;"></div>
    </div>
  `;
  
  document.body.appendChild(harness);
  
  // Set up toggle functionality
  const toggleButton = document.getElementById('toggle-harness');
  const content = document.getElementById('harness-content');
  let isCollapsed = false;
  
  toggleButton.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    content.style.display = isCollapsed ? 'none' : 'block';
    toggleButton.textContent = isCollapsed ? '+' : '-';
  });
  
  // Initialize displays
  updateStats();
  updateLogDisplay();
}

// Initialize the test harness when the page loads
window.addEventListener('load', () => {
  logEvent('Test harness initialized');
  createTestHarnessUI();
  
  // Add test harness style
  const style = document.createElement('style');
  style.textContent = `
    .log-entry {
      padding: 2px 4px;
      margin-bottom: 2px;
      border-left: 3px solid #ccc;
    }
    .error {
      border-left-color: #ff5252;
      background-color: #ffeeee;
    }
    .warning {
      border-left-color: #ffb74d;
      background-color: #fff8e1;
    }
    .success {
      border-left-color: #4caf50;
      background-color: #e8f5e9;
    }
  `;
  document.head.appendChild(style);
  
  // Set up MutationObserver to monitor problematic DOM changes
  setupDomChangeObserver();
});

// Monitor DOM changes that might affect element selection
function setupDomChangeObserver() {
  const observer = new MutationObserver(mutations => {
    // Check if any mutations affect our tracked elements
    let affectedElements = 0;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        // Check if any tracked elements were affected
        selectedElements.forEach((info, elementId) => {
          const { element } = info;
          
          // Check if element was removed
          if (mutation.type === 'childList' && 
              Array.from(mutation.removedNodes).some(node => 
                node === element || (node.contains && node.contains(element))
              )) {
            trackElementLost(elementId, 'Removed from DOM');
            affectedElements++;
          }
          
          // Check if element is no longer in the DOM
          if (!document.body.contains(element)) {
            trackElementLost(elementId, 'No longer in DOM');
            affectedElements++;
          }
        });
      }
    });
    
    if (affectedElements > 0) {
      logEvent(`DOM mutations affected ${affectedElements} tracked elements`, 'warning');
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
  
  logEvent('DOM change observer started');
}

// Export functions for use in the app
window.testHarness = {
  trackSelectionAttempt,
  trackElementLost,
  logEvent
};

export default {
  trackSelectionAttempt,
  trackElementLost,
  logEvent
}; 