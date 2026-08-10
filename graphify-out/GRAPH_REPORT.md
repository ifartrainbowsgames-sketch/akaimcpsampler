# Graph Report - .  (2026-08-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 973 nodes · 2035 edges · 61 communities (41 shown, 20 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ba9edd46`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- pianoSongStore.ts
- LCD.tsx
- store.ts
- App.tsx
- synthCore.ts
- scripts
- UIState
- Project
- Engine
- piano.ts
- freesound.ts
- Scheduler
- PianoState
- audio/types.ts
- export.ts
- compilerOptions
- PianoEngine
- useStore
- Waveform.tsx
- MidiScreen
- PianoInstrument.tsx
- PianoEngine.ts
- Panel
- PianoMidiEngine
- KnobFX
- PadFXRack
- voice.ts
- Recorder
- FlexBeat
- Pad
- LCD
- VoiceManager
- BeatRepeatProcessor
- org.junit.Test
- PadFXId
- StepEditScreen
- vercel.json
- MainActivity.java
- flexbeat.ts
- SongScreen
- gradlew
- CompressorScreen
- PianoParameterBar.tsx
- .updateSamplePlayheads
- LoadProjectScreen
- vite-env.d.ts
- capacitor.config.ts

## God Nodes (most connected - your core abstractions)
1. `UIState` - 117 edges
2. `Engine` - 73 edges
3. `useStore` - 38 edges
4. `PianoEngine` - 34 edges
5. `recipeForTemplate()` - 30 edges
6. `Panel()` - 27 edges
7. `env()` - 27 edges
8. `PianoSongState` - 24 edges
9. `PianoState` - 22 edges
10. `usePianoStore` - 20 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `nodeSynthCtx()`  [EXTRACTED]
  scripts/generate-factory-kits-run.ts → src/audio/factory/synthCore.ts
- `main()` --calls--> `synthesizeKit()`  [EXTRACTED]
  scripts/generate-factory-kits-run.ts → src/audio/factory/synthCore.ts
- `App()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/state/store.ts
- `Panel()` --calls--> `guideClick()`  [EXTRACTED]
  src/App.tsx → src/guide/guideClick.ts
- `Panel()` --calls--> `useStore`  [EXTRACTED]
  src/App.tsx → src/state/store.ts

## Import Cycles
- None detected.

## Communities (61 total, 20 thin omitted)

### Community 0 - "pianoSongStore.ts"
Cohesion: 0.07
Nodes (33): factoryKitPadDefaults(), demoHitsToEvents(), ArrangementTimeline(), PatternGrid(), PianoSongLCD(), PianoSongStudio(), exportPianoSongToMpc(), stepMs() (+25 more)

### Community 1 - "LCD.tsx"
Cohesion: 0.06
Nodes (52): BASS_PADS, BASS_TEMPLATES, buildCatalog(), CATEGORY_ORDER, DRUM_PADS, DRUM_TEMPLATES, FACTORY_KIT_COUNT, FACTORY_KITS (+44 more)

### Community 2 - "store.ts"
Cohesion: 0.06
Nodes (35): chopByRegions(), chopByThreshold(), mergeSlice(), nearestZeroCrossing(), rmsEnvelope(), splitSlice(), downloadBlob(), MAX_SLICES (+27 more)

### Community 3 - "App.tsx"
Cohesion: 0.06
Nodes (26): App(), guideClick(), SAMPLE_FILE_INPUT_ID, ChopLoadMode, getChopLoadMode(), setChopLoadMode(), AkaiLogo(), MpcWordmark() (+18 more)

### Community 4 - "synthCore.ts"
Cohesion: 0.16
Nodes (43): __dirname, encodeWav(), main(), outRoot, root, writeManifest(), bass808(), BASS_NOTES (+35 more)

### Community 5 - "scripts"
Cohesion: 0.04
Nodes (45): @capacitor/android, @capacitor/cli, @capacitor/core, dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, react (+37 more)

### Community 7 - "Project"
Cohesion: 0.09
Nodes (23): Project, CHOP_LABELS, CHOP_TYPES, chopPage(), clamp01(), thresholdParam(), clamp01(), FILTER_TYPES (+15 more)

### Community 9 - "piano.ts"
Cohesion: 0.11
Nodes (20): PianoBlackKey(), Props, PianoKeyboard(), PianoWhiteKey(), Props, isBlackKey(), midiToName(), NOTE_NAMES (+12 more)

### Community 10 - "freesound.ts"
Cohesion: 0.16
Nodes (19): LibraryScreen(), checkFreesoundProxy(), fetchFreesoundPreview(), FreesoundHit, FreesoundPreviews, FreesoundSearchResponse, mapHit(), searchDirect() (+11 more)

### Community 12 - "PianoState"
Cohesion: 0.10
Nodes (4): PianoControls(), PianoOverlay(), bindPianoSongRecorder(), PianoState

### Community 13 - "audio/types.ts"
Cohesion: 0.16
Nodes (20): NoteRepeatSlot, quantizeTick(), ticksPerBar(), TransportState, DecayFrom, Envelope, makeEnvelope(), makePad() (+12 more)

### Community 14 - "export.ts"
Cohesion: 0.14
Nodes (18): dbToGain(), encodeWav(), ExportCompressor, ExportKnobFX, ExportOptions, loadOfflineWorklets(), renderToWav(), resampleSequence() (+10 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2022, src, vite/client, compilerOptions, allowImportingTsExtensions, isolatedModules (+14 more)

### Community 16 - "PianoEngine"
Cohesion: 0.15
Nodes (3): PianoEngine, getPreset(), PianoQuality

### Community 17 - "useStore"
Cohesion: 0.08
Nodes (17): getGuideTopic(), GUIDE_TOPICS, GuideMoreBlock, GuideTopic, BrowserScreen(), FaderMenuScreen(), FlexBeatScreen(), InputConfigScreen() (+9 more)

### Community 18 - "Waveform.tsx"
Cohesion: 0.18
Nodes (12): waveformPeaks(), cache, cachedWaveformPeaks(), cacheKey(), Region, Slice, drawWaveform(), Props (+4 more)

### Community 20 - "PianoInstrument.tsx"
Cohesion: 0.26
Nodes (10): pianoMidi, PIANO_PRESETS, MidiSelector(), PianoDisplay(), PianoPresetSelector(), COMPUTER_KEY_MAP, isTypingTarget(), PIANO_SHORTCUTS (+2 more)

### Community 21 - "PianoEngine.ts"
Cohesion: 0.14
Nodes (9): PianoEffects, DisplayCallback, NoteSource, prefetchSamples(), SALAMANDER_BASE, sampleCount(), sampleUrlsForQuality(), STANDARD_SAMPLE_URLS (+1 more)

### Community 24 - "KnobFX"
Cohesion: 0.23
Nodes (5): driveCurve(), KNOB_FX, KnobFX, KnobFXDef, makeImpulse()

### Community 25 - "PadFXRack"
Cohesion: 0.24
Nodes (3): PAD_FX, PadFXRack, Slot

### Community 26 - "voice.ts"
Cohesion: 0.24
Nodes (9): ActiveVoice, FilterType, cutoffHz(), dbToGain(), envTime(), eqGainDb(), filterConfig(), triggerVoice() (+1 more)

### Community 29 - "Pad"
Cohesion: 0.33
Nodes (7): ResolvedPlayback, resolvePlayback(), warpRate(), stretchFactorFromWarp(), timeStretchBuffer(), Pad, TriggerOptions

### Community 33 - "org.junit.Test"
Cohesion: 0.36
Nodes (4): ExampleInstrumentedTest, ExampleUnitTest, org.junit.runner.RunWith, org.junit.Test

### Community 39 - "vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, outputDirectory, rewrites, $schema

### Community 40 - "MainActivity.java"
Cohesion: 0.47
Nodes (4): MainActivity, android.os.Bundle, com.getcapacitor.BridgeActivity, Override

### Community 41 - "flexbeat.ts"
Cohesion: 0.40
Nodes (4): FLEX_BEAT_EFFECTS, FlexBeatEffect, FlexBeatMode, secPerBar()

### Community 43 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

## Knowledge Gaps
- **128 isolated node(s):** `config`, `name`, `private`, `version`, `type` (+123 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Engine` connect `Engine` to `pianoSongStore.ts`, `LCD.tsx`, `store.ts`, `App.tsx`, `Project`, `Scheduler`, `audio/types.ts`, `export.ts`, `PianoInstrument.tsx`, `KnobFX`, `PadFXRack`, `voice.ts`, `Recorder`, `FlexBeat`, `.trigger`, `.stop`, `.init`, `PadFXId`, `.updateSamplePlayheads`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `UIState` connect `UIState` to `store.ts`, `App.tsx`, `PadFXId`, `StepEditScreen`, `Project`, `freesound.ts`, `SongScreen`, `CompressorScreen`, `export.ts`, `LoadProjectScreen`, `useStore`, `MidiScreen`, `Panel`, `Pad`, `LCD`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Why does `PianoEngine` connect `PianoEngine` to `pianoSongStore.ts`, `piano.ts`, `PianoInstrument.tsx`, `PianoEngine.ts`, `PianoMidiEngine`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `recipeForTemplate()` (e.g. with `clap()` and `hat()`) actually correct?**
  _`recipeForTemplate()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config`, `name`, `private` to the rest of the system?**
  _128 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pianoSongStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07355769230769231 - nodes in this community are weakly interconnected._
- **Should `LCD.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05706214689265537 - nodes in this community are weakly interconnected._