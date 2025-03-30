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