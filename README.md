# akaimcpsampler

An Akai-style pad **sampler** exposed as a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server.

It models a classic 4x4 (16-pad) drum sampler entirely in memory: a kit of one-shot
samples mapped onto pads, each with gain and tuning, that can be struck at a given
velocity to produce voice events. No audio hardware is required, so the whole
instrument is deterministic and easy to drive from an MCP client.

## Requirements

- Node.js >= 20 (developed against Node 22)

## Install & build

```bash
npm ci        # or: npm install
npm run build
```

## Run the MCP server

The server speaks MCP over **stdio**, so it is normally launched by an MCP client
(Cursor, Claude Desktop, etc.):

```bash
npm start           # node dist/index.js
# or, without building:
npm run dev         # tsx src/index.ts
```

Example client entry (`command` + `args`):

```json
{
  "mcpServers": {
    "akai-mcp-sampler": { "command": "node", "args": ["dist/index.js"] }
  }
}
```

## Try it end to end

`npm run demo` spawns the built server over stdio, connects a real MCP client,
plays a one-bar beat, loads a custom sample, and reads the kit resource:

```bash
npm run build && npm run demo
```

## MCP surface

Tools:

- `list_samples` — list loaded samples
- `list_pads` — list all 16 pads and their assignments
- `add_sample` — register a new sample (`id`, `name`, `filename`, `durationMs`)
- `assign_pad` — map a sample onto a pad (`pad`, `sampleId`, optional `gain`, `tuneSemitones`)
- `trigger_pad` — strike a pad (`pad`, optional `velocity` 1-127) and return the voice event

Resource:

- `sampler://kit` — JSON snapshot of the current kit (samples + pad assignments)

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest (unit + in-process MCP integration tests)
```
