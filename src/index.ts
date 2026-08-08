#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createSamplerServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

async function main(): Promise<void> {
  const server = createSamplerServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe for logging: stdout is reserved for the MCP JSON-RPC stream.
  console.error(`${SERVER_NAME} v${SERVER_VERSION} listening on stdio`);
}

main().catch((error) => {
  console.error("Fatal error starting akai-mcp-sampler:", error);
  process.exit(1);
});
