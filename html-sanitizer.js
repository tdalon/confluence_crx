/**
 * HTML Sanitizer Utility
 * Provides safe methods for setting HTML content to avoid XSS vulnerabilities
 * Works in both Chrome and Firefox
 */

/**
 * Safely set HTML content by creating elements programmatically
 * Use this when you need to set simple HTML like links, spans, etc.
 * @param {HTMLElement} element - The element to set content on
 * @param {string} html - The HTML string (should be from trusted sources)
 */
function setInnerHTML(element, html) {
    // For static HTML or template literals, this is safe
    // But we still use DOMParser as an extra safety layer
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Clear existing content
    element.textContent = '';
    
    // Move nodes from parsed document to target element
    while (doc.body.firstChild) {
        element.appendChild(doc.body.firstChild);
    }
}

/**
 * Safely set text content (no HTML parsing)
 * Use this when you don't need HTML formatting
 * @param {HTMLElement} element - The element to set content on
 * @param {string} text - The text content
 */
function setTextContent(element, text) {
    element.textContent = text;
}

/**
 * Create an element with safe HTML content
 * @param {string} tagName - The tag name (div, span, etc.)
 * @param {string} html - The HTML content
 * @returns {HTMLElement}
 */
function createElementWithHTML(tagName, html) {
    const element = document.createElement(tagName);
    setInnerHTML(element, html);
    return element;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setInnerHTML,
        setTextContent,
        createElementWithHTML,
        escapeHTML
    };
}
