# Sampler — Build Plan

A browser-based MPC-style sampler and sequencer. Standalone, offline-capable,
installable, with real sample import and a sequencer whose timing holds up
against hardware.

---

## 1. The bar we're aiming at

The goal isn't "a drum machine in a browser" — those exist and nobody cares.
The reaction we want is a musician playing it for thirty seconds and saying
*this feels right*. That reaction comes from four things, in this order:

1. **Latency.** Pad-to-sound under ~20 ms. Above ~30 ms it feels broken and no
   amount of features rescues it.
2. **Timing.** The sequencer must not drift or jitter. This is a solved problem
   but it's solved a specific way (§4.2) and every other way sounds wrong.
3. **Swing that actually swings.** Roger Linn's swing is trivially simple and
   almost everyone implements it slightly differently, which is why most
   software swing feels stiff. Getting it exactly right (§4.3) is one of the
   highest ratio-of-impact-to-effort things in this whole document.
4. **Chop.** The moment someone drags in a break, hits chop, and the slices land
   on the pads ready to play — that's the demo moment.

Everything else is table stakes. If those four are right, the app is credible.
If any one is wrong, nothing else matters.

**Explicit non-goals for v1:** multi-track audio recording, VST/plugin hosting,
cloud collaboration, MIDI clock slaving to external gear.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + TypeScript | Fast HMR, no SSR baggage. This is a client app. |
| UI | React 19 | Familiar, and the panel is genuinely component-shaped. |
| State | Zustand | Small, no provider tree, easy to read from non-React code. |
| Audio | Raw Web Audio API + AudioWorklet | See below. |
| Local storage | OPFS (samples) + IndexedDB (projects) | OPFS handles multi-MB audio properly. |
| Cloud (optional) | Supabase Auth + Storage | Only for sync. Never in the audio path. |
| Packaging | PWA first, Capacitor later | See §9. |

**On Tone.js:** it would save perhaps a month — Transport, scheduling, and a
large effects library come free. The cost is an abstraction layer between us and
the timing, and timing is the entire product. Decision: **raw Web Audio for the
scheduler, voices, and envelopes.** We may pull individual Tone effect
implementations as reference, but not the runtime.

**No Next.js.** Server rendering contributes nothing here and the App Router's
client/server split actively fights a stateful audio engine.

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│  UI (React)                                 │
│  panel, pads, LCD screens, knobs, fader     │
└───────────────┬─────────────────────────────┘
                │  commands only (trigger, setParam, loadKit)
                │  ← telemetry (playhead, meters) via rAF poll
┌───────────────▼─────────────────────────────┐
│  Engine (plain TS, no React)                │
│  scheduler · voice pool · param graph       │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│  Web Audio graph  ·  AudioWorklets for DSP  │
└─────────────────────────────────────────────┘
```

**Hard rule: the UI never holds audio state and the engine never triggers a
React render.** Pads post commands into the engine. The engine writes playhead
and meter values into a plain object which the UI polls on
`requestAnimationFrame`. Wiring React state into the audio path is the single
most reliable way to kill this project — every re-render becomes a potential
audio glitch.

### Audio graph per pad

```
AudioBufferSourceNode        (one per hit, disposable)
   → GainNode                (amp envelope)
   → BiquadFilterNode        (filter + filter envelope on .frequency)
   → StereoPannerNode        (pan)
   → padGain                 (persistent, per-pad volume + mute)
   → [knobFX send if enabled]
   → kitGain → compressor → padFXChain → masterGain → destination
```

`padGain` and everything downstream is created once at init and never torn
down. Only the source/env/filter/pan trio is per-hit — those are cheap and
garbage-collect cleanly once `onended` fires.

---

## 4. The audio engine

### 4.1 Voice model

- Pool of 32 stereo voices, matching the reference hardware.
- Voice stealing: oldest-first, except voices in the same mute group, which are
  stopped explicitly.
- **Mono/Poly per pad.** Mono retriggers from the start point and cuts the
  previous instance. Poly layers.
- **Mute groups (1–16).** Triggering a pad stops any playing voice sharing its
  group — this is how open/closed hi-hat behaves.
- **Pad link.** Pad A triggers pad B simultaneously. One level deep, no
  recursion, guard against cycles.

Envelopes use `AudioParam` automation, not JS timers:

```ts
// amp envelope, one-shot mode
g.gain.setValueAtTime(0, t);
g.gain.linearRampToValueAtTime(vel, t + attack);
g.gain.setTargetAtTime(0, t + attack, decay / 3);
```

`setTargetAtTime` gives the exponential-ish tail that sounds natural; the `/3`
approximates a decay-to-near-zero over the stated time.

### 4.2 Scheduler

**Lookahead scheduling.** A `setInterval` tick every **25 ms** walks the event
list and schedules everything falling within the next **100 ms** against
`audioContext.currentTime`. Events are handed to Web Audio with absolute future
timestamps, so the audio thread executes them sample-accurately even if the JS
timer wobbles.

This is Chris Wilson's "A Tale of Two Clocks" pattern and it is not optional.
Alternatives and why they're rejected:

- `setInterval` firing the sound directly → jitter of tens of ms. Unusable.
- `requestAnimationFrame` → stops in background tabs, fixed ~16 ms interval.
- AudioWorklet as clock → fires every 128 samples (~2.7 ms), far more often than
  needed, and adds a message-port hop for no benefit.

Background-tab throttling of `setInterval` is a known limitation. Mitigation:
run the tick from a **Web Worker** timer, which most browsers throttle less
aggressively.

**Resolution: 960 PPQN**, matching the reference. All event positions are
integer ticks. Ticks → seconds happens only at schedule time:

```ts
const secPerTick = 60 / bpm / 960;
```

### 4.3 Swing — get this exactly right

Linn's implementation is one sentence: *delay every even-numbered 16th note
within each 8th note.* Swing percentage is the share of the 8th note given to
the first 16th of the pair.

- 50% = straight (both 16ths equal)
- 54% = loosens a straight beat without reading as swing
- 62% = the classic loose hip-hop feel
- 66.7% = perfect triplet swing
- range: 50–75%

```ts
const TICKS_PER_8TH = 480;            // at 960 PPQN
const TICKS_PER_16TH = 240;

function applySwing(tick: number, swingPct: number): number {
  const posIn8th = tick % TICKS_PER_8TH;
  const isOffbeat16th = posIn8th >= TICKS_PER_16TH;
  if (!isOffbeat16th) return tick;
  const delay = (swingPct / 100 - 0.5) * TICKS_PER_8TH;
  return tick + delay;
}
```

Two things that matter:

- **Swing is applied at playback, not baked into the stored events.** This makes
  it a live performance control ("RT Swing") you can move while the sequence
  runs, which is exactly what makes it fun.
- Swing applies to notes at 16th positions. Notes recorded off-grid (unquantized
  finger-drumming) should pass through untouched — that raw feel is the point.

### 4.4 Quantize

- **Record quantize**: snap on input, at the current Q division.
- **Time Correct**: destructive quantize applied after the fact, per pad, with
  `Shift` (a fixed tick offset for humanizing) and `Swing` as separate controls.
- Undo must work on both. Keep a bounded event-list history (say 50 states).

### 4.5 Chop

Two paths:

**Threshold (auto).** Onset detection over the sample:
1. Compute a short-window RMS envelope (~512-sample hop).
2. Mark a slice where the envelope crosses the threshold going upward.
3. Enforce a refractory period (~50 ms) so a single hit doesn't split into three.
4. Cap at 16 slices, snap each boundary back to the nearest zero crossing to
   avoid clicks.

**Regions (4/8/16)** — even division. Trivial and reliable; make it the default
for anything already tempo-locked.

**Manual** — tap pads while the sample plays to drop slice points.

Slices are non-destructive: they're start/end offsets into one shared
`AudioBuffer`. Extract writes a new buffer only when the user asks.

### 4.6 Warp (time-stretch / pitch)

Two modes, following the hardware:

- **Pitch mode** — trivial. `source.playbackRate` changes length and pitch
  together. Ship this in v1.
- **Time-stretch mode** — pitch-independent. This is the expensive one.

Realtime stretch in the audio thread is a genuine cost. Both leading libraries
have tradeoffs: Rubber Band gives better quality and handles transients well but
its CPU load is high enough that realtime use on mobile is questionable;
SoundTouch is far lighter and runs comfortably realtime but works in the time
domain and smears drum transients — bad for exactly the material a sampler eats.

**Decision: offline stretch, not realtime.** When warp is set, render the
stretched buffer once with a Rubber Band WASM build, cache it, and play the
cached buffer. Quality of Rubber Band, cost paid once, zero realtime penalty.
Re-render on tempo change with a debounce. If a sample is set to follow sequence
tempo, re-render on BPM commit rather than on every knob tick.

### 4.7 Effects

Native nodes cover most of it and cost nothing:

| Effect | Implementation |
|---|---|
| LP/HP/BP filter, Classic | `BiquadFilterNode` (Classic = LP with a resonance curve tweak) |
| Delay, Tape/Diff Delay | `DelayNode` + feedback gain + damping filter |
| Reverb | `ConvolverNode` with generated impulse responses |
| Compressor | `DynamicsCompressorNode` (+ custom colour stage) |
| Tube Drive, Soft Clipper | `WaveShaperNode` with fitted curves |
| Chorus/Flanger/Phaser | `DelayNode` + LFO `OscillatorNode` on delayTime |
| Auto-Pan | LFO → `StereoPannerNode.pan` |

Needs **AudioWorklet**:

- Bitcrush / LoFi (sample-rate and bit-depth reduction)
- Granulator
- Beat Repeat, Rev Stepper, Flex Beat (need a synced ring buffer of recent audio)
- Ring Mod

Worklet discipline: **no allocation inside `process()`**, preallocate all
buffers in the constructor, keep code branch-light, flush denormals. Parameters
arrive via `AudioParam` where they're audio-rate, `MessagePort` where they're
control-rate.

**Flex Beat** is the interesting one — it needs a rolling buffer of the last few
bars of master output so it can loop, reverse, stutter and gate it in sync. Build
that as a dedicated worklet holding a bar-length circular buffer.

### 4.8 Note Repeat

While a pad is held with Note Repeat engaged, the scheduler emits repeated
events at the current division. Two rules that make it feel right: repeats
respect the current swing setting, and the first hit fires immediately rather
than waiting for the next grid line.

---

## 5. Data model

```ts
type Project = {
  id: string;
  name: string;
  bpm: number;                  // global or per-sequence
  timeSignature: [number, number];
  swing: number;                // 50–75
  banks: Bank[];                // 8 banks × 16 pads
  sequences: Sequence[];        // 8 banks × 16 sequences
  song: SongStep[];
  masterFX: FXState;
};

type Pad = {
  sampleId: string | null;      // → OPFS
  start: number; end: number; loopStart: number;   // frames
  slices: Slice[];
  gain: number; pan: number; semi: number; fine: number;
  warp: { mode: 'pitch' | 'stretch'; amount: number | 'seq'; beats: number };
  polyphony: 'mono' | 'poly';
  muteGroup: number | null;
  padLink: number | null;
  noteOn: boolean; loop: boolean; reverse: boolean;
  ampEnv: Envelope; filterEnv: Envelope;
  filter: { type: FilterType; cutoff: number; reso: number };
};

type Event = {
  tick: number;                 // 960 PPQN, absolute in sequence
  pad: number; bank: number;
  velocity: number;             // 1–127
  duration: number;             // ticks, for note-on pads
};
```

Sequences hold a flat, tick-sorted `Event[]`. Keep it sorted on insert — the
scheduler then only ever advances a cursor rather than filtering the array
every tick.

Automation is a parallel list of `{tick, param, value}` records per pad,
scheduled the same way.

---

## 6. Storage

| Data | Where | Notes |
|---|---|---|
| Decoded sample audio | OPFS | Written as WAV/raw. Real file handles, no size ceiling in practice. |
| Projects, kits | IndexedDB | Small JSON, frequently written. |
| Factory content | Fetched + cached in OPFS on first run | Keep the initial bundle small. |
| Cloud backup | Supabase Storage | Opt-in, background, never blocks the UI. |

**Import**: `File` → `arrayBuffer()` → `decodeAudioData()` → store raw frames in
OPFS + write metadata to IndexedDB. Accept wav, mp3, aiff, flac, ogg — whatever
the browser will decode.

**Autosave** on a debounce, mirroring the hardware behaviour where work is never
lost. Explicit "Save Project" copies to a named slot.

---

## 7. Repo layout

```
sampler/
├─ src/
│  ├─ audio/
│  │  ├─ engine.ts            init, master graph, teardown
│  │  ├─ scheduler.ts         lookahead loop, swing, transport
│  │  ├─ voice.ts             one-shot voice construction
│  │  ├─ pad.ts               persistent per-pad chain
│  │  ├─ fx/                  one file per effect
│  │  ├─ worklets/            *.worklet.ts, bundled separately
│  │  ├─ chop.ts              onset detection
│  │  └─ warp.ts              rubberband wasm wrapper
│  ├─ state/
│  │  ├─ project.ts           zustand store, serialisable
│  │  └─ transport.ts         ui-facing playhead mirror
│  ├─ ui/
│  │  ├─ Panel.tsx            chassis layout
│  │  ├─ Pad.tsx  Knob.tsx  Fader.tsx  Button.tsx
│  │  └─ lcd/                 one component per screen
│  ├─ storage/
│  │  ├─ opfs.ts  projects.ts  supabase.ts
│  ├─ midi/                   Web MIDI in/out
│  └─ main.tsx
├─ public/factory/            starter kits
├─ BUILD_PLAN.md
└─ vite.config.ts
```

Worklets need their own bundle entry — Vite handles this with
`?worker&url` imports, but they can't share the app's module graph, so keep
worklet code dependency-free.

---

## 8. Build phases

Each phase ends with something playable. Don't move on until the acceptance
criterion passes.

### Phase 0 — Skeleton (½ day)
Vite + TS + React scaffold, existing panel HTML ported to components.
*Done when:* the panel renders and is responsive, no audio.

### Phase 1 — Sound (2 days)
AudioContext behind a user gesture. Load one bundled sample. 16 pads trigger it.
Velocity from pointer pressure where available, fixed otherwise.
*Done when:* tapping a pad makes a sound with no perceptible delay on desktop
**and** on a phone. Measure it — don't guess.

### Phase 2 — Import (2 days)
Drag/drop + file picker → decode → OPFS → assign to pad. Waveform renders on the
LCD. Start/end trim with the knobs.
*Done when:* a user's own drum hit plays back trimmed, and survives a reload.

### Phase 3 — Sequencer (4 days) ← the critical phase
Lookahead scheduler. Record, overdub, playback, loop. Sequence length, quantize,
swing, metronome, count-in. Pads light in time.
*Done when:* a 4-bar loop plays for five minutes with no audible drift, and
swing at 62% feels right against a straight kick. Have a drummer listen.

### Phase 4 — Sample editing (3 days)
Chop (threshold / regions / manual), slice-to-pads, extract, trim, reverse, loop,
note-on vs one-shot, 16 Levels.
*Done when:* drag in a break → chop → play the slices as a new pattern.

### Phase 5 — Sound shaping (3 days)
Amp and filter envelopes, filter types, tune, pan, mute groups, pad link,
polyphony, fader assignment.
*Done when:* a kit sounds intentionally designed, not like raw samples.

### Phase 6 — FX (5 days)
Native-node effects first, then worklets. Pad FX (pressure-driven), Knob FX,
Compressor. Flex Beat last — it needs the ring-buffer worklet.
*Done when:* Pad FX can be performed over a running sequence without dropouts.

### Phase 7 — Arrangement (2 days)
Sequence launching with queueing, Song mode, export to WAV via
`OfflineAudioContext`.
*Done when:* a finished track exports and sounds identical to playback.

### Phase 8 — Polish (ongoing)
Sample recording via `getUserMedia`, resampling, Web MIDI in/out, undo/redo
everywhere, PWA install, factory kit library.

---

## 9. Platform notes

**iOS is the hard target.**
- `AudioContext` must be created *and resumed* inside a user gesture. Ship an
  explicit "tap to start" screen; don't try to be clever.
- Use `touchstart`/`pointerdown`, never `click` — `click` adds delay.
- `touch-action: manipulation` on pads specifically, not globally on `html`
  (global application breaks native input behaviour).
- Silent switch: audio routes through a category that respects it. Test with the
  switch on.
- Installed PWAs on recent iOS have had real audio regressions where sound
  breaks after first use. **Test PWA mode on a physical device early.** If it
  bites, Capacitor is the fallback — same code, WKWebView, App Store
  distribution.

**Android/Chrome** is comparatively easy. AudioWorklet is solid, OPFS is solid,
latency is good.

**Desktop** is the development target but not the primary one. Make sure the
keyboard maps to pads (QWERTY grid) for people without touchscreens.

---

## 10. Performance budget

| Metric | Target | Hard fail |
|---|---|---|
| Pad-to-sound latency | < 20 ms | > 30 ms |
| Scheduler tick cost | < 2 ms | > 10 ms |
| Timing jitter | < 1 ms | audible drift |
| Worklet `process()` | < 30% of the 2.7 ms budget | dropouts |
| Cold start to playable | < 3 s | > 8 s |

Instrument these from Phase 1. A regression in latency is much easier to catch
the day it lands than three months later.

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| iOS PWA audio bugs | High | Test on device by Phase 1. Capacitor fallback ready. |
| Time-stretch CPU | Medium | Offline render, not realtime (§4.6). |
| Scheduler throttled in background tabs | Medium | Worker-hosted timer. |
| Flex Beat ring buffer complexity | Medium | Schedule it last; it's the least essential feature. |
| Scope creep into a DAW | High | The non-goals list in §1 is binding. |

---

## 12. Open decisions

- Free vs paid, and whether cloud sync is the paywall.
- Factory content: license a sample pack, commission one, or ship minimal and
  lean on user import?
- Own branding and visual identity — the current mockup uses placeholder marks.
- Desktop app via Tauri later, or web + mobile only?

---

## 13. First commit

```bash
npm create vite@latest sampler -- --template react-ts
cd sampler && npm i zustand
```

Then Phase 1, and nothing else, until a pad makes a sound with no perceptible
delay on a phone. That single result determines whether the rest of this
document is worth building.

---

# Appendix A — Complete LCD screen specification

Derived from the reference hardware's official user guide (v1.0 RevB). This is
the full menu tree, every parameter, every range. Build the LCD as a screen
router against this spec — it is the app's entire information architecture.

## A.0 Global display rules

**Screen furniture.** Every screen carries a status area showing battery state
and charging state. Battery is colour-coded: green 100–30%, amber 29–15%, red
14–5%, blinking red below 5%.

**The three function buttons (B1/B2/B3)** sit above the display and are always
context-dependent. They either cycle through pages within a mode or fire a
labelled action ("Do It!", "Cancel", "Back"). Their meaning must always be
legible on screen — never rely on the user remembering.

**The three knobs (K1/K2/K3)** map to the three parameters shown along the
bottom of the display. Their labels change with the current page.

**Soft takeover.** Knobs and the fader are absolute-position only. When you move
between pages, a control's physical position won't match the new parameter's
value. The display shows a directional arrow (◀ or ▶) next to the parameter name
indicating which way to move before the control regains authority. **This must be
implemented** — without it, every page change causes a parameter jump. On a
touchscreen the equivalent is: a knob doesn't take effect until the drag has
crossed the current value.

**Encoder as fallback navigation.** Pressing the encoder cycles through the three
bottom-row parameters; turning it then adjusts the selected one. Shift+press
cycles backwards. This means every knob parameter is reachable without knobs —
important for the mobile layout.

**Shift indicator.** When a screen has additional shift-accessible parameters, a
shift icon appears. Holding Shift swaps the K1–K3 and B1–B3 labels to their
alternates.

**Button LED states** (mirror these in the UI):
- Brightly lit = function currently active
- Dimly lit = available but not active
- Off = unavailable in this context
- While Shift is held: dim red = secondary function inactive, bright red = active

---

## A.1 Sample Mode — the main screen

The default screen and the visual identity of the whole app.

**Layout:**
- High-resolution waveform, centre
- Vertical volume meter, left of the waveform
- Vertical pan meter, right of the waveform
- Sample name and pad address (e.g. `A02 HipHop-Snr-Rys1`) along the top
- Status icons: ♪ (Note On playback), ⟳ (Loop), ← (Reverse), 16 (16 Levels)
- Three parameter cells along the bottom, driven by K1–K3

Pressing a pad triggers it and shows its sample. Holding SAMPLE + pad selects
without triggering. A muted pad's waveform renders greyed out and won't trigger.

### B1 page group — Trim / Mix / Amp Env

**Trim**
| Control | Parameter | Range |
|---|---|---|
| K1 | Start | 0–100% |
| K2 | End | 0–100% |
| K3 | Loop | 0–100% |
| Shift+K1 | Zoom: Start | 0–100% |
| Shift+K2 | Zoom: End | 0–100% |
| Shift+K3 | Zoom: Loop | 0–100% |
| Shift+B1 | Loop Lock | on/off — locks loop start to sample start |

**Mix**
| Control | Parameter | Range |
|---|---|---|
| K1 | Volume | -INF, -74.00 to +6.00 dB |
| Shift+K2 | Kit Volume | -INF, -74.00 to +6.00 dB |
| K3 | Pan | 50L – C – 50R |

**Amp Env**
| Control | Parameter | Range |
|---|---|---|
| K1 | Attack | 0–127 |
| K2 | Decay (one-shot) / Release (note-on) | 0–127 |
| Shift+K2 | Decay From | Start / End |
| K3 | Vel Sens | 0–127 (0 = always full velocity) |

### B2 page group — Tune / Play

**Tune**
| Control | Parameter | Range |
|---|---|---|
| K1 | Semi Tune | -24 – 0 – +24 semitones |
| K2 | Fine Tune | -90 – 0 – +90 cents |
| K3 | Warp | Off, 50–200%, Seq |
| Shift+K3 | # Beats | sample length in beats |

Warp mode is set by Shift+Pad 15. In **Time Stretch** mode, 50% is half as long
(twice as fast), 200% is twice as long; pitch is preserved. `Seq` locks the
sample's tempo to the sequence. In **Pitch** mode length and pitch move together,
and Semi/Fine Tune become unavailable.

**Play**
| Control | Parameter | Range |
|---|---|---|
| K1 | Polyphony | Mono / Poly |
| K2 | Mute Group | Off, 1–16 |
| Shift+K2 | Pad Link | Off, 1–16 (same bank only) |
| K3 | Offset | 0–100% — delays sample start after the hit |

### B3 page group — Filter / Filt Env

**Filter**
| Control | Parameter | Range |
|---|---|---|
| K1 | Cutoff | 0–127 |
| K2 | Reso | 0–127 |
| K3 | Type | Off, Classic, LPF2, LPF4, HPF2, HPF4, BPF2, BPF4 |

`Classic` is a low-pass variant modelled on the MPC3000's filter, with a
different character as resonance increases. The 2/4 suffix is the damping slope.

**Filt Env**
| Control | Parameter | Range |
|---|---|---|
| K1 | Attack | 0–127 |
| K2 | Decay / Release | 0–127 |
| Shift+K2 | Decay From | Start / End |
| K3 | Depth | 0–127 — envelope's influence on cutoff |

---

## A.2 Chop Mode (overlay on Sample Mode)

When Chop is active, the Trim controls are **replaced** by Chop controls. The
waveform gains slice boundary markers, and pads map to slices.

| Control | Parameter | Range |
|---|---|---|
| K1 | Slice Start | 0–100% of slice |
| K2 | Slice End | 0–100% of slice |
| K3 | Chop Type | Threshold, Regions 4, Regions 8, Regions 16, Manual |
| Shift+K1/K2 | Zoom: Start / End | 0–100% |
| Shift+K3 | Threshold | 0–100% (higher = fewer slices) |
| Shift+B1 | **Extract** | selected slice → new sample on next free pad |
| Shift+B2 | **Split** | halve the selected slice; later slices renumber +1 |
| Shift+B3 | **Merge** | merge with previous slice; later slices renumber -1 |
| Erase + pad | Remove slice | merges into previous, renumbers |

Max 16 slices. Manual mode: tap Pad 1 to start playback and set the first slice
point, then tap pads as it plays to drop further points. Editing any slice
automatically switches Chop Type to Manual. **Slice edits are outside undo/redo**
on the hardware — we should improve on this and make them undoable.

---

## A.3 Sample Browser

Reached via SAMPLE SELECT.

- Encoder or -/+ browses categories, then samples
- Encoder press opens a folder / loads the highlighted sample to the current pad
- Highlighted samples auto-preview through the output

| Button | Action |
|---|---|
| B1 | Back |
| B2 | Toggle Internal / External drive |
| B3 | Preview on/off |

External defaults to an auto-created `MPC-Sample/Samples` directory but allows
free navigation. Our web equivalent: OPFS root vs an imported folder handle.

---

## A.4 Name entry screen (Save Sample / Save Project / Export Song)

One shared component, used in three places.

- Encoder scrolls through letters and numbers
- Encoder press selects the character and advances
- Hold Shift for capitals
- -/+ moves between character positions
- B2 erases the current character; Shift+B2 erases all
- B3 = **Do It!** (commit)
- B1 = **Cancel**

On touch, offer a real keyboard as well — but keep the encoder path working, it's
part of the feel.

---

## A.5 Sample Record Mode

**Layout:** live input waveform, a signal indicator in the top-right that lights
when input exceeds threshold, and a speaker icon showing whether the built-in
speaker is currently active (crossed out when muted — which happens
automatically when recording from the internal mic, to prevent feedback).

| Control | Parameter | Values |
|---|---|---|
| B1 | Monitor | Off / Auto / On |
| K1 | Source | Mic, Rear, Rear L, Rear R, Resample, USB, USB L, USB R |
| K2 | Rec Length | Free, Seq |
| K3 | Threshold | -96 – 0 dB |

Recording starts by tapping the destination pad. **While recording, tapping
further pads drops chop points live** — this is the "lazy chopping" workflow and
it's a genuinely great feature; don't skip it.

Stop via the same pad, STOP, or the record button. Stopping with the record
button returns to Sample Mode with the new sample selected; the others stay in
record mode for another take.

**Recall**: retrieves the last 25 seconds of input from the selected source onto
the next free pad — a rolling buffer that's always capturing. Web equivalent: a
circular buffer worklet fed from `getUserMedia`, always running once permission
is granted.

---

## A.6 Sequence Mode

**Layout:** BPM (large), sequence name below it, time signature below that,
metronome state above the sequence time, and a `1234` count-in icon (red when
active, grey when not).

| Control | Parameter | Range |
|---|---|---|
| Encoder | Playhead by beats | — |
| Shift+Encoder | Playhead by Q value | — |
| B1 (hold) | Sequence BPM window — encoder adjusts; encoder press toggles whole/decimal | — |
| B2 | BPM scope | SEQ (per-sequence) / GBL (global) |
| B3 | Record Quantize | on/off |
| K1 | Length | 1, 2, 4, 8, 16, 32, 64, 128 bars |
| Shift+K1 | Length (fine) | any 1–128 |
| K2 | Q (quantize division) | 1/4 … 1/64, triplets |
| Shift+K2 | Time signature | project-wide — all sequences share it |
| K3 | RT Swing | live, non-destructive; shifts events relative to the Q grid |
| Shift+K3 | Metronome volume | — |

**Pads become sequence selectors.** Sequences with events light green; empty ones
are dim. When stopped, the current sequence flashes bright green (queued).
Pressing another pad during playback queues it — it flashes until the current
sequence ends, then takes over. This queueing behaviour is what makes live
performance work; get the visual states exactly right.

**Sample/Seq hybrid mode:** hold SEQ and press SAMPLE (or vice versa) to keep the
Sequence Mode display while the pads stay in sample-triggering mode. Both buttons
flash. This is how you record — worth implementing as a proper state, not a hack.

---

## A.7 Step Edit

| Control | Action |
|---|---|
| Encoder | Move between steps at the current Q value |
| -/+ | Move between events on the current step |
| Pad | Select that pad's event on this step |
| **Fader** | Nudge the selected event earlier/later from its position |
| K1 | Sequence length |
| K2 | Q value (also sets the encoder's step size) |
| Shift+K2 | Time signature |
| K3 | Velocity of the selected event |
| B1 (hold) | Tempo via encoder |
| B3 | Erase selected event |
| Erase + pad | Erase all events from that pad → B1 Cancel / B3 Do It! |

The fader-as-nudge is unusual and good. Keep it.

---

## A.8 Song Mode

A list of sequences played in order, exportable.

- Pads select a sequence (filled = bright, empty = dim)
- B3 **Insert** at the current position (after the highlighted entry)
- B2 **Remove** the highlighted entry
- Encoder or -/+ browses the song list
- PLAY plays from the top; Shift+PLAY plays from the highlighted entry
- B1 **Export** → B2 = audio mixdown (name entry → Do It!), B3 = render as a new
  sequence into the next free slot

If a rendered sequence would exceed 128 bars, its length becomes non-editable.

---

## A.9 Pad FX

16 effects, one per pad, triggered by pressure — harder press = more effect.
Up to four simultaneous; a fifth bypasses the oldest, which re-engages when the
newer ones release.

**B1 = Latch** holds an effect at its current amount.

| Pad | Effect | K1 | K2 | K3 |
|---|---|---|---|---|
| 1 | Half Speed | Speed ×1.5/×2/×4 | Mix 0–100% | — |
| 2 | Chorus | Rate 0.40–3.20 Hz | Depth 0–100% | Feedback 0–100% |
| 3 | Flanger | Rate 0.02–10.00 Hz | Depth 0–100% | Feedback 0–100% |
| 4 | Phaser | Feedback 0–100% | Speed (2 bars…1/64) | Range 0–100% |
| 5 | Comb Filter | Speed (2 bars…1/64) | — | — |
| 6 | LP Filter | Resonance 0–100% | Speed (2 bars…1/64) | Range 0–100% |
| 7 | HP Filter | Resonance 0–100% | Speed (2 bars…1/64) | Range 0–100% |
| 8 | BP Filter | Resonance 0–100% | Speed (2 bars…1/64) | Range 0–100% |
| 9 | Ring Mod | Max Freq 40–400 Hz | — | — |
| 10 | LoFi | Bitcrush 24.00–2.00 | Decimator 0–100% | — |
| 11 | Color | Mode: Cassette, Flutter, Tube Amp, Vinyl, Saturation, Radio | — | — |
| 12 | Granulator | Density 1.0–300.0/s | Feedback 0–100% | Grain Len 10–200 ms |
| 13 | Beat Repeat | Division 1/4…1/64 | Reverse Off/On | Resonance 0–100% |
| 14 | Rev Stepper | Delay Time 1/4…1/64 | Repeats 2–8 | — |
| 15 | Delay | Time 1/1…1/64t | Feedback 0–100% | Range: Normal, X-Feedback, PingPong |
| 16 | Reverb | Pre-Delay 0–250 ms | Decay 0–100% | Diffusion 0–100% |

Filters 6–8 each have an LFO driven by their Speed and Range values.

Speed division list (shared): 2 bars, 1 bar, 1/2, 1/4, 1/4t, 1/8, 1/8t, 1/16,
1/16t, 1/32, 1/64.

---

## A.10 Flex Beat

Time-based effects that warp pitch, time and volume of the whole sequence —
beat chops, DJ scratches, trance gates. Applied to the master output during
playback.

- **Pad 1 is always Empty** — the baseline / release position
- Pads 2–16 trigger effects
- B3 = Quantize on/off (effects engage at the next time division)
- K1 = Mode: One Shot (returns to Empty after completing) / Loop (repeats until
  another pad or Empty is selected)
- K3 = Mix 0–100% dry/wet

Implementation note: this needs the ring-buffer worklet from §4.7. It's the most
technically demanding screen and the least essential — schedule it last.

---

## A.11 Knob FX

A single effect controlled by K1–K3, leaving the pads free for playing. Applied
per-pad or globally.

**Selection screen** (Shift + Knob FX): encoder browses the effect list, encoder
press loads. Pads choose which are affected — lit = affected, dim = not.
B2 = All Pads. B3 = Bypass.

| Effect | K1 | K2 | K3 | Shift+K1 | Shift+K2 | Shift+K3 |
|---|---|---|---|---|---|---|
| Delay | Time (synced or 1 ms–2 s) | Feedback 0–100% | Mix | Sync Off/On | Damping 1.00–20.0 kHz | Width 0–100% |
| Diff Delay | Time | Feedback | Mix | Sync | Diffusion 0–100% | High Damp 0–100% |
| Tape Delay | Time 1…1/16. | Feedback 0–100 | Mix | Wow/Flut 0–100 | Ramp 0–100 | Spread 0–100 |
| Sample Delay | Left 0–250 ms | Right 0–250 ms | — | — | — | — |
| Reverb Small/Med/Large | Pre-Delay 0–250 ms | Time 0.4–71.5 s, +inf | Mix | ER/Tail Mix | Density | Low Cut 1–1000 Hz |
| Spring Reverb | Pre-Delay | Time 1.0–10.0 s | Mix | Width | Diffusion | Low Cut 20 Hz–1 kHz |
| HP Filter | Frequency 10–19999 Hz | Resonance 0–100 | — | — | — | — |
| LP Filter | Frequency 22–19999 Hz | Resonance 0–100 | — | — | — | — |
| BP Filter | Frequency 55 Hz–20 kHz | Resonance 0.7–20.0 | — | — | — | — |
| Bus Compressor | Attack 0–100 | Release 0–100 | Threshold -50–0 | Ratio 1–20 | Output -6–24 | Mix 0–100 |
| Limiter | Gain -12.0–36.0 dB | Ceiling -24.0–0.0 dB | Release 10 ms–10 s | — | — | — |
| Pumper | Speed (Bar…1/32T) | Shape 0–100% | Depth 0–100% | Attack | Hold | Release |
| Transient | Attack -100–+100% | Shape 0–100% | Sustain -100–+100% | — | — | — |
| Noise Gate | Threshold -120–0 dB | Depth 0 – -120 dB | — | Attack 0.01–1000 ms | Hold 0–1000 ms | Release 1–3000 ms |
| Amp Sim | Cab Model (D.I., Brit, 1x8"…4x10" Bass, Radio) | Drive 0.0–11.0 | Soft Clip 0–100% | Bass ±12 dB | Mid ±12 dB | Treble ±12 dB |
| Tube Drive | Drive 0–100% | Headroom -30.0–0.0 dB | Saturation 0–100% | — | — | — |
| Soft Clipper | Drive 1.0–10000.0% | Shape: Tanh/Sine/Parabolic | Mix | True Peak Off/On | Rel Time 0.1–100 ms | Post Lvl -Inf–0.0 dB |
| Ensemble | Rate 0.1–10.0 Hz | Depth 0.00–24.00 ms | Mix | Delay | Shimmer | Width |
| Multi-Chorus | Rate 0.1–10.0 Hz | Depth 0.00–24.00 ms | Mix | Voices 3/4/6 | Delay | — |
| Phaser | Rate 0.10–10.00 Hz | Depth 0–100% | Mix | Model: Vibe/Stone/Ninety/Tron | Feedback | — |
| Flanger | Rate 0.02–10.00 Hz | Depth 0–100% | Mix | Feedback 0–100% | — | — |
| Auto-Wah | Sens 0–100 | Resonance 0–100 | Mix | Center 0–100 | Attack | Release |
| Auto-Pan | Rate 0–100 | — | Mix | — | — | — |
| Vintage Emulator | Type: MPC3000, MPC60, SP1200, SP1200Ring | — | — | — | — | — |
| Vinyl Emulator | Tone 0–100 | Crackle 0–100% | Pitch 10–100% | — | — | — |
| Tape Emulator | Wow 10–100% | Noise 10–100% | Pitch 20–100% | — | — | — |

**Note on the vintage emulators.** These are bit-depth/sample-rate reduction plus
filtering, modelling 12-bit era converters. Cheap to implement as a worklet and
disproportionately loved — prioritise them above the exotic reverbs.

While Knob FX is engaged, K1–K3 are unavailable for other duties. The display
briefly shows the effect name on engage.

---

## A.12 Compressor

Reached via Shift + Pad 5. A pumping compressor by design, usable for
peak-limiting.

| Control | Parameter | Range |
|---|---|---|
| B1 | Color | on/off — parallel bass boost, slight pitch instability, harmonic saturation ("tape warmth") |
| B3 | Bypass | on/off |
| K1 | Attack | 0.100–150 ms |
| K2 | Release | 3.0–300 ms |
| K3 | Amount | 0.00–100.00% — combines threshold and ratio |
| Shift+K3 | In Boost | drives the input harder |

Makeup gain is calculated automatically from input level and settings. Doing the
same removes a knob the user doesn't want to think about.

---

## A.13 Input Configuration

Shift + SAMPLE.

| Setting | Values |
|---|---|
| Source | Mic, Rear, Rear L, Rear R, Resample, USB, USB L, USB R |
| Monitor | Off, Auto, On |
| Threshold | -96 – 0 dB |
| Rec Length | FREE, SEQ |
| Rec Input Effects | On/Off — whether Knob FX are printed into the recording |

B3 goes back. All except Rec Input Effects are mirrored in Sample Record Mode.

---

## A.14 Fader menu

Shift + Pad 9. Selects what the fader controls.

- B3 turns fader control on/off
- Encoder browses, press selects:
  Pad Volume · Pad Pan · Pad Tune · Pad Amp Attack · Pad Amp Decay/Release ·
  Pad Filter Cutoff · Kit Volume
- B1 back

The fader LED brightness indicates the current parameter value — brightest at
maximum, except for Pan and Tune where it's brightest at centre and dims toward
both extremes. Soft takeover applies: move the fader until the LED starts
responding again.

---

## A.15 Time Correct

Shift + Pad 14. Destructive quantize.

- Pads select which pads to correct (selected pads highlight on screen and light
  up); B2 selects all
- K1 = Q value
- K2 = Shift — nudges all selected events forward/back for a humanised feel
- K3 = Swing — shuffles toward a triplet feel
- B3 = **Do It!** applies to all recorded events on the selected pads
- B1 = Cancel

Q and Swing here are **global** — changing them here also changes them in
Sequence Mode, and Swing affects how Note Repeat behaves. Undo via Shift+(-).

---

## A.16 MIDI Configuration

Shift + Pad 8. Encoder scrolls, press to select, turn to change, press to
confirm.

| Setting | Values |
|---|---|
| MIDI Port | External, USB |
| MIDI In Channel | All, 1–16 |
| MIDI Out Channel | 1–16 |
| Pad MIDI In | Off, On |
| Pad MIDI Out | Never, Always, Empty |
| MIDI Sync In | Off, MIDI Clock, MTC |
| MIDI Sync Out | Off, MIDI Clock, MTC |
| MIDI Thru | Off, On |
| Receive Program Change | Off, Sequence |
| CV/Sync Out | Off, On |
| CV/Sync Base | 1–8 (pulses per quarter note) |
| CV/Sync Division | 1–24 (multiplies the base) |

Plus **Reset Factory Settings** and **Reset Factory Data**, each with a B3 = YES
/ B1 = NO confirmation. Factory Data reset destroys all user content including
the unsaved current project.

Web equivalents: Web MIDI API covers ports, channels, thru and clock. CV/Sync
has no browser analogue — either omit it or repurpose it as an audio-rate click
track on a dedicated output.

---

## A.17 Project menu

Shift + Pad 16. Encoder browses, press selects.

**Load Project** — three categories:
- *Demos* — bundled demo projects including the startup project
- *Kits* — encoder press loads the kit plus four default sequences; B3 (Load Kit)
  loads only the samples with no sequence data
- *User* — user-saved projects

**Save Project** — the shared name-entry screen (§A.4).

**New Project** — B3 confirms and clears; B1 cancels.

**SD Card Access** — mounts external storage to a connected computer; all other
modes are locked while active. Web equivalent: the File System Access API folder
picker, or export/import of a project bundle.

**Background autosave.** Work is continuously saved in the background, so power
cycling restores the last state. Explicit Save copies to a named slot. We should
match this exactly — it's a large part of why the hardware feels trustworthy.
Note the side effect: chopping, extracting or copying long samples takes a moment
because of this system, so show progress feedback on those operations.

---

## Appendix B — Pad shift-function map

Every pad has a printed secondary function. These are the app's keyboard
shortcuts and must all exist.

| Pad | Function |
|---|---|
| 1 | Full Level — all pads play at full velocity |
| 2 | Half Seq — halve the current sequence length |
| 3 | Double Seq — double the length, duplicating events |
| 4 | Count-In — one-bar count before recording |
| 5 | Compressor — open the compressor page |
| 6 | Half Speed — events play at half speed, taking twice the space |
| 7 | Double Speed — events play at double speed, taking half the space |
| 8 | MIDI Config |
| 9 | Fader — assign the fader parameter |
| 10 | Rec Quantize — toggle record quantization |
| 11 | Resample — render the current sequence to a chosen pad |
| 12 | Song — open Song Mode |
| 13 | Trim Sample — destructively trim to start/end points |
| 14 | Time Correct |
| 15 | Warp — toggle Time Stretch / Pitch |
| 16 | Project |

Pad numbering runs bottom-left to top-right: row 1 (bottom) = pads 1–4, top row =
pads 13–16.

---

## Appendix C — Capacity targets

Match these so projects stay conceptually compatible:

| Limit | Value |
|---|---|
| Samples | 16 per bank × 8 banks per project |
| Sequences | 16 per bank × 8 banks per project |
| Projects | unlimited |
| Polyphony | 32 stereo voices |
| Max sample length | 20 minutes |
| Recall buffer | 30 seconds of audio, or the last loop of pad performance |
| Sequencer resolution | 960 PPQN |
| Sequence length | 1–128 bars |
| Slices per sample | 16 |
| Simultaneous Pad FX | 4 |
| Import formats | wav, mp3, aif/aiff, flac, ogg (+ snd, s1s, s3s legacy) |
| Processing | 44.1 kHz, 32-bit float internally |

---

## Appendix D — Screen router

The LCD is 22 distinct screens. Implement as a router with a mode stack, so that
menus opened via Shift+Pad return to whatever was underneath.

```
sample          ├─ trim | mix | ampenv        (B1 cycles)
                ├─ tune | play                (B2 cycles)
                ├─ filter | filtenv           (B3 cycles)
                └─ chop overlay               (replaces trim page)
sequence        step-edit        song
browser         name-entry       sample-record
padfx           flexbeat         knobfx        knobfx-select
compressor      input-config     fader-menu    time-correct
midi-config     project          load-project  sd-access
```

Every screen needs: a title, B1/B2/B3 labels, K1/K2/K3 labels + values + soft-
takeover arrows, and a defined back target. Define these declaratively in one
table rather than scattering them through components — it's the difference
between a maintainable LCD and a mess.

