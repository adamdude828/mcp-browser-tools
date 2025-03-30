import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTabTitleTool, setupTabSocketHandlers } from "./tabs.js";

/**
 * Registers all MCP tools with the server
 * @param server The MCP server instance
 */
export function registerAllTools(server: McpServer): void {
  // Register the tab title tool
  registerTabTitleTool(server);
}

// Export individual tool registration functions
export { 
  registerTabTitleTool,
  setupTabSocketHandlers 
}; 