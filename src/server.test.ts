import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";

import { createSamplerServer, SERVER_NAME } from "./server.js";

/** Connect an MCP client to the sampler server over a linked in-memory transport. */
async function connectClient() {
  const server = createSamplerServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function callText(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;
  return { text: content.map((c) => c.text ?? "").join("\n"), isError: result.isError === true };
}

describe("MCP sampler server", () => {
  let client: Client;

  beforeEach(async () => {
    client = await connectClient();
  });

  it("advertises the server and its tools", async () => {
    const version = client.getServerVersion();
    expect(version?.name).toBe(SERVER_NAME);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      ["add_sample", "assign_pad", "list_pads", "list_samples", "trigger_pad"].sort(),
    );
  });

  it("exposes the kit as a resource", async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain("sampler://kit");

    const read = await client.readResource({ uri: "sampler://kit" });
    const parsed = JSON.parse((read.contents[0] as { text: string }).text);
    expect(parsed.kitName).toBe("Default Kit");
    expect(parsed.pads).toHaveLength(16);
  });

  it("triggers a pad end-to-end via a tool call", async () => {
    const { text, isError } = await callText(client, "trigger_pad", { pad: 1, velocity: 100 });
    expect(isError).toBe(false);
    expect(text).toMatch(/Triggered pad 1: Kick 909/);
    expect(text).toMatch(/voice #1/);
  });

  it("adds a sample, assigns it, and triggers it", async () => {
    expect((await callText(client, "add_sample", {
      id: "vox",
      name: "Vocal Ahh",
      filename: "vox.wav",
      durationMs: 800,
    })).isError).toBe(false);

    expect((await callText(client, "assign_pad", { pad: 16, sampleId: "vox", tuneSemitones: 5 })).isError).toBe(
      false,
    );

    const triggered = await callText(client, "trigger_pad", { pad: 16, velocity: 127 });
    expect(triggered.isError).toBe(false);
    expect(triggered.text).toMatch(/Vocal Ahh/);
    expect(triggered.text).toMatch(/tune 5st/);
  });

  it("returns a tool error when triggering an empty pad", async () => {
    const { text, isError } = await callText(client, "trigger_pad", { pad: 16 });
    expect(isError).toBe(true);
    expect(text).toMatch(/empty/i);
  });
});
