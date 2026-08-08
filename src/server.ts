import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { MAX_VELOCITY, MIN_VELOCITY, PAD_COUNT, Sampler, SamplerError } from "./sampler.js";

export const SERVER_NAME = "akai-mcp-sampler";
export const SERVER_VERSION = "0.1.0";

function errorResult(error: unknown) {
  const message = error instanceof SamplerError || error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  };
}

/**
 * Build an MCP server that exposes the {@link Sampler} model as tools and a
 * resource. Kept transport-agnostic so the same instance can be connected to
 * stdio, an in-memory transport (tests), or any other MCP transport.
 */
export function createSamplerServer(sampler: Sampler = new Sampler()): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Akai-style pad sampler. Inspect the kit with list_samples/list_pads, " +
        "map sounds with assign_pad, register new sounds with add_sample, and " +
        "strike pads with trigger_pad.",
    },
  );

  server.registerResource(
    "kit",
    "sampler://kit",
    {
      title: "Current sampler kit",
      description: "JSON snapshot of the loaded kit: samples and pad assignments.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(sampler.snapshot(), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "list_samples",
    {
      title: "List samples",
      description: "List every sample currently loaded in the sampler.",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(sampler.listSamples(), null, 2) }],
    }),
  );

  server.registerTool(
    "list_pads",
    {
      title: "List pads",
      description: `List all ${PAD_COUNT} pads and their sample assignments.`,
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(sampler.listPads(), null, 2) }],
    }),
  );

  server.registerTool(
    "add_sample",
    {
      title: "Add sample",
      description: "Register a new sample so it can be assigned to a pad.",
      inputSchema: {
        id: z.string().min(1).describe("Unique sample id, e.g. \"vox_ahh\""),
        name: z.string().min(1).describe("Human-readable name"),
        filename: z.string().min(1).describe("Source filename, e.g. \"vox_ahh.wav\""),
        durationMs: z.number().positive().describe("One-shot length in milliseconds"),
      },
    },
    async ({ id, name, filename, durationMs }) => {
      try {
        const sample = sampler.addSample({ id, name, filename, durationMs });
        return {
          content: [{ type: "text", text: `Added sample: ${JSON.stringify(sample)}` }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "assign_pad",
    {
      title: "Assign pad",
      description: "Map a sample onto a pad, optionally setting gain and tuning.",
      inputSchema: {
        pad: z.number().int().min(1).max(PAD_COUNT).describe(`Pad index (1-${PAD_COUNT})`),
        sampleId: z.string().min(1).describe("Sample id to place on the pad"),
        gain: z.number().min(0).max(1).optional().describe("Output gain 0.0-1.0"),
        tuneSemitones: z.number().int().min(-24).max(24).optional().describe("Pitch offset in semitones"),
      },
    },
    async ({ pad, sampleId, gain, tuneSemitones }) => {
      try {
        const updated = sampler.assignPad(pad, sampleId, { gain, tuneSemitones });
        return {
          content: [{ type: "text", text: `Pad ${pad} -> ${JSON.stringify(updated)}` }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "trigger_pad",
    {
      title: "Trigger pad",
      description: "Strike a pad at a given velocity and return the voice event.",
      inputSchema: {
        pad: z.number().int().min(1).max(PAD_COUNT).describe(`Pad index (1-${PAD_COUNT})`),
        velocity: z
          .number()
          .int()
          .min(MIN_VELOCITY)
          .max(MAX_VELOCITY)
          .optional()
          .describe(`MIDI velocity ${MIN_VELOCITY}-${MAX_VELOCITY} (default ${MAX_VELOCITY})`),
      },
    },
    async ({ pad, velocity }) => {
      try {
        const event = sampler.trigger(pad, velocity ?? MAX_VELOCITY);
        return {
          content: [
            {
              type: "text",
              text:
                `Triggered pad ${event.padIndex}: ${event.sampleName} ` +
                `(voice #${event.voiceId}, vel ${event.velocity}, gain ${event.effectiveGain}, ` +
                `tune ${event.tuneSemitones}st, ${event.durationMs}ms)`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
