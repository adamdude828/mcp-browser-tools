import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { tabManager } from "../services/tab-manager.js";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot directory path
const screenshotsDir = path.join(__dirname, '..', '..', 'uploads', 'screenshots');

/**
 * Registers the screenshot-related tools with the MCP server
 * @param server The MCP server instance
 */
export function registerScreenshotTools(server: McpServer): void {
  console.log(`[SERVER] Registering screenshot tools`);
  
  // Tool to copy a zone's screenshot to clipboard
  server.tool(
    "browser_copy_screenshot_to_clipboard",
    { 
      zone_label: z.string().describe("The label of the zone whose screenshot should be copied to the clipboard")
    },
    async (params) => {
      const { zone_label } = params;
      console.log(`[SERVER] browser_copy_screenshot_to_clipboard called for zone: "${zone_label}"`);
      
      try {
        // First, find the zone by its label
        const matchingZones = tabManager.getZonesByLabel(zone_label);
        
        if (matchingZones.length === 0) {
          console.log(`[SERVER] No zone found with label "${zone_label}"`);
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
        
        // For simplicity, use the first matching zone
        const zone = matchingZones[0];
        console.log(`[SERVER] Found zone "${zone_label}" with element ID "${zone.elementId}"`);
        
        // Look for the latest screenshot of this element
        const files = fs.readdirSync(screenshotsDir);
        const matchingFiles = files.filter(file => file.startsWith(`${zone.elementId}_`));
        
        if (matchingFiles.length === 0) {
          console.log(`[SERVER] No screenshot found for zone "${zone_label}" with elementId "${zone.elementId}"`);
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                success: false,
                message: `No screenshot found for zone "${zone_label}"`
              })
            }]
          };
        }
        
        console.log(`[SERVER] Found ${matchingFiles.length} screenshot(s) for zone "${zone_label}"`);
        
        // Sort by timestamp (filename format is elementId_timestamp.png)
        matchingFiles.sort((a, b) => {
          const timestampA = parseInt(a.split('_')[1].split('.')[0]);
          const timestampB = parseInt(b.split('_')[1].split('.')[0]);
          return timestampB - timestampA; // Most recent first
        });
        
        // Get the most recent screenshot
        const mostRecentFile = matchingFiles[0];
        const screenshotPath = path.join(screenshotsDir, mostRecentFile);
        console.log(`[SERVER] Using most recent screenshot: ${mostRecentFile}`);
        
        // Copy the image to clipboard based on OS
        await copyImageToClipboard(screenshotPath);
        
        console.log(`[SERVER] Screenshot for zone "${zone_label}" copied to clipboard`);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: true,
              message: `Screenshot for zone "${zone_label}" copied to clipboard`,
              filename: mostRecentFile
            })
          }]
        };
      } catch (error: any) {
        console.error('[SERVER] Error copying screenshot to clipboard:', error);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: false,
              message: `Error: ${error.message || 'Unknown error'}`
            })
          }]
        };
      }
    }
  );
  
  console.log(`[SERVER] Screenshot tools registered successfully`);
}

/**
 * Copy an image to the clipboard
 * @param imagePath Path to the image file
 * @returns Promise that resolves when the image is copied to clipboard
 */
function copyImageToClipboard(imagePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Determine the platform
    const platform = process.platform;
    let command: string;
    
    if (platform === 'darwin') {
      // macOS
      command = `osascript -e 'set the clipboard to (read (POSIX file "${imagePath}") as TIFF picture)'`;
    } else if (platform === 'win32') {
      // Windows - requires PowerShell
      command = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('${imagePath}'))"`;
    } else if (platform === 'linux') {
      // Linux - requires xclip
      command = `xclip -selection clipboard -t image/png -i "${imagePath}"`;
    } else {
      reject(new Error(`Unsupported platform: ${platform}`));
      return;
    }
    
    // Execute the command
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[SERVER] Error executing command: ${command}`);
        console.error(`[SERVER] ${error.message}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.warn(`[SERVER] Command stderr: ${stderr}`);
      }
      
      resolve();
    });
  });
} 