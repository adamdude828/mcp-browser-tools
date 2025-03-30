import { Socket } from 'socket.io';

// Tab information interface
export interface TabInfo {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  lastUpdated: Date;
}

/**
 * Tab Manager Service
 * 
 * Handles storing and retrieving tab information from connected extensions.
 * Also provides methods for requesting current tab information.
 */
class TabManager {
  private tabs: Map<string, TabInfo> = new Map();
  private sockets: Map<string, Socket> = new Map();

  /**
   * Register a socket connection from an extension
   */
  registerSocket(socketId: string, socket: Socket): void {
    this.sockets.set(socketId, socket);
    console.log(`TabManager: Socket ${socketId} registered`);
    
    // Set up event listeners for this socket
    socket.on('active-tab-update', (tabInfo) => {
      this.updateTabInfo(socketId, tabInfo);
    });
    
    socket.on('disconnect', () => {
      this.removeSocket(socketId);
    });
  }
  
  /**
   * Remove a socket when disconnected
   */
  removeSocket(socketId: string): void {
    this.sockets.delete(socketId);
    this.tabs.delete(socketId);
    console.log(`TabManager: Socket ${socketId} removed`);
  }
  
  /**
   * Update tab information for a socket
   */
  updateTabInfo(socketId: string, tabInfo: Omit<TabInfo, 'lastUpdated'>): void {
    this.tabs.set(socketId, {
      ...tabInfo,
      lastUpdated: new Date()
    });
    console.log(`TabManager: Updated tab info for ${socketId} - ${tabInfo.url}`);
  }
  
  /**
   * Get current tab info for a socket
   */
  getTabInfo(socketId: string): TabInfo | null {
    return this.tabs.get(socketId) || null;
  }
  
  /**
   * Get all active tabs
   */
  getAllTabs(): TabInfo[] {
    return Array.from(this.tabs.values());
  }
  
  /**
   * Request current tab information from a socket
   * Returns a promise that resolves with the tab info or rejects if timed out
   */
  requestCurrentTab(socketId: string, timeoutMs = 5000): Promise<TabInfo> {
    const socket = this.sockets.get(socketId);
    if (!socket) {
      return Promise.reject(new Error(`No socket found with ID ${socketId}`));
    }
    
    const requestId = Date.now().toString();
    
    return new Promise((resolve, reject) => {
      // Set timeout for response
      const timeout = setTimeout(() => {
        socket.off('current-tab', handleResponse);
        socket.off('current-tab-error', handleError);
        reject(new Error('Tab request timed out'));
      }, timeoutMs);
      
      // Listen for the response with this requestId
      const handleResponse = (data: { requestId: string, tab: Omit<TabInfo, 'lastUpdated'> }) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          socket.off('current-tab', handleResponse);
          socket.off('current-tab-error', handleError);
          
          // Update our stored tab info
          const tabInfo = {
            ...data.tab,
            lastUpdated: new Date()
          };
          this.tabs.set(socketId, tabInfo);
          
          resolve(tabInfo);
        }
      };
      
      // Listen for errors
      const handleError = (data: { requestId: string, error: string }) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          socket.off('current-tab', handleResponse);
          socket.off('current-tab-error', handleError);
          reject(new Error(data.error));
        }
      };
      
      // Set up listeners
      socket.on('current-tab', handleResponse);
      socket.on('current-tab-error', handleError);
      
      // Send the request
      socket.emit('get-current-tab', { requestId });
    });
  }
}

// Export a singleton instance
export const tabManager = new TabManager(); 