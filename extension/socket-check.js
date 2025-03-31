/**
 * Checks if Socket.IO is properly loaded
 * This is in a separate file to comply with CSP restrictions
 */
if (typeof io === 'undefined') {
  console.error('Failed to load Socket.IO. Extension functionality will be limited.');
} else {
  console.log('Socket.IO loaded successfully:', io.version || 'unknown version');
} 