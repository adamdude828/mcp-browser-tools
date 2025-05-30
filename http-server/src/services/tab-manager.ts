import { Socket } from 'socket.io';

// Tab information interface
export interface TabInfo {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  lastUpdated: Date;
}

// Zone information interface
export interface ZoneInfo {
  elementId: string;
  label: string;
  url: string;
  xpath: string;
  cssSelector: string;
  tagName: string;
  html?: string; // HTML content of the element
  timestamp: number;
  socketId: string;
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
  private zones: Map<string, ZoneInfo[]> = new Map(); // Store zones per socket ID

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
    this.zones.delete(socketId);
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
   * Add a zone for a socket
   */
  addZone(socketId: string, zoneInfo: Omit<ZoneInfo, 'socketId'>): void {
    const zones = this.zones.get(socketId) || [];
    
    // Debug: Check if HTML content is in the zoneInfo
    if ('html' in zoneInfo) {
      console.log(`[TabManager] Zone ${zoneInfo.elementId} has HTML content of length: ${zoneInfo.html?.length || 0}`);
    } else {
      console.log(`[TabManager] Zone ${zoneInfo.elementId} has no HTML property`);
    }
    
    // Add the socketId to the zone info
    const zoneWithSocketId: ZoneInfo = {
      ...zoneInfo,
      socketId
    };
    
    // Add to the list
    zones.push(zoneWithSocketId);
    this.zones.set(socketId, zones);
    
    console.log(`TabManager: Added zone ${zoneInfo.elementId} for ${socketId}`);
  }
  
  /**
   * Remove zones for a socket
   */
  removeZones(socketId: string, elementIds: string[]): void {
    const zones = this.zones.get(socketId) || [];
    
    if (elementIds.length === 0) {
      // Clear all zones for this socket if no specific IDs provided
      this.zones.set(socketId, []);
      console.log(`TabManager: Cleared all zones for ${socketId}`);
    } else {
      // Filter out the specified element IDs
      const updatedZones = zones.filter(zone => !elementIds.includes(zone.elementId));
      this.zones.set(socketId, updatedZones);
      console.log(`TabManager: Removed ${elementIds.length} zones for ${socketId}`);
    }
  }
  
  /**
   * Get all zones for a socket
   */
  getZones(socketId: string): ZoneInfo[] {
    return this.zones.get(socketId) || [];
  }
  
  /**
   * Get all zones across all sockets
   */
  getAllZones(): ZoneInfo[] {
    const allZones: ZoneInfo[] = [];
    this.zones.forEach(zones => {
      allZones.push(...zones);
    });
    return allZones;
  }
  
  /**
   * Get zone by label name (case-insensitive)
   * Returns all zones that match the given label
   */
  getZonesByLabel(label: string): ZoneInfo[] {
    const matchingZones: ZoneInfo[] = [];
    
    // Normalize the search label by trimming and replacing whitespace sequences (including newlines) with a single space
    const normalizedSearchLabel = label.toLowerCase().trim().replace(/\s+/g, ' ');
    
    console.log(`[TabManager] Looking for zones with normalized label: "${normalizedSearchLabel}"`);
    
    this.zones.forEach((zones, socketId) => {
      // Log the available zones for debugging
      if (zones.length > 0) {
        console.log(`[TabManager] Socket ${socketId} has ${zones.length} zones with labels:`, 
          zones.map(z => `"${z.label}"`).join(', '));
      }
      
      const matches = zones.filter(zone => {
        // Normalize the zone label the same way
        const normalizedZoneLabel = zone.label.toLowerCase().trim().replace(/\s+/g, ' ');
        
        // Try exact match first
        if (normalizedZoneLabel === normalizedSearchLabel) {
          return true;
        }
        
        // Try contains match as fallback
        if (normalizedZoneLabel.includes(normalizedSearchLabel) || 
            normalizedSearchLabel.includes(normalizedZoneLabel)) {
          return true;
        }
        
        return false;
      });
      
      matchingZones.push(...matches);
    });
    
    console.log(`[TabManager] Found ${matchingZones.length} matching zones`);
    return matchingZones;
  }
  
  /**
   * Get a specific zone by exact label name
   * Returns the first zone that matches the given label exactly (case-sensitive)
   */
  getZoneByExactLabel(label: string): ZoneInfo | null {
    let matchingZone: ZoneInfo | null = null;
    
    // Search all zones across all sockets
    for (const [socketId, zones] of this.zones.entries()) {
      const found = zones.find(zone => zone.label === label);
      if (found) {
        matchingZone = found;
        break;
      }
    }
    
    return matchingZone;
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
  
  /**
   * Get socket by ID
   */
  getSocketById(socketId: string): Socket | undefined {
    return this.sockets.get(socketId);
  }
  
  /**
   * Update HTML content for a zone in a specific socket
   * @param socketId The socket ID
   * @param elementId The element ID
   * @param html The HTML content
   * @returns True if updated successfully, false if zone not found
   */
  updateZoneHtml(socketId: string, elementId: string, html: string): boolean {
    console.log(`[TabManager] Updating HTML for zone ${elementId} (socket: ${socketId})`);
    
    // Check if the socket exists first
    if (!this.zones.has(socketId)) {
      console.log(`[TabManager] Socket ${socketId} not found in zones map`);
      return false;
    }
    
    const zones = this.zones.get(socketId) || [];
    console.log(`[TabManager] Socket ${socketId} has ${zones.length} zones`);
    
    const zoneIndex = zones.findIndex(zone => zone.elementId === elementId);
    console.log(`[TabManager] Search result for zone ${elementId}: index=${zoneIndex}`);
    
    if (zoneIndex === -1) {
      console.log(`[TabManager] Zone ${elementId} not found for socket ${socketId}`);
      
      // Log available zones to help debug
      if (zones.length > 0) {
        console.log(`[TabManager] Available zones for socket ${socketId}:`, 
          zones.map(z => ({ elementId: z.elementId, label: z.label })));
      }
      
      return false;
    }
    
    // Update the HTML content
    zones[zoneIndex].html = html;
    this.zones.set(socketId, zones);
    
    console.log(`[TabManager] Successfully updated HTML for zone ${elementId} (socket: ${socketId}), HTML length: ${html.length}`);
    return true;
  }
  
  /**
   * Update HTML content for any zone matching the element ID across all sockets
   * @param elementId The element ID
   * @param html The HTML content
   * @returns True if at least one zone was updated, false if no matching zones
   */
  updateAnyZoneHtml(elementId: string, html: string): boolean {
    console.log(`[TabManager] Attempting to update HTML for any zone with ID ${elementId} across all sockets`);
    
    // Log the number of sockets we're searching through
    console.log(`[TabManager] Searching through ${this.zones.size} socket(s) for zone ${elementId}`);
    
    let updated = false;
    let checkedSockets = 0;
    
    // Check all sockets for the matching element ID
    for (const [socketId, zones] of this.zones.entries()) {
      checkedSockets++;
      console.log(`[TabManager] Checking socket ${socketId} (${zones.length} zones)...`);
      
      const zoneIndex = zones.findIndex(zone => zone.elementId === elementId);
      
      if (zoneIndex !== -1) {
        // Update the HTML content
        zones[zoneIndex].html = html;
        this.zones.set(socketId, zones);
        updated = true;
        
        console.log(`[TabManager] Found and updated zone ${elementId} in socket ${socketId}, HTML length: ${html.length}`);
      } else {
        console.log(`[TabManager] Zone ${elementId} not found in socket ${socketId}`);
      }
    }
    
    if (!updated) {
      console.log(`[TabManager] Zone ${elementId} not found in any socket (checked ${checkedSockets} sockets)`);
    }
    
    return updated;
  }
  
  /**
   * Get all active socket instances
   * @returns Array of active Socket instances
   */
  getActiveSockets(): Socket[] {
    const activeSockets: Socket[] = [];
    
    for (const [socketId, socket] of this.sockets.entries()) {
      if (socket && socket.connected) {
        activeSockets.push(socket);
      }
    }
    
    return activeSockets;
  }
}

// Export a singleton instance
export const tabManager = new TabManager(); 