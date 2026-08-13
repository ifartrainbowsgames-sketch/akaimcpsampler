# MPC Sample Fidelity Plan

**Goal:** Look and behave like the Akai MPC Sample hardware (reference photo +
owner's manual), with a touchscreen LCD and the signature workflow: **load a
sound → auto-slice → play slices across the 16 pads**.

**Status:** planning — no implementation in this document.

**Related docs:** [BUILD_PLAN.md](../BUILD_PLAN.md) (full manual spec, already in
repo), [panel-mockup.html](./panel-mockup.html) (visual prototype).

---

## 1. Vision (your words, distilled)

| Priority | What you want |
|---|---|
| **Look** | Exactly like the hardware — silver chassis, black deck, coloured buttons, yellow waveform LCD |
| **Feel** | Every control from the manual, behaving like the real MPC |
| **Touch** | LCD works as a touchscreen (trim, scrub, chop on the waveform) |
| **Magic** | Load audio → it automatically makes little samples for the pads |
| **Upload** | A button that fits the hardware look, with a clear label — not a web-style upload widget |

---

## 2. Reference hardware map

From your photo, every visible element maps to a UI region:

```
┌─────────────────────────────────────────────────────────────┐
│  [MAIN VOL]     B1 B2 B3          MPC SAMPLE    [meter][spk]│  ← black deck
│                 ┌─────────────────────────┐                   │
│  [A] ●          │ Trim │ Mix │ Filter    │  ← LCD tabs       │
│                 │ A02 sample-name         │  ← infoline       │
│                 │ ▁▂▃▅▇▅▃▂▁  yellow wave  │  ← touch surface  │
│                 │ Start    End    Loop    │  ← soft keys/K   │
│                 └─────────────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│ MODE          │  K1   K2   K3  │  PAD PLAY                   │
│ SAMPLE SEQ    │                 │  CHOP  MUTE                 │
│ PAD FX KNOB FX│   16 PAD GRID   │  LOOP  16 LEVELS            │
│ SHIFT PAD BANK│                 │  SAMPLE SELECT  TAP TEMPO     │
│ [FADER]       │                 │  [jog]  UNDO REDO  ■ ▶        │
│ ERASE NOTE REP│                 │  SAMPLE REC  SEQ REC         │
└─────────────────────────────────────────────────────────────┘
```

### Visual fidelity checklist

| Element | Reference | Current app | Gap |
|---|---|---|---|
| Chassis | Silver/grey brushed metal, screws, depth shadows | ✅ Close (`panel.css`) | Fine-tune texture, edge bevel |
| Deck | Matte black, gloss sweep | ✅ Yes | Match photo proportions |
| Branding | **AKAI professional** + **MPC SAMPLE** (red) | ❌ "NOVA audio labs" / "SP SAMPLE" | Rebrand or user-provided logo |
| Main volume | Large silver knurled knob top-left | ✅ Knob present | Size/texture vs photo |
| B1/B2/B3 | Small black deck buttons | ✅ Yes | — |
| Bank letter + LED | Green "A" + dot | ✅ Yes | — |
| LCD frame | Recessed black bezel | ✅ Yes | — |
| Waveform | **Yellow** on black, full width | ✅ Yellow peaks | Add L/R meters per manual |
| Pad grid | 4×4 grey squares, RGB underglow on hit | ✅ Grey pads, flash on hit | Stronger RGB glow like hardware |
| Mode buttons | Dark grey rectangles | ✅ Yes | — |
| FX buttons | Orange backlit | ✅ Orange | — |
| Pad Play | Blue backlit (CHOP, MUTE, LOOP, 16 LEVELS) | ✅ Blue | — |
| Fader | White vertical slider + LED | ✅ Yes | — |
| Jog wheel | Large white encoder bottom-right | ⚠️ Knob placeholder | **Missing real jog wheel** |
| Speaker grill | Mesh top-right of deck | ✅ `.speaker` div | Make more visible |
| Shift legends | Red text under each pad | ✅ `.shifted` mode | — |

**Design principle:** Port `docs/panel-mockup.html` styling 1:1 into React — it
was built for this hardware. The live app is ~90% there; closing the last 10%
is mostly branding, jog wheel, LCD meters, and removing web-only chrome
(bottom quick row, hint paragraph).

---

## 3. Feature parity — manual vs today

`BUILD_PLAN.md` Appendix A is the manual transcribed into spec form. Summary:

### ✅ Implemented (engine + UI)

- 16 pads, 8 banks, velocity, QWERTY keys
- Sample import (file picker, drag-drop, LCD tap)
- Sequencer: 960 PPQN, lookahead scheduler, Linn swing, record
- Trim playback region (start/end/loop) via K-row sliders
- Destructive trim (`TRIM SAMPLE` — but see bugs below)
- Chop: threshold, regions 4/8/16, split/merge/extract
- Chop mode: pads trigger slices of **one** sample on the selected pad
- 16 Levels, reverse, loop, note-on, mute groups, poly/mono
- Amp + filter envelopes, filter types, tune, pan, offset
- Knob FX (18), Pad FX (16), compressor page
- Song mode + WAV export, sample record + recall
- Web MIDI, undo/redo, project autosave, PWA

### ⚠️ Partial / hidden / hard to discover

| Feature | Issue |
|---|---|
| **Auto-chop workflow** | Engine works; UX is buried (enable CHOP → auto-runs once). Not the "load break → instant kit" demo moment |
| **Trim** | Non-destructive vs destructive not explained; no drag handles; destructive trim **not saved to OPFS** (bug) |
| **LCD touch** | Upload only; no marker dragging or tap-to-chop |
| **Shift+Pad shortcuts** | Mapped in code; many screens are stubs or minimal |
| **Sample browser** | Spec in A.3; not built |
| **Name entry** | Save sample/project naming UI not built |
| **Step Edit** | Spec in A.7; not built |
| **Flex Beat** | Partial screen; full effect table open |
| **Time stretch (Warp)** | Repitch only; true time-stretch not done |
| **Resample** | Shift+Pad 11; not wired to UI flow |
| **Count-in, Half/Double seq/speed** | Shift functions exist in map; not all implemented |
| **Jog wheel** | No encoder behaviour (scroll menus, zoom waveform) |

### ❌ Not started

- Sample browser / SD-card-style file tree
- Full step edit piano roll
- Flex Beat complete table
- Offline time-stretch warp mode
- Hardware-accurate progress UI for long chop/extract ops

---

## 4. The hero workflow — auto-chop to pads

This is the feature you described: *"takes the sound and starts making little
samples for the buttons automatically."*

### How the real MPC does it

1. Load a sample onto a pad (or record one)
2. Enter **Chop** mode
3. Choose chop type (threshold / 4 / 8 / 16 regions / manual)
4. Slices appear on the waveform; **pads 1–16 play slices 1–16** of that sample
5. Optional: **Extract** turns a slice into its own sample on a new pad

### How the app does it today

- Step 2–3 work if you know to press **CHOP** (blue, Pad Play section)
- Entering chop with a loaded sample **auto-runs** threshold chop once
- Pads trigger slices in chop mode — **same sample, different regions**
- Does **not** automatically copy each slice to 16 separate pads/samples

### Target behaviour (recommended)

**Flow A — Performance chop (like hardware, improve UX)**

```
LOAD sample → LCD shows waveform
→ CHOP lights up (or auto-enter chop after load)
→ slices appear on waveform + pad underglow preview
→ tap any pad to hear its slice
→ K3 cycles Threshold / 4 / 8 / 16 / Manual
```

**Flow B — "Make a kit" (your "amazing" extra)**

```
After chop: [SLICE TO PADS] (LCD soft button or Shift+B1 Extract-all)
→ each slice copied to pads 1–16 as separate samples (non-destructive extract)
→ exit chop mode; full 16-pad kit ready for sequencing
```

**Flow C — One-shot auto on load (optional setting)**

```
Settings: "Auto-chop on load" → Threshold, 16 regions
→ user picks file → immediately chopped + slice-to-pads
→ skip straight to playing
```

**Recommendation:** Ship **Flow A** fixes first, then **Flow B** as the
differentiator. Flow C as a preference toggle.

---

## 5. Touchscreen LCD specification

The LCD is not just a display — it is the main editing surface on tablet.

### 5.1 Layout (match photo + manual A.1)

```
┌─ Tab: Trim | Mix | Filter ─────────────────────┐
│ A02  HipHop-Snr-Rya1              [ LOAD ]     │  ← infoline + hardware button
│ ▌▁▂▃▅▇▅▃▂▁▌  yellow waveform   ▌meter▐       │
│ Start ↑      End ↑       Loop ↑                │  ← draggable handles + labels
│ K1 Start     K2 End      K3 Loop               │  ← sync with handles
└────────────────────────────────────────────────┘
```

### 5.2 Touch gestures

| Gesture | Trim page | Chop page |
|---|---|---|
| Tap waveform | Preview from position | Set manual slice point |
| Drag cyan handle | Move start / end | Move slice boundary |
| Drag green handle | Move loop point | — |
| Pinch (later) | Zoom waveform | Zoom waveform |
| Tap **LOAD** | Open file picker (native label) | Same |

### 5.3 LOAD button (hardware style)

- Small recessed button in the infoline, right side
- Label: **LOAD** when empty, **REPLACE** when loaded
- Sub-label on first use: "Import audio"
- Same file input as **SAMPLE SELECT** — one input, multiple labels
- **Remove** upload-from-whole-waveform tap so the waveform is free for editing

### 5.4 Bugs to fix before new features

1. **Destructive trim must persist** — write trimmed WAV back to OPFS
2. **K-row sliders** — larger thumbs on touch (`min-height: 44px` hit area)
3. **Chop slice edits** — should be undoable (we already have undo stack)

---

## 6. Branding & legal note

The reference unit shows **Akai** / **MPC SAMPLE** trademarks. For a public
deploy you may need your own branding unless you have a license. Options:

- **Option A:** Match the *layout and colours* exactly, use your own name
  (current "NOVA" path)
- **Option B:** User-provided Akai-style assets for personal / licensed use
- **Option C:** Generic "MPC SAMPLE" homage without logo (grey area)

**Visual target stays the same** regardless — silver body, red wordmark area,
black deck, yellow LCD.

---

## 7. Implementation phases

### Phase 0 — Visual lock-in (1 PR)

- [ ] Sync React layout to `panel-mockup.html` pixel-for-pixel
- [ ] Replace web chrome: remove bottom quick row + hint text from main panel
- [ ] Add jog wheel component (visual + scroll/zoom behaviour)
- [ ] LCD: volume/pan meters beside waveform (manual A.1)
- [ ] Stronger pad RGB flash on hit
- [ ] Branding decision applied (Akai vs custom)
- [ ] **LOAD** button in LCD infoline

### Phase 1 — Touch LCD + trim trust (1–2 PRs)

- [ ] Draggable start/end/loop handles on waveform
- [ ] Tap-to-preview sample position
- [ ] Fix destructive trim → OPFS persistence
- [ ] Move **TRIM SAMPLE** to LCD as **APPLY TRIM** with confirm
- [ ] Tablet CSS: larger pads, K-sliders, landscape-first

### Phase 2 — Auto-chop hero flow (1 PR)

- [ ] After LOAD: optional auto-enter chop + run threshold
- [ ] LCD chop type picker (K3): Threshold / 4 / 8 / 16 / Manual
- [ ] Waveform slice markers update live when type changes
- [ ] On-screen guide: "Pads 1–16 = slices 1–16"
- [ ] **SLICE TO PADS** button → extract all slices to pads 1–16

### Phase 3 — Manual completeness (ongoing)

Priority order from BUILD_PLAN gaps:

1. Step Edit UI (A.7)
2. Sample Browser (A.3)
3. Shift+Pad functions: Resample, Count-in, Half/Double seq (Appendix B)
4. Time Correct screen polish (A.15)
5. Flex Beat full table (A.10)
6. True time-stretch Warp (A.2 / §4.6)
7. Name entry screens (A.4)
8. Jog wheel: menu scroll + waveform zoom

### Phase 4 — Platform

- [ ] PWA cache / update banner (already started with `sampler-v2` SW)
- [ ] Capacitor Android APK with same UI
- [ ] Vercel deploy auto from `main`

---

## 8. Architecture (unchanged)

```
React panel (look + touch)  →  commands  →  Engine (TS)  →  Web Audio
         ↑                                        │
         └──────── rAF telemetry poll ────────────┘
```

New LCD touch layer:

- `WaveformSurface.tsx` — pointer events, handle hit-testing
- `Waveform.tsx` — canvas draw only (peaks, markers, playhead)
- Store `updatePad` for start/end/loop; `runChop` for slice changes

---

## 9. Success criteria

You should be able to do this on your tablet without reading a manual:

1. Open the app — it **looks like the photo**
2. Tap **LOAD** on the LCD — pick a drum break
3. Waveform appears; chop slices show automatically
4. Tap pads 1–16 — each plays a different slice
5. Drag **Start/End** on the waveform — playback region updates
6. Hit **▶** — sequence records pad hits
7. Reload the page — samples and trim still there

---

## 10. Decisions needed from you

| # | Question | Options |
|---|---|---|
| 1 | Branding on the deck | Akai (if licensed) / keep NOVA / your own name |
| 2 | After load, auto-chop? | Always / ask once / manual CHOP button only |
| 3 | Slice-to-pads | Separate button, or always automatic after chop |
| 4 | Default chop type | Threshold (breaks) / 16 regions (even slices) |
| 5 | First build priority | Visual lock-in (Phase 0) vs chop workflow (Phase 2) |

---

## 11. What we are NOT doing in v1

- Cloud accounts / sample store
- VST plugins
- Multi-track DAW
- Exact firmware bug-for-bug replication

---

*Next step: confirm Phase 0 + Phase 2 priorities and branding choice, then
implement in order.*
