import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { io } from "../index.js";
import { Socket } from "socket.io";
import { tabManager } from "../services/tab-manager.js";

/**
 * Sets up tab-related socket event handlers
 * @param socket The socket.io socket instance
 */
export function setupTabSocketHandlers(socket: Socket): void {
  // Handle active tab updates from the extension
  socket.on("active-tab-update", (tabInfo) => {
    console.log("[SERVER] Active tab updated:", tabInfo.url);
    
    // Store the updated tab info in the tabManager
    tabManager.updateTabInfo(socket.id, tabInfo);
  });
  
  // Forward current-tab responses to all clients
  socket.on("current-tab", (data) => {
    console.log(`[SERVER] Received current-tab with ID ${data.requestId}, forwarding to all clients`);
    io.emit("current-tab", data);
    
    // Also update the tabManager with this information
    if (data.tab) {
      tabManager.updateTabInfo(socket.id, data.tab);
    }
  });
  
  // Forward current-tab-error to all clients
  socket.on("current-tab-error", (data) => {
    console.log(`[SERVER] Received current-tab-error with ID ${data.requestId}, forwarding to all clients`);
    io.emit("current-tab-error", data);
  });

  // Handle zone-added events from the extension
  socket.on("zone-added", (data) => {
    console.log(`[SERVER] Zone added: ${data.label} (${data.elementId})`);
    
    // Debug: Check if HTML content is received
    if (data.html) {
      console.log(`[SERVER] Received HTML content of length: ${data.html.length}`);
      console.log(`[SERVER] HTML content sample: ${data.html.substring(0, 100)}${data.html.length > 100 ? '...' : ''}`);
    } else {
      console.log(`[SERVER] No HTML content received for zone: ${data.label}`);
    }
    
    // Store the zone information in the tabManager
    tabManager.addZone(socket.id, data);
    
    // Forward the event to all connected clients
    io.emit("zone-added", {
      socketId: socket.id,
      ...data
    });
  });

  // Handle zones-deleted events from the extension
  socket.on("zones-deleted", (data) => {
    console.log(`[SERVER] Zones deleted: ${data.elementIds.length} zones, reason: ${data.reason}`);
    
    // Remove zones from the tabManager
    tabManager.removeZones(socket.id, data.elementIds);
    
    // Forward the event to all connected clients
    io.emit("zones-deleted", {
      socketId: socket.id,
      ...data
    });
  });
}

/**
 * Registers the tab title tool with the MCP server
 * @param server The MCP server instance
 */
export function registerTabTitleTool(server: McpServer): void {
  // Get the title/URL of the active tab
  server.tool(
    "browser_get_title",
    { random_string: z.string().optional() },
    async () => {
      // Get all tabs from the tab manager
      const allTabs = tabManager.getAllTabs();
      
      // If we have any tabs in the cache, return the most recently updated one
      if (allTabs.length > 0) {
        // Sort by lastUpdated (most recent first)
        const sortedTabs = allTabs.sort((a, b) => 
          b.lastUpdated.getTime() - a.lastUpdated.getTime()
        );
        
        const mostRecentTab = sortedTabs[0];
        console.log(`[SERVER] Returning tab info: ${mostRecentTab.title}`);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              title: mostRecentTab.title,
              url: mostRecentTab.url
            })
          }]
        };
      } else {
        // No tab information available
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              error: "No tab information available",
              connected: false
            })
          }]
        };
      }
    }
  );
}

/**
 * Registers the browser zones tool with the MCP server
 * @param server The MCP server instance
 */
export function registerBrowserZonesTool(server: McpServer): void {
  // Get all zones from the browser
  server.tool(
    "browser_get_zones",
    { random_string: z.string().optional() },
    async () => {
      // Get all zones from the tab manager
      const allZones = tabManager.getAllZones();
      
      if (allZones.length > 0) {
        // Extract just the labels from all zones
        const zoneLabels = allZones.map(zone => zone.label);
        
        // Remove duplicates and sort alphabetically
        const uniqueLabels = [...new Set(zoneLabels)].sort();
        
        console.log(`[SERVER] Returning ${uniqueLabels.length} zone labels`);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              zones: uniqueLabels,
              count: uniqueLabels.length
            })
          }]
        };
      } else {
        // No zones available
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              zones: [],
              count: 0,
              message: "No zones have been selected"
            })
          }]
        };
      }
    }
  );
}

/**
 * Registers the browser zone details tool with the MCP server
 * @param server The MCP server instance
 */
export function registerBrowserZoneDetailsTool(server: McpServer): void {
  // Get details for a specific zone by label
  server.tool(
    "browser_get_zone_details",
    { 
      zone_label: z.string().describe("The label of the zone to get details for")
    },
    async (params) => {
      const { zone_label } = params;
      
      // Get zones that match the label
      const matchingZones = tabManager.getZonesByLabel(zone_label);
      
      if (matchingZones.length > 0) {
        // For simplicity, return the first matching zone
        // In the future, we could return all matching zones if needed
        const zone = matchingZones[0];
        
        console.log(`[SERVER] Returning details for zone: ${zone.label}`);
        
        // Debug: Check if the zone has HTML content
        if (zone.html) {
          console.log(`[SERVER] Zone has HTML content of length: ${zone.html.length}`);
          console.log(`[SERVER] HTML content sample: ${zone.html.substring(0, 100)}${zone.html.length > 100 ? '...' : ''}`);
        } else {
          console.log(`[SERVER] Zone ${zone.label} has no HTML content`);
        }
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              found: true,
              zone: {
                label: zone.label,
                url: zone.url,
                xpath: zone.xpath,
                cssSelector: zone.cssSelector,
                tagName: zone.tagName,
                elementId: zone.elementId,
                html: zone.html || '', // Include the HTML content
                timestamp: zone.timestamp
              }
            })
          }]
        };
      } else {
        // No matching zone found
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              found: false,
              message: `No zone found with label "${zone_label}"`
            })
          }]
        };
      }
    }
  );
}

/**
 * Registers the browser zone delete tool with the MCP server
 * @param server The MCP server instance
 */
/*
export function registerBrowserZoneDeleteTool(server: McpServer): void {
  // Delete a zone by its label
  server.tool(
    "browser_delete_zone",
    { 
      zone_label: z.string().describe("The label of the zone to delete")
    },
    async (params) => {
      const { zone_label } = params;
      
      // Get zones that match the label
      const matchingZones = tabManager.getZonesByLabel(zone_label);
      
      if (matchingZones.length > 0) {
        // For simplicity, delete the first matching zone
        const zone = matchingZones[0];
        const socketId = zone.socketId;
        
        // Delete the zone
        tabManager.removeZones(socketId, [zone.elementId]);
        
        // If there's a socket connected, tell it to delete the element on the page
        const socket = tabManager.getSocketById(socketId);
        if (socket) {
          socket.emit('delete-zone', { elementId: zone.elementId });
        }
        
        console.log(`[SERVER] Deleted zone: ${zone.label}`);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: true,
              message: `Zone "${zone_label}" deleted successfully`
            })
          }]
        };
      } else {
        // No matching zone found
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: false,
              message: `No zone found with label "${zone_label}"`
            })
          }]
        };
      }
    }
  );
}
*/ 