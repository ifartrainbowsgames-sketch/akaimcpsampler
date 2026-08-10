# MPC SAMPLE (akaimcpsampler)

16-pad sampler and sequencer — React 18, TypeScript, Vite, Zustand, Web Audio API. Live at https://akaimcpsampler.vercel.app

## Stack and layout

- **App shell:** `src/App.tsx`
- **State / sequencer:** `src/state/store.ts`, `src/audio/`
- **LCD screens:** `src/lcd/LCD.tsx`, `src/lcd/screenParams.ts`
- **Piano module:** `src/piano/` (overlay, song studio, Salamander samples via Tone.js)
- **Factory kits/demos:** `src/audio/factory/`
- **Guide popups:** `src/guide/`, `src/ui/GuideBubble.tsx`

## Conventions

- Match existing patterns; minimal diffs; no drive-by refactors.
- Branch names: `cursor/<name>-d00f`
- Bump `src/version.ts` and `public/sw.js` cache id on user-facing releases.
- Piano song export maps MIDI C4–D6 → pads 0–15 (melodic factory kit).

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update . --code-only` then `graphify cluster-only .` to refresh the graph (AST-only, no API cost).
