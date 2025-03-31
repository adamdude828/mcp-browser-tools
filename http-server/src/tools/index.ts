import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  registerTabTitleTool, 
  registerBrowserZonesTool, 
  registerBrowserZoneDetailsTool, 
  setupTabSocketHandlers 
} from "./tabs.js";
import { registerScreenshotTools } from "./screenshots.js";

/**
 * Registers all MCP tools with the server
 * @param server The MCP server instance
 */
export function registerAllTools(server: McpServer): void {
  // Register the tab title tool
  registerTabTitleTool(server);
  
  // Register the browser zones tools
  registerBrowserZonesTool(server);
  registerBrowserZoneDetailsTool(server);
  
  // Register screenshot tools
  registerScreenshotTools(server);
}

// Export individual tool registration functions
export { 
  registerTabTitleTool,
  registerBrowserZonesTool,
  registerBrowserZoneDetailsTool,
  setupTabSocketHandlers 
}; 