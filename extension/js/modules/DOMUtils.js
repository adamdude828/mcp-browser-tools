// DOM Utilities Module for Browser Connect
// Contains utilities for working with DOM elements and selectors

/**
 * Class with DOM utility methods
 */
class DOMUtils {
  /**
   * Get an XPath expression for a given element
   * @param {HTMLElement} element - The element to get XPath for
   * @returns {string} XPath expression
   */
  static getXPath(element) {
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
        return `${this.getXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
      }
      
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
  }

  /**
   * Get a CSS selector for a given element
   * @param {HTMLElement} element - The element to get a CSS selector for
   * @returns {string} CSS selector
   */
  static getCssSelector(element) {
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
      selector = `${this.getCssSelector(parent)} > ${selector}`;
    }
    
    return selector;
  }

  /**
   * Get basic information about an element
   * @param {HTMLElement} element - Element to extract info from
   * @returns {Object} Element information
   */
  static getElementInfo(element) {
    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      innerText: element.innerText ? element.innerText.substring(0, 100) : '',
      attributes: this.getElementAttributes(element),
      xpath: this.getXPath(element),
      cssSelector: this.getCssSelector(element)
    };
  }

  /**
   * Get an object containing all attributes of an element
   * @param {HTMLElement} element - Element to get attributes from
   * @returns {Object} Object with attribute name-value pairs
   */
  static getElementAttributes(element) {
    const attributes = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  /**
   * Check if an element is a browser connect UI element
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if it's a browser connect UI element
   */
  static isBrowserConnectElement(element) {
    return element.closest('.browser-connect-modal, .browser-connect-overlay, .browser-connect-label, #browser-connect-mode-indicator, .browser-connect-console') !== null;
  }

  /**
   * Find an element by XPath
   * @param {string} xpath - XPath expression
   * @returns {HTMLElement|null} Found element or null
   */
  static findElementByXPath(xpath) {
    try {
      return document.evaluate(
        xpath,
        document, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
      ).singleNodeValue;
    } catch (e) {
      console.error('Error finding element by XPath:', e);
      return null;
    }
  }

  /**
   * Find an element by CSS selector
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null} Found element or null
   */
  static findElementBySelector(selector) {
    try {
      return document.querySelector(selector);
    } catch (e) {
      console.error('Error finding element by selector:', e);
      return null;
    }
  }

  /**
   * Check if an element is visible in the viewport
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if visible
   */
  static isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Scroll an element into view
   * @param {HTMLElement} element - Element to scroll to
   * @param {Object} options - Scroll options
   */
  static scrollElementIntoView(element, options = { behavior: 'smooth', block: 'center' }) {
    element.scrollIntoView(options);
  }
}

export default DOMUtils; 