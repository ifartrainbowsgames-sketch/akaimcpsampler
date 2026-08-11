# Sampler — 2026 Roadmap

This started as a planning document written before any code changed. §1
(piano unification) has since been implemented — see the status note at
the top of that section. §2 (MPC feature gaps) and the rest of §3's phased
plan remain unimplemented planning.

Two problems triggered this: the piano module's UX has drifted away from
what it's supposed to be, and the MPC side is missing real-hardware features
worth closing the gap on. Both are addressed below, plus a phased plan.

---

## 1. Why the piano feels wrong

> **Status: implemented.** Turned out smaller than this section originally
> scoped — engine plumbing for chromatic pitched playback and the live
> keyboard were already fully working before this pass started, so the
> real work was deletion + repointing one button, not new engine code.
> The PIANO button now opens `PianoRoll.tsx` directly. `src/piano/`
> (Tone.js, Salamander samples, the separate mixer/pattern-grid UI) is
> deleted entirely, along with the `tone` dependency and its CSP
> exception. Snap-to-scale and an empty-pad hint were added to
> `PianoRoll.tsx`. Bundle dropped from 1047 to 85 transformed modules —
> one 383.7KB/117.75KB gzip chunk, no separate piano chunk needed since
> there's nothing left to split out (down from 664KB/189KB before any of
> today's code-splitting or module-removal work). The rest of this
> section is kept as the record of *why*, not a pending plan.

**The complaint:** too many small menus, feels like a bolted-on synth-patch
editor, not the "draw notes, they play like a sample" feel of an FL Studio
piano roll.

**What's actually there today** (`src/piano/components/PianoInstrument.tsx`):
a full-screen overlay with a **PLAY** tab (a 7-slider "MIXER" — velocity,
volume, reverb, tone, release, width, key size — plus octave/transpose/
sustain/preset/MIDI controls) and a **SONG** tab (`PianoSongStudio.tsx`: its
own LCD, its own 16th-note pattern grid, its own arrangement timeline,
export-to-MPC). It's a self-contained instrument with its own everything.

**The actual root cause, found while investigating:** the app already has
exactly the feature being asked for. `src/ui/PianoRoll.tsx` (screen
`pianoroll`, reached via the **PIANO ROLL** button on the SEQ screen) is a
draw-on-a-grid note editor — click-drag to draw, move, resize, and set
velocity, snapped to the sequencer's ticks, full 128-note range — that plays
back through the *same pad, same engine, same sequencer* as everything else.
It was built for the MPC side and it's built the right way: raw Web Audio,
no extra dependency, no separate mixer.

The `src/piano/` module never used it. It was added later (`v0.10.0`, then
extended in `v0.11.0` for song mode) as a fully independent instrument —
Tone.js for synthesis, Salamander Grand Piano samples fetched over the
network, its own Zustand store (`pianoStore.ts` / `pianoSongStore.ts`), its
own pattern grid that duplicates what `PianoRoll.tsx` already does. Two
different systems solve "draw a note, hear a sound" two different ways, and
neither was designed to be the other's replacement.

**This also explains today's earlier bugs.** `BUILD_PLAN.md` §2 is explicit:

> **On Tone.js:** ... Decision: **raw Web Audio for the scheduler, voices,
> and envelopes.** We may pull individual Tone effect implementations as
> reference, but not the runtime.

The piano module runs the Tone.js runtime anyway. That's why it needed a CSP
exception to fetch `tonejs.github.io` samples earlier today (fixed in
`f9e81f1`) — a dependency the rest of the app's architecture explicitly
ruled out is exactly the kind of thing that produces surprise bugs and a UI
that doesn't match the rest of the instrument.

### What success looks like

Right now the doc says what changes but not how we'd know it actually fixed
the "feels like an AI mess" complaint. Bar to hit: **a user can draw an
8-bar melody and hear it play back through a pad in under a minute, without
ever opening a mixer tab.** More specifically:

- Opening the piano and drawing a few notes takes the same number of taps
  as chopping a sample onto pads does today — no tab-switching required to
  go from "nothing" to "hear it back."
- The piano roll used for it is the *same* piano roll used for every other
  pad's sequence — a user who already learned it once doesn't relearn it.
- The 7-slider mixer either disappears or becomes optional/secondary, not
  the thing you land on first.
- **Snap-to-scale, borrowed from FL Studio's actual piano roll** (verified
  against Image-Line's own manual, not recalled from memory): a key/scale
  picker that highlights in-scale notes on the grid and dims out-of-scale
  ones. This is explicitly aimed at composers "unfamiliar with music
  theory" per Image-Line's docs — exactly the "draw notes, they just play
  right" feel being asked for, and it's a small, self-contained addition to
  `PianoRoll.tsx`, not a new subsystem.

### Non-goals

Mirroring `BUILD_PLAN.md` §1's own pattern, so this doesn't quietly grow
into a bigger rebuild than intended:

- **No velocity-layered multi-sampling / per-key sample zones.** A keygroup
  program here means one sample (or a small handful across octaves)
  pitch-shifted per note, the same way real-time pitch-shift already works
  for pads — not a full round-robin/velocity-layer sample engine.
- **No new persistence layer built just for this.** If piano song data ends
  up living anywhere, it's the existing project/sequence autosave path
  (`storage/projects.ts`), not a bespoke piano-only save system.
- **No attempt to keep both note-entry systems long-term.** The point is
  unification — if `PianoRoll.tsx` becomes the one editor, `PianoSongStudio`
  gets removed, not kept around as an alternate mode.
- **Not a rewrite of the pad/sequencer/engine core.** Keygroup playback
  should be additive to `voice.ts`/`chop.ts`, not a reason to restructure
  the audio engine that already works.

### A note on data — no migration needed

Checked whether retiring `PianoSongStudio` would strand existing users'
work: it wouldn't. `pianoSongStore.ts` starts every session from
`createDefaultSong()` with no `localStorage`/IndexedDB/autosave hookup at
all — the piano's SONG tab currently has **no persistence whatsoever**.
Only whatever gets explicitly sent to a pad via `exportToMpc.ts` survives a
reload, because at that point it's a regular MPC sequence and picked up by
the project autosave everything else already gets. So there's no migration
step required for §3's phase 2 — but it's worth its own line in the feature
table below, since "everything autosaves" is an advertised feature of this
app and the piano's own authoring state is the one place that isn't true.

### Proposed direction

Not committing to line-item implementation here — that's a follow-up plan
once this direction is confirmed — but the shape of it:

- Treat "Piano" as an MPC **Keygroup Program**: a chromatic, multi-sample
  instrument assignable to a pad/bank, played and edited through the
  existing pad-trigger + `PianoRoll.tsx` + sequencer path, not a walled-off
  overlay.
- Retire the separate `PianoSongStudio.tsx` pattern grid/arrangement editor
  once notes can be drawn in the one real piano roll — it's redundant with
  it, not complementary.
- Cut the PLAY-tab mixer down to what a keygroup program actually needs
  (velocity response, envelope/release, maybe tone) surfaced through the
  same per-pad parameter pages (`K1–K3`) every other pad already uses,
  instead of a bespoke 7-slider panel.
- Revisit whether Tone.js is still needed once note playback goes through
  the raw engine. If sample playback (pitch-shifted single/multi-sample
  keygroups) can reuse `voice.ts`/`chop.ts` machinery, Tone.js — and the CSP
  surface it requires — may not be needed at all. Beyond the CSP surface,
  dropping the dependency entirely also sheds the current on-demand
  `PianoInstrument` chunk (281KB / 71.5KB gzip today, split out of the main
  bundle earlier this session) — a number worth measuring once it's real,
  not claiming now.

### What ships as the default sound

Today Tone.js + the bundled Salamander Grand Piano samples are the *only*
instrument sound in the app that isn't user-imported — everything else
(pads, kits) requires dragging in or chopping a sample first. Retiring
Tone.js without addressing this turns "Piano" from "sounds like a piano
immediately" into "silent until you load something," which is a real
regression, not just an implementation detail. Two ways to avoid that,
picked during implementation rather than decided here:

- Ship the Keygroup Program with a default sample pulled from the existing
  factory kit library (`src/audio/factory/`) — consistent with how the rest
  of the app already ships sound out of the box, no new asset pipeline.
- Or accept the silent-until-loaded behavior explicitly, and say so in the
  UI (e.g. a "load a sample" prompt) rather than leaving it implicit.

### Rollout safety — this is live in production

`akaimcpsampler.vercel.app` has real deploys and real usage today. This is
not a green-field feature — the existing Tone.js piano keeps working for
users until the new keygroup path is verified end-to-end (build, typecheck,
tests, and a runtime smoke pass through the piano roll actually playing a
drawn melody through a pad), the same verification bar every change landed
this session. Phase 2 in §3 (retiring `PianoSongStudio`/Tone.js) does not
start until phase 1 has been confirmed working, not "ship both and hope."

### Technical grounding (researched, not assumed)

Two open questions worth settling before implementation, checked against
current sources rather than guessed:

- **Should a piano-roll library be adopted instead of extending
  `PianoRoll.tsx`? No.** Several React piano-roll packages exist
  (`react-piano-roll`, `theobourgeois/PianoRoll`, others), but none of them
  know about this app's tick/PPQN/swing/quantize domain model — they'd need
  to be adapted as much as `PianoRoll.tsx` needs extending. A March 2026
  write-up on building one from scratch (Melogen) notes this is common
  practice — "many developers choose to build piano roll editors from
  scratch rather than relying on existing libraries" — precisely because
  the grid math is simple and the domain-specific integration is the hard
  part. This app already has that integration done. Reuse it.
- **Is `playbackRate`-based pitch-shift (what `voice.ts` already does) the
  right call, or should a phase vocoder / PSOLA / granular approach replace
  it?** Checked current sources: there is no Web Audio API standard for
  pitch-preserving playback rate change — `playbackRate` moves pitch and
  duration together, which is the accepted tradeoff for "simple" use, while
  phase vocoder/PSOLA/granular approaches trade complexity for
  pitch-independent stretch. **This matches `BUILD_PLAN.md`'s own already-made
  decision** to stay on raw Web Audio without a heavy DSP dependency — the
  existing `playbackRate` mechanism in `voice.ts` is the right building
  block for keygroup playback, not something to replace. (The
  time-stretch gap in §2 below is a separate, already-scoped problem —
  stretching a *loop* to a target duration — not pitch-shifting a *note*.)

**Sources:**
- [Melogen — building a piano roll from div elements and pointer events (2026)](https://dev.to/adams_watercolorli_4ad3/building-a-piano-roll-editor-from-scratch-in-react-5bl5)
- [GitHub topic: piano-roll](https://github.com/topics/piano-roll?o=desc&s=updated)
- [Tuomas Siipola — Pitch shifting in Web Audio API](https://zpl.fi/pitch-shifting-in-web-audio-api/)
- [Chromium issue tracker — "preserve pitch" on playbackRate change](https://issues.chromium.org/issues/41263293)

## 2. MPC feature gaps vs. real Akai Pro hardware/software

Grounded in two places: what's already documented as open in this repo
(`README.md` "Still open" section), and verified web research against
Akai's own support docs and manuals (Sources at the end of this section) —
not recalled/assumed knowledge, per an explicit ask to check.

| Feature | Real MPC (hardware/software) | This app today | Priority |
|---|---|---|---|
| Time-stretch | Two distinct modes: **Warp** (real-time, small tempo changes, live during playback) and **Time Stretch** (batch/offline, bigger changes, cleaner artifacts) | ✅ Not actually a gap — offline pitch-independent stretch (own WSOLA algorithm, not Rubber Band) has existed since v0.7.0, cached and wired into live playback + export. The README's "still open" line was stale; fixed in §3 | N/A — closed |
| Keygroup Program | Pitches *one sample* across every key/pad — confirmed the simple case matches exactly what §1 proposes. Full parity also allows up to 128 keygroups × 4 velocity layers each (e.g. an 88-key sampled piano) | No keygroup concept at all — piano is a separate bolted-on instrument, MPC pads are single-shot only | High (this is §1) |
| Drum Program velocity layers | Each of a Drum Program's pads can hold up to 4 velocity layers | Single sample per pad, no velocity layering | Low–Medium (separate from Keygroups) |
| Q-Link macro knobs | **16** knobs, assignable to any parameter on the current track/pad/keygroup/insert, with MIDI Learn, adjustable min/max range, and a selectable response curve (linear/log/exponential) | 3 knobs (`K1–K3`), tied to Knob FX only, no Learn, no curve/range shaping | Medium — bigger gap than a rough guess would suggest (16 vs. 3, plus missing Learn/curve) |
| Piano roll scope | One editor works across every track/program | `PianoRoll.tsx` exists but is scoped to a single pad's sequence | Medium (subsumed by §1) |
| Mixer view | Per-track pan/gain/inserts/sends in one screen | Pad params exist per-pad via `K1-K3` pages; no dedicated multi-track mixer screen | Medium |
| Sample tools | Trim, normalize, loop-to-end, reverse | Trim, reverse, loop present; **no normalize** | Low |
| Clip Launch | Confirmed real: introduced in **MPC Software 2.0** (2017) as "Clip Program" mode — 16-pad programs holding short loops, launched Ableton-style, powered by the same real-time Warp engine above | Classic-style song mode (chain sequences by bank+slot) — matches older/hardware MPC, not the newer software clip grid | Low (arguable non-goal) |
| VST/plugin hosting | Expansion packs, AU/VST instruments | Explicit non-goal in `BUILD_PLAN.md` §1 | N/A — intentionally out of scope |
| Autosave | Every edit persists automatically | True everywhere except the piano's SONG tab, which has **no persistence at all** — closing the overlay loses unexported work | Medium (see §1) |

**Sources:**
- [Akai Pro — Understanding and Loading Programs](https://support.akaipro.com/en/support/solutions/articles/69000804211-akai-pro-mpc-series-understanding-and-loading-programs) — Drum vs. Keygroup Program definitions, 4-layer/pad, up to 128 keygroups × 4 velocity layers
- [Akai MPC X User Manual — Q-Link Knobs](https://www.manualslib.com/manual/1452667/Akai-Mpc-X.html?page=288) — 16 Q-Link knobs, Learn, range, response curve
- [MPC-Tutor — Official MPC Software 2.0 specs](https://www.mpc-tutor.com/official-mpc-software-2-0-specs-features-screenshots/) — Clip Program mode, real-time Warp engine
- [Akai Pro — How To Change The Speed Of A Sample](https://support.akaipro.com/en/support/solutions/articles/69000864246-mpc-standalone-how-to-change-the-speed-of-a-sample) — Warp vs. Time Stretch distinction
- [Image-Line — FL Studio Piano Roll manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll.htm) — Draw/Paint tools, Snap to Scale (cited in §1)

## 3. Phased plan

1. ✅ **Unify the note-drawing story** — done. Turned out not to need the
   `voice.ts`/`chop.ts` extension originally planned here (step 2 below)
   — chromatic playback was already fully wired, so this collapsed into
   deleting the redundant Tone.js module and repointing PIANO at the
   existing `PianoRoll.tsx`, plus adding snap-to-scale and an empty-pad
   hint. See the status note in §1 for the real numbers.
   ~~1. Confirm the direction in §1 and the default-sound decision above.~~
   ~~2. Extend `voice.ts`/`chop.ts` so a pad can be assigned a keygroup-style~~
   ~~sample without touching the scheduler/engine core~~ — turned out
   unnecessary; the engine already supported this.
   ~~3. Confirm `PianoRoll.tsx` already handles this correctly~~ — confirmed,
   see §1.
   ~~4. Add snap-to-scale to `PianoRoll.tsx`.~~ — done.
   ~~5. Verify: typecheck, tests, build, and a runtime smoke pass~~ — done,
   all green.
2. ✅ **Retire the redundant piano UI.** Folded into phase 1 above: since
   repurposing the PIANO button made `src/piano/` immediately unreachable,
   the cleanest move was deleting it in the same pass rather than leaving
   dead code — done, see §1.
3. ✅ **Close the time-stretch gap — turned out already closed.** Checked
   before implementing anything: `src/audio/stretch.ts` has had a full
   offline WSOLA (not Rubber Band, but pitch-independent and artifact-aware)
   time-stretch since **v0.7.0**, wired into both live playback
   (`engine.trigger()`/`triggerWithNote()`) and offline export via
   `resolvePlayback()` in `playback.ts` — cached exactly per
   `BUILD_PLAN.md` §4.6's spec (render once, cache, replay). The mode
   toggle (Shift+Pad 15) and amount fader (K3 "Warp" page) are both live
   in the UI. Verified at runtime, not just read: setting
   `warpMode: 'stretch'` and triggering a pad grew the engine's stretch
   cache from 0 to 1 entries, proving the real algorithm ran. §2's table
   entry and the README's old "Still open" line were both stale — fixed.
   No code changed for this phase, only docs.
4. ✅ **Q-Link parity — free K1-K3 assignment shipped, automation deferred.**
   Real MPC has 16 Q-Link knobs; this app's chassis only has 3, so scaled
   the *concept* (free reassignment) onto the existing 3 rather than adding
   more physical controls (confirmed via AskUserQuestion). Tapping a
   K-knob's label opens a picker over all 27 existing per-pad `KParam`s
   (`src/lcd/pages.ts`'s 9 pages), reusing their get/set/display logic
   verbatim — no duplicated parameter code. An assignment sticks across
   every screen change, which is the actual point of Q-Link (verified at
   runtime: assigned Filter Cutoff to K1, confirmed it survived a screen
   switch to BEATS). Also extended the existing external-MIDI-CC-Learn
   system with K1/K2/K3 Knob targets — CC-learn only acts once that knob
   has an explicit Q-Link assignment (not whatever's screen-driven at the
   time), which is safer and matches how hardware Q-Link learn actually
   works. Automation recording (capturing knob moves into the sequencer)
   was explicitly deferred per the AskUserQuestion decision earlier —
   separate, substantial feature, not silently dropped.
5. ✅ **Sample tool completeness — Normalize + Loop To End shipped.** Both
   turned out to be genuinely small, confirmed by exploration before
   implementing: neither needed a destructive buffer rewrite (unlike Trim).
   Normalize scans the current trim region's peak and sets `pad.gain` —
   the exact same field the Mix tab's Volume knob already uses — to hit a
   -0.1dB target; it's "auto-compute Volume," not a new audio path. Loop
   To End resets `pad.end` back to the sample's true full length (`Pad`
   has no separate `loopEnd` field — a loop always plays out to `end` —
   so this is the correct, verified reading of the classic MPC1000/2500
   feature, not the initially-guessed "reset loopStart" interpretation).
   Both buttons sit next to APPLY TRIM, with new Guide topics. Verified at
   runtime: on a pad trimmed to half length, Normalize computed +2.65dB
   to reach target peak, Loop To End correctly reset end from 220500 to
   the full 441000 frames. Zero console errors, typecheck/test/build clean.

Q-Link's deferred automation-recording piece is the only item left
unscheduled — everything else on this roadmap is now shipped.
