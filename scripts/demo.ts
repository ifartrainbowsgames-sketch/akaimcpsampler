/**
 * End-to-end demo: spawn the built stdio MCP server as a child process, connect
 * a real MCP client to it, and drive a short "beat" through tool calls.
 *
 * Run with: npm run demo   (after npm run build)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(here, "..", "dist", "index.js");

type TextContent = { type: string; text?: string };

function render(result: { content?: unknown; isError?: boolean }): string {
  const content = (result.content as TextContent[]) ?? [];
  const text = content.map((c) => c.text ?? "").join("\n");
  return result.isError ? `  [tool error] ${text}` : text;
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
  const client = new Client({ name: "akai-demo-client", version: "0.1.0" });
  await client.connect(transport);

  const info = client.getServerVersion();
  console.log(`Connected to ${info?.name} v${info?.version} over stdio\n`);

  const { tools } = await client.listTools();
  console.log(`Tools (${tools.length}): ${tools.map((t) => t.name).join(", ")}`);

  const { resources } = await client.listResources();
  console.log(`Resources: ${resources.map((r) => r.uri).join(", ")}\n`);

  console.log("Playing a 1-bar beat:");
  const pattern: Array<{ pad: number; velocity: number }> = [
    { pad: 1, velocity: 127 }, // kick
    { pad: 4, velocity: 90 }, // closed hat
    { pad: 2, velocity: 110 }, // snare
    { pad: 4, velocity: 90 }, // closed hat
    { pad: 1, velocity: 120 }, // kick
    { pad: 4, velocity: 90 }, // closed hat
    { pad: 2, velocity: 110 }, // snare
    { pad: 5, velocity: 100 }, // open hat
  ];
  for (const step of pattern) {
    const res = await client.callTool({ name: "trigger_pad", arguments: step });
    console.log(render(res));
  }

  console.log("\nLoading and playing a custom sample:");
  console.log(
    render(
      await client.callTool({
        name: "add_sample",
        arguments: { id: "vox", name: "Vocal Ahh", filename: "vox_ahh.wav", durationMs: 800 },
      }),
    ),
  );
  console.log(
    render(
      await client.callTool({
        name: "assign_pad",
        arguments: { pad: 16, sampleId: "vox", gain: 0.9, tuneSemitones: 7 },
      }),
    ),
  );
  console.log(render(await client.callTool({ name: "trigger_pad", arguments: { pad: 16 } })));

  console.log("\nReading the kit resource:");
  const kit = await client.readResource({ uri: "sampler://kit" });
  const snapshot = JSON.parse((kit.contents[0] as { text: string }).text);
  console.log(`  kit "${snapshot.kitName}" with ${snapshot.samples.length} samples on ${snapshot.pads.length} pads`);

  console.log("\nDemo complete.");
  await client.close();
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
