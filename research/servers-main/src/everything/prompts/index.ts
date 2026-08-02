
import { registerArgumentsPrompt } from "./args.js";
import { registerPromptWithCompletions } from "./completions.js";
import { registerEmbeddedResourcePrompt } from "./resource.js";
import { registerSimplePrompt } from "./simple.js";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register the prompts with the MCP server.
 *
 * @param server
 */
export const registerPrompts = (server: McpServer) => {
  registerSimplePrompt(server);
  registerArgumentsPrompt(server);
  registerPromptWithCompletions(server);
  registerEmbeddedResourcePrompt(server);
};
