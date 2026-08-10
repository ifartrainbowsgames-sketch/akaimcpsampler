# Sampler

A browser-based MPC-style sampler and sequencer. Runs entirely on-device —
no server, no upload, works offline.

## Status

All phases of [BUILD_PLAN.md](./BUILD_PLAN.md) are implemented:

- 16 velocity-sensitive pads with QWERTY fallback
- Sample import by drag-drop or file picker, persisted to OPFS
- Lookahead scheduler at 960 PPQN with correct Linn swing
- Per-pad amp/filter envelopes, filter types, tuning, pan, mute groups,
  mono/poly, pad link, offset
- Waveform display with start/end/loop markers and slice boundaries
- Chop by threshold (onset detection) or even regions, with slice-to-pads,
  split, merge and non-destructive extract
- Reverse playback, looping, note-on gating, destructive trim
- 16 Levels across velocity, filter or tune
- **Knob FX** — 18 master effects (delays, reverbs, filters, compressor,
  limiter, drive, modulation, bitcrush, vintage 12-bit emulations)
- **Pad FX** — 16 pressure-triggered performance effects, up to four at once
- **Song mode** and WAV export via `OfflineAudioContext`
- **Sample recording** from mic, with live chop points and a 25-second rolling
  Recall buffer
- **Web MIDI** in/out, pads mapped from C1
- Undo/redo, fader parameter assignment, project autosave, PWA install

Still open: offline time-stretch (currently repitch only). See the plan for the specs.

## Running

```bash
npm install
npm run dev
```

Open the URL Vite prints. Tap **Start** — browsers require a user gesture
before audio can begin, and on iOS both the context creation and the resume
must happen inside that gesture.

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

## Playing it

| Action | How |
|---|---|
| Load a sample | Drag an audio file onto a pad, or SAMPLE SELECT |
| Play a pad | Tap it, or `Z X C V` / `A S D F` / `Q W E R` / `1 2 3 4` |
| Start/stop | `Space`, or the transport buttons |
| Record | SEQ RECORD, then PLAY, then hit pads |
| Secondary functions | Hold `Shift` — pad legends turn red |
| Switch banks | PAD BANK cycles A–H |

## Architecture

```
UI (React)  ──commands──▶  Engine (plain TS)  ──▶  Web Audio graph
     ▲                                                  │
     └────────── rAF telemetry poll ────────────────────┘
```

**The UI never holds audio state and the engine never triggers a React
render.** Pads post commands into the engine; the engine writes playhead and
meter values into a plain object the UI polls on `requestAnimationFrame`.
Wiring React state into the audio path is the reliable way to introduce
glitches.

```
src/
  audio/
    types.ts       data model, PPQN constants
    engine.ts      master graph, pad chains, voice pool, transport
    scheduler.ts   lookahead scheduling + Linn swing
    voice.ts       per-hit graph, envelopes, region playback
    chop.ts        onset detection, slice ops, waveform peaks
  state/store.ts   zustand bridge between UI and engine
  storage/
    opfs.ts        sample files
    projects.ts    project JSON + autosave
  lcd/
    LCD.tsx        screen router
    pages.ts       declarative K1–K3 parameter pages
  ui/              panel chassis, pads, knob, fader, waveform
```

## Two things worth knowing before you edit

**Scheduling.** `scheduler.ts` uses lookahead scheduling — a Worker-hosted
timer ticks every 25 ms and hands events to Web Audio with absolute future
timestamps 100 ms ahead. Do not replace this with a timer that fires the sound
directly; the jitter is tens of milliseconds and it will sound broken.

**Swing.** Applied at playback time, never baked into stored events, so it
stays a live control. Only notes sitting exactly on the 16th grid move —
unquantized playing passes through untouched, which is the whole point.

50% straight · 54% loose · 62% classic hip-hop · 66.7% triplet.

## Licensing note

The visual design is inspired by classic hardware samplers but uses its own
branding and marks. Don't ship third-party logos or product names.

## Deploying

The app is fully static — no server, no API routes, no environment variables.
Everything runs on the user's device.

**Vercel.** Import the GitHub repo at vercel.com/new. `vercel.json` already
sets the framework preset, build command and output directory, so no
configuration is needed — accept the defaults and deploy. Every push to `main`
redeploys automatically.

Two things the hosted version gets that a local file doesn't, both because
they need a secure context: **OPFS** (so samples survive a reload) and
**AudioWorklet** (so the bitcrush and beat-repeat effects work). HTTPS comes
free on Vercel, so both work out of the box.

The app does not use `SharedArrayBuffer`, so no cross-origin isolation headers
are required.

**Anywhere else.** `npm run build` produces a `dist/` folder of static files.
Netlify, Cloudflare Pages, GitHub Pages and a plain nginx root all work the
same way. The only requirement is HTTPS.
