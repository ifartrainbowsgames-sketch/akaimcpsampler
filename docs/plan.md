# Tablet & LCD Touch Plan

A focused roadmap for making the sampler work well on tablet — especially
uploading samples, using the LCD as a touchscreen, and fixing trim so it
actually feels right.

**Status:** planning only — no implementation yet.

---

## 1. What you asked for

| Request | Intent |
|---|---|
| Extra button to upload music | A clear, obvious control — not hidden behind tapping the waveform |
| LCD as a touchscreen | Drag trim markers, scrub, maybe chop — direct manipulation on the waveform |
| Trim feels broken | Set start/end and expect the sample to change; currently confusing |
| Other improvements | Tablet UX, discoverability, reliability |

---

## 2. Current state (as of today)

### Upload

- **SAMPLE SELECT** panel button opens the file picker (label → hidden input).
- **LCD waveform** is also a label tap target; empty pads show **TAP TO LOAD AUDIO**.
- **Drag-and-drop** onto a pad still works on desktop; unreliable on many tablets.
- Loaded files go to **OPFS** and attach to the **selected pad**.

### Trim — two different things (this is the confusion)

| Mode | What it does | How you control it today |
|---|---|---|
| **Playback region** (non-destructive) | Only plays between Start and End; audio file unchanged | B1 → Trim page → K1/K2/K3 sliders under the LCD |
| **Destructive trim** | Permanently crops the audio file | Small **TRIM SAMPLE** button in the bottom quick row |

The waveform **shows** start/end/loop markers but you **cannot drag them** — only the K-row sliders move them. On a tablet those sliders are small and easy to miss.

### Known trim bug

Destructive trim (`trimSelected` → `engine.trimSample`) updates the in-memory
buffer but **does not write back to OPFS**. After a reload, the full original
file returns. This likely explains “trim doesn’t work.”

### LCD touch today

- Waveform area: file upload only (whole region is one tap target).
- K-row: three range sliders (Trim/Mix/etc. depending on B-group page).
- No pinch-zoom, no scrub, no draggable handles, no slice editing on the waveform.

---

## 3. Goals

1. **Upload is obvious** — one dedicated button, always visible on tablet.
2. **LCD is a real touch surface** — waveform interactions for trim and preview.
3. **Trim is trustworthy** — playback region and destructive trim are clearly labeled; destructive trim persists.
4. **Tablet-first** — large hit targets, no hover-only UI, works in portrait and landscape.

---

## 4. Proposed changes

### Phase A — Quick wins (upload + trim clarity)

**A1. Dedicated LOAD button on the LCD**

Add a visible button in the LCD chrome (not the waveform itself), e.g.:

```
┌─────────────────────────────────────┐
│ Trim │ Mix │ Amp Env                │  ← tabs
│ A01  my-kick.wav          [ LOAD ]  │  ← infoline + button
│ ┌───────────────────────────────┐   │
│ │      waveform                 │   │
│ └───────────────────────────────┘   │
│  Start    End      Loop             │  ← K-row
└─────────────────────────────────────┘
```

- **LOAD** uses the same hidden file input as SAMPLE SELECT.
- Stays visible whether the pad is empty or loaded (label: `LOAD` / `REPLACE`).
- Remove upload from the waveform tap target so the LCD can be used for editing.

**A2. Fix destructive trim persistence**

After `engine.trimSample()`:

1. Encode trimmed buffer → WAV (or reuse existing `bufferToWav`).
2. `writeSample(sampleId, arrayBuffer)` to OPFS.
3. Reset pad `start: 0`, `end: newLength`, `loopStart: 0`, clear slices.
4. Show brief LCD feedback: `TRIMMED` or flash the waveform.

**A3. Clarify trim in the UI**

- On the Trim page, show a hint line: `Drag handles · K1/K2/K3 fine-tune`.
- Move **TRIM SAMPLE** from the bottom quick row into the LCD (button next to LOAD):
  - **APPLY TRIM** — destructive, with a confirm tap on second press.
- Different colours: playback markers = cyan/green (current); destructive action = amber/red.

**A4. Verify trim playback region**

Audit that `voice.ts` uses `pad.start` / `pad.end` correctly for one-shot and loop modes. Add a manual test checklist (see §7).

---

### Phase B — LCD touchscreen (waveform interaction)

Replace the canvas-only waveform with a touch-aware layer.

**B1. Draggable trim handles**

On the Trim page (when Chop is off):

| Handle | Colour | Behaviour |
|---|---|---|
| Start | Cyan | Drag horizontally; snap optional (see B4) |
| End | Cyan | Drag; cannot cross start |
| Loop | Green | Drag; clamped between start and end |

- Minimum touch target: **44×44 px** (Apple HIG) — use invisible hit areas wider than the 1px line drawn on canvas.
- While dragging: show frame number or time (`0.42s`) near the finger.
- K-row sliders stay in sync (bidirectional).

**B2. Scrub / preview on tap**

- Tap anywhere on the waveform (not on a handle) → preview from that position.
- Optional: hold to audition (gate with note-on behaviour later).
- Requires a short preview API on the engine (`previewPad(padIndex, normalizedPosition)`).

**B3. Chop mode on the waveform**

When Chop is active:

- Tap waveform to set manual slice points (per BUILD_PLAN A.2).
- Drag slice boundaries (reuse handle code, orange markers).
- Selected slice highlighted.

**B4. Zoom (stretch goal)**

- Pinch or two-finger drag to zoom into a region of the waveform.
- Shift+K1/K2/K3 zoom params from the spec — map to pinch on tablet later.
- Start without zoom; add only if trim handles feel too coarse on long files.

---

### Phase C — Tablet layout & polish

**C1. Responsive panel layout**

- On narrow screens (`max-width: 900px`): stack deck above pads, enlarge LCD.
- Hide or collapse desktop-only quick row (FULL LEVEL, TRIM SAMPLE, EXPORT) into LCD menus.
- Increase pad size and K-slider thumb height.

**C2. Pad selection feedback**

- Selected pad ring more visible on touch devices.
- LCD infoline always shows which pad receives LOAD / trim edits.

**C3. PWA / cache hygiene**

- Already bumped service worker to `sampler-v2` with network-first assets.
- Add `?v=` or build hash in SW install message so users know when an update landed.
- Optional: “New version available — reload” banner.

**C4. Boot screen**

- After Start: one-line tip — `Select a pad, tap LOAD, then trim on the LCD`.

---

### Phase D — Nice-to-have (after core touch UX)

| Item | Why |
|---|---|
| Sample browser screen (BUILD_PLAN A.3) | Pick from loaded OPFS samples instead of only file picker |
| Undo for slice edits | Spec says hardware doesn’t; we can do better |
| Haptic feedback on pad hit | `navigator.vibrate(10)` on supported tablets |
| Portrait lock suggestion | Landscape fits the MPC layout better |
| Step Edit UI | Still open per README |
| Time-stretch warp mode | Still repitch-only today |

---

## 5. Architecture notes

Keep the existing rule: **UI commands → engine; engine telemetry → rAF poll.**

New LCD touch code should:

```
WaveformTouch (React)
  ├─ pointer events → update pad.start/end/loopStart via store.updatePad
  ├─ on trim handle release → optional debounced preview
  └─ canvas still draws peaks/markers (read-only render from props)

Engine
  └─ previewAt(padIndex, frame) — short one-shot voice, no transport
```

Do **not** put trim frame math inside the canvas draw loop.

File input stays **one** hidden `<input id="sample-file-input">` in `App.tsx`;
LOAD button, SAMPLE SELECT, and any future browser screen all use `htmlFor`
(labels) — proven to work on iOS/Android.

---

## 6. Implementation order

| Step | Task | Effort | User-visible |
|---|---|---|---|
| 1 | LCD **LOAD** button; decouple upload from waveform | Small | Immediate |
| 2 | Fix trim → OPFS persistence + LCD feedback | Small | Fixes “trim broken” |
| 3 | Draggable start/end/loop handles on Trim page | Medium | LCD feels like a touchscreen |
| 4 | Tap-to-preview on waveform | Medium | Faster workflow |
| 5 | Move APPLY TRIM + confirm into LCD | Small | Clear destructive action |
| 6 | Tablet responsive CSS pass | Medium | Better on your device |
| 7 | Chop waveform taps / slice drag | Medium | Full chop on touch |
| 8 | Sample browser | Large | Reuse loaded samples |

**Recommend starting with steps 1–3** — they address everything in your message with the smallest coherent slice.

---

## 7. Manual test checklist (trim)

After implementation, verify on a real tablet:

- [ ] Load a WAV via **LOAD** → waveform appears, pad shows name
- [ ] Drag **Start** handle → playback begins later; marker moves
- [ ] Drag **End** handle → playback stops earlier
- [ ] K1/K2 sliders move handles and vice versa
- [ ] **APPLY TRIM** → waveform shortens; file size in OPFS shrinks
- [ ] Reload page → trimmed audio still trimmed
- [ ] Loop marker stays between start and end
- [ ] Chop mode: slice markers appear; pad triggers slice region

---

## 8. Open questions (for you)

1. **LOAD button placement** — infoline right side (mockup above), or a row of LCD soft buttons below the waveform?
2. **Destructive trim** — one tap, or tap twice to confirm?
3. **Waveform tap when empty** — should it still open the file picker, or only the LOAD button?
4. **Priority** — trim handles first, or LOAD button + persistence fix first?

---

## 9. Out of scope for this plan

- Vercel/deploy changes (already working)
- Android APK build
- New audio effects or sequencer features
- Cloud sync / accounts

---

*Next step: confirm Phase A + B1 priorities, then implement in a single PR series.*
