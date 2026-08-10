export interface GuideTopic {
  id: string;
  title: string;
  body: string;
  tips?: string[];
}

export const GUIDE_TOPICS: Record<string, GuideTopic> = {
  'guide.mode': {
    id: 'guide.mode',
    title: 'Guide mode',
    body: 'While Guide is on, taps show help instead of running the control. Turn Guide off to play normally.',
    tips: ['Hold SHIFT for secondary functions on many buttons.', 'Try BEATS for full songs — LOOPS for one long file to chop.'],
  },
  'mode.sample': {
    id: 'mode.sample',
    title: 'SAMPLE',
    body: 'Opens the sample editor — waveform, trim, tune, filter, and chop for the selected pad.',
    tips: ['Shift+SAMPLE → Input Config (mic/recording).', 'Use UPLOAD or LOOPS to load audio onto the current pad.'],
  },
  'mode.seq': {
    id: 'mode.seq',
    title: 'SEQ',
    body: 'Sequence screen — tempo, swing, length, and transport for the active sequence slot.',
    tips: ['Shift+SEQ → Step Edit (per-step velocity & timing).', 'Tap BEATS to load a ready-made groove first.'],
  },
  'mode.padfx': {
    id: 'mode.padfx',
    title: 'PAD FX',
    body: 'Hold pads to apply beat-synced FX (delay, reverb, etc.). Pressure controls amount.',
    tips: ['Shift → FLEX BEAT for loop/slice FX on the selected pad.'],
  },
  'mode.knobfx': {
    id: 'mode.knobfx',
    title: 'KNOB FX',
    body: 'Master-bus send effects. Route pads via KNOB FX SELECT (Shift+KNOB FX).',
    tips: ['K1–K3 adjust the active effect.', 'Shift+K knobs change secondary params.'],
  },
  'mode.shift': {
    id: 'mode.shift',
    title: 'SHIFT',
    body: 'Hold for secondary labels on panel buttons and pads (blue/orange sub-labels).',
    tips: ['Pad 16+Shift → Project menu.', 'Pad 5+Shift → Compressor.'],
  },
  'mode.padbank': {
    id: 'mode.padbank',
    title: 'PAD BANK',
    body: 'Cycles banks A–H. Each bank has 16 pads and its own sequence slots.',
    tips: ['Full beats use bank A for drums, bank B for melody.'],
  },
  'play.chop': {
    id: 'play.chop',
    title: 'CHOP',
    body: 'Chop mode — pads trigger slices of the selected pad’s sample instead of separate samples.',
    tips: [
      'Load a long loop (LOOPS) → enable CHOP → CHOP SONG on LCD splits to all 16 pads.',
      'Shift → NOTE ON toggles held notes for melodic pads.',
    ],
  },
  'play.mute': {
    id: 'play.mute',
    title: 'MUTE',
    body: 'Tap pads to mute/unmute them in the mix.',
    tips: ['Shift → UNMUTE ALL clears all mutes on this bank.'],
  },
  'play.loop': {
    id: 'play.loop',
    title: 'LOOP',
    body: 'Toggles loop playback for the selected pad’s sample.',
    tips: ['Good for LOOPS library hits 6s+.', 'Shift → REVERSE plays sample backwards.'],
  },
  'play.levels': {
    id: 'play.levels',
    title: '16 LEVELS',
    body: 'All pads control one selected pad — velocity, filter, or tune across 16 levels.',
    tips: ['Shift → TYPE cycles velocity / filter / tune.'],
  },
  'play.sampleselect': {
    id: 'play.sampleselect',
    title: 'SAMPLE SELECT',
    body: 'Opens KITS (one-shot samples). Shift opens BROWSE (your uploaded files).',
    tips: ['For full songs use BEATS on the LCD, not KITS.'],
  },
  'play.taptempo': {
    id: 'play.taptempo',
    title: 'TAP TEMPO',
    body: 'Tap several times to set project BPM.',
    tips: ['Shift → METRO toggles metronome off / on / record-only.'],
  },
  'transport.play': {
    id: 'transport.play',
    title: 'PLAY',
    body: 'Starts the sequencer. Continues from pause unless you hard-stop first.',
    tips: ['BEATS auto-play when loaded.', 'Jam on pads while the sequence runs.'],
  },
  'transport.stop': {
    id: 'transport.stop',
    title: 'STOP',
    body: 'Stops transport. Soft stop keeps position for CONTINUE; use ERASE+… for hard reset patterns.',
    tips: ['Double-tap STOP behavior matches MPC continue.'],
  },
  'transport.record': {
    id: 'transport.record',
    title: 'SEQ RECORD',
    body: 'Toggle sequence recording while playing. Hits land on the active sequence.',
    tips: ['Enable count-in on SEQ screen.', 'Shift+pad 10 → Rec Quantize.'],
  },
  'transport.samplerecord': {
    id: 'transport.samplerecord',
    title: 'SAMPLE RECORD',
    body: 'Record audio from mic or input onto a pad.',
    tips: ['Shift → RECALL loads the last recorded take.', 'Check Input Config (Shift+SAMPLE) first.'],
  },
  'transport.undo': {
    id: 'transport.undo',
    title: 'UNDO',
    body: 'Undo last project change (pads, sequence, etc.).',
    tips: ['Shift label: Sample Record — different function when held.'],
  },
  'transport.redo': {
    id: 'transport.redo',
    title: 'REDO',
    body: 'Redo undone changes.',
    tips: ['Shift label: Seq Record.'],
  },
  'erase': {
    id: 'erase',
    title: 'ERASE',
    body: 'Clears all events in the current sequence slot.',
    tips: ['Shift → COPY duplicates the sequence to the next slot.'],
  },
  'noterepeat': {
    id: 'noterepeat',
    title: 'NOTE REPEAT',
    body: 'Hold a pad to retrigger it in time with the sequencer.',
    tips: ['Shift → TRIPLET uses triplet note repeat.'],
  },
  'fader': {
    id: 'fader',
    title: 'Fader',
    body: 'Controls the parameter shown on its label — volume, pan, tune, envelope, etc.',
    tips: ['Shift+pad 9 → Fader menu to pick parameter.', 'Disabled until you enable it in Fader menu.'],
  },
  'jog': {
    id: 'jog',
    title: 'JOG wheel',
    body: 'Zooms the sample waveform on SAMPLE screen. In Step Edit, scrubs steps.',
    tips: ['Use zoom then tap waveform to place manual chop points.'],
  },
  'knobs': {
    id: 'knobs',
    title: 'K1–K3',
    body: 'Context knobs — change with the screen (sample params, FX, step edit, etc.).',
    tips: ['Check foot sliders on SAMPLE for Trim/Tune/Filter pages.'],
  },
  'pads': {
    id: 'pads',
    title: 'Pad grid',
    body: '16 velocity-sensitive pads. Trigger samples or slices depending on mode.',
    tips: ['Bottom row shows Shift shortcuts when not in chop mode.', 'Green = sequence slot select on SEQ screen.'],
  },
  'lcd.upload': {
    id: 'lcd.upload',
    title: 'UPLOAD',
    body: 'Load a WAV/MP3 from your device onto the selected pad.',
    tips: ['First load asks Auto chop vs Manual.', 'Auto chop splits long files across pads.'],
  },
  'lcd.browse': {
    id: 'lcd.browse',
    title: 'BROWSE',
    body: 'Your saved samples on this device.',
    tips: ['Upload first, then browse to reuse.'],
  },
  'lcd.beats': {
    id: 'lcd.beats',
    title: 'BEATS',
    body: 'Factory song library — full grooves with sequence + kits. Tap one to load and play.',
    tips: ['LONG tab = 16–32 bar songs.', 'SHORT = 4–8 bar loops.'],
  },
  'lcd.kits': {
    id: 'lcd.kits',
    title: 'KITS',
    body: '100 factory one-shot kits — 16 short samples per kit, no sequence.',
    tips: ['Use BEATS for ready-made songs.', 'Melodic kits support loop mode on pads.'],
  },
  'lcd.loops': {
    id: 'lcd.loops',
    title: 'LOOPS',
    body: 'Freesound library — one-shots and longer loops (Loop / Beat / Song tabs).',
    tips: ['6s+ loads enable loop mode.', 'Use CHOP SONG to slice a loop across pads.'],
  },
  'lcd.chop': {
    id: 'lcd.chop',
    title: 'CHOP',
    body: 'Re-run slice detection with the current Chop Type (Trim tab → Chop Type knob).',
    tips: ['Regions 16 works well for full songs.', 'Manual = tap waveform to add slice points.'],
  },
  'lcd.chopsong': {
    id: 'lcd.chopsong',
    title: 'CHOP SONG',
    body: 'Splits the current sample into 16 equal slices — one per pad — ready to play or sequence.',
    tips: ['Best for loops 4–60s from LOOPS.', 'Turn off CHOP mode on panel when done to play separate pads.'],
  },
  'lcd.topads': {
    id: 'lcd.topads',
    title: 'TO PADS',
    body: 'Spreads existing slices to pads 1–16 as separate samples.',
    tips: ['Run CHOP first if you only have one slice.'],
  },
  'lcd.split': {
    id: 'lcd.split',
    title: 'SPLIT / MERGE / EXTRACT',
    body: 'Edit individual slices — split at playhead, merge adjacent, or extract to a new pad.',
    tips: ['Switch Chop Type to Manual when editing slices by hand.'],
  },
};

export function getGuideTopic(id: string): GuideTopic | undefined {
  return GUIDE_TOPICS[id];
}
