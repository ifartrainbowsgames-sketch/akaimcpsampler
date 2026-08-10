export interface GuideMoreBlock {
  heading: string;
  lines: string[];
}

export interface GuideTopic {
  id: string;
  title: string;
  /** One-line hook shown in the compact pop-up. */
  brief: string;
  /** Full explanation — shown after tapping MORE. */
  body?: string;
  tips?: string[];
  /** Extra sections for deep topics (chopping, etc.). */
  more?: GuideMoreBlock[];
}

export const GUIDE_TOPICS: Record<string, GuideTopic> = {
  'guide.mode': {
    id: 'guide.mode',
    title: 'GUIDE MODE',
    brief: 'Taps show tips instead of firing controls.',
    body: 'While Guide is on, every button, knob, and pad explains itself. Turn Guide off when you are ready to play for real.',
    tips: ['Hold SHIFT for alt functions.', 'BEATS = songs · LOOPS = chop material.'],
  },
  'mode.sample': {
    id: 'mode.sample',
    title: 'SAMPLE',
    brief: 'Waveform editor for the selected pad.',
    body: 'Trim, tune, filter, and chop the active pad. Upload files or pick from LOOPS/KITS here.',
    tips: ['Shift+SAMPLE → Input Config.', 'UPLOAD or LOOPS to load audio.'],
  },
  'mode.seq': {
    id: 'mode.seq',
    title: 'SEQ',
    brief: 'Sequencer — tempo, swing, and transport.',
    body: 'Edit the active sequence slot. Green pads on this screen pick which sequence you are editing.',
    tips: ['Shift+SEQ → Step Edit.', 'Try BEATS for a ready groove.'],
  },
  'mode.padfx': {
    id: 'mode.padfx',
    title: 'PAD FX',
    brief: 'Hold pads for beat-synced FX.',
    body: 'Delay, reverb, and more — pressure sets how wet the effect gets.',
    tips: ['Shift → FLEX BEAT for slice/loop FX.'],
  },
  'mode.knobfx': {
    id: 'mode.knobfx',
    title: 'KNOB FX',
    brief: 'Master send effects on K1–K3.',
    body: 'Route individual pads via KNOB FX SELECT (Shift+KNOB FX).',
    tips: ['K1–K3 tweak the active effect.', 'Shift+K = secondary params.'],
  },
  'mode.shift': {
    id: 'mode.shift',
    title: 'SHIFT',
    brief: 'Hold for the blue/orange sub-labels.',
    body: 'Most panel buttons and bottom-row pads have a second job while Shift is held.',
    tips: ['Pad 16+Shift → Project menu.', 'Pad 5+Shift → Compressor.'],
  },
  'mode.padbank': {
    id: 'mode.padbank',
    title: 'PAD BANK',
    brief: 'Cycles banks A–H (16 pads each).',
    body: 'Each bank has its own pads and sequence slots. Full factory beats often use A for drums, B for melody.',
    tips: ['Tap to step through banks.'],
  },
  'play.chop': {
    id: 'play.chop',
    title: 'CHOP',
    brief: 'Pads play slices of one sample.',
    body: 'Instead of 16 separate files, all pads trigger regions of the selected pad’s audio. Great for finger-drumming a loop before you commit slices to pads.',
    tips: ['LOOPS → load long file → CHOP SONG on LCD.', 'Shift → NOTE ON for held notes.'],
    more: [
      {
        heading: 'CHOP A SONG — FAST',
        lines: [
          '1. LOOPS → pick a loop (Beat / Song tab).',
          '2. Choose Auto chop on first load (saved forever).',
          '3. Pads fill with 16 slices — play immediately.',
        ],
      },
      {
        heading: 'CHOP A SONG — MANUAL',
        lines: [
          '1. Load sample → tap CHOP SONG on LCD.',
          '2. Or: enable CHOP here → CHOP on LCD → TO PADS.',
          '3. Turn CHOP off when done — each pad is its own sample.',
        ],
      },
      {
        heading: 'FINE TUNE',
        lines: [
          'Trim tab → Chop Type knob: 4 / 8 / 16 regions or Manual.',
          'Manual: zoom with JOG, tap waveform to add slice points.',
          'SPLIT / MERGE / EXTRACT edit individual slices.',
        ],
      },
    ],
  },
  'play.mute': {
    id: 'play.mute',
    title: 'MUTE',
    brief: 'Tap pads to mute/unmute in the mix.',
    tips: ['Shift → UNMUTE ALL on this bank.'],
  },
  'play.loop': {
    id: 'play.loop',
    title: 'LOOP',
    brief: 'Loop the selected pad’s sample.',
    body: 'Long LOOPS library hits (6s+) auto-enable loop on load.',
    tips: ['Shift → REVERSE plays backwards.'],
  },
  'play.levels': {
    id: 'play.levels',
    title: '16 LEVELS',
    brief: 'All pads control one pad at 16 levels.',
    body: 'Velocity, filter, or tune depending on TYPE.',
    tips: ['Shift → TYPE cycles mode.'],
  },
  'play.sampleselect': {
    id: 'play.sampleselect',
    title: 'SAMPLE SELECT',
    brief: 'Opens KITS (one-shots).',
    body: 'Shift opens BROWSE for your uploaded files. For full songs use BEATS on the LCD.',
    tips: ['KITS ≠ songs — use BEATS for grooves.'],
  },
  'play.taptempo': {
    id: 'play.taptempo',
    title: 'TAP TEMPO',
    brief: 'Tap a few times to set BPM.',
    tips: ['Shift → METRO toggles click.'],
  },
  'transport.play': {
    id: 'transport.play',
    title: 'PLAY',
    brief: 'Starts the sequencer.',
    body: 'Continues from pause unless you hard-stop first. BEATS auto-play when loaded.',
    tips: ['Jam pads while the seq runs.'],
  },
  'transport.stop': {
    id: 'transport.stop',
    title: 'STOP',
    brief: 'Stops transport — soft stop keeps position.',
    tips: ['Shift+STOP for hard reset.'],
  },
  'transport.record': {
    id: 'transport.record',
    title: 'SEQ RECORD',
    brief: 'Record pad hits into the sequence.',
    tips: ['Count-in on SEQ screen.', 'Shift+pad 10 → Rec Quantize.'],
  },
  'transport.samplerecord': {
    id: 'transport.samplerecord',
    title: 'SAMPLE RECORD',
    brief: 'Record mic/input onto a pad.',
    tips: ['Shift → RECALL last take.', 'Shift+SAMPLE → Input Config.'],
  },
  'transport.undo': {
    id: 'transport.undo',
    title: 'UNDO',
    brief: 'Undo last project change.',
    tips: ['− button on panel (not Shift in Step Edit).'],
  },
  'transport.redo': {
    id: 'transport.redo',
    title: 'REDO',
    brief: 'Redo what you undid.',
    tips: ['+ button on panel.'],
  },
  'erase': {
    id: 'erase',
    title: 'ERASE',
    brief: 'Clears the current sequence slot.',
    tips: ['Shift → COPY to next slot.'],
  },
  'noterepeat': {
    id: 'noterepeat',
    title: 'NOTE REPEAT',
    brief: 'Hold a pad to retrigger in time.',
    tips: ['Shift → TRIPLET timing.'],
  },
  'fader': {
    id: 'fader',
    title: 'FADER',
    brief: 'Controls the labeled parameter.',
    body: 'Volume, pan, tune, envelope, or kit level — pick in Fader menu (Shift+pad 9).',
    tips: ['Enable in Fader menu first.'],
  },
  'jog': {
    id: 'jog',
    title: 'JOG',
    brief: 'Zoom waveform on SAMPLE screen.',
    body: 'In Step Edit, scrubs through steps instead.',
    tips: ['Zoom in → tap waveform for manual chops.'],
  },
  'knobs': {
    id: 'knobs',
    title: 'K1–K3',
    brief: 'Context knobs — change per screen.',
    body: 'Sample params on SAMPLE, FX on FX screens, step values in Step Edit.',
    tips: ['Foot sliders: Trim / Tune / Filter tabs.'],
  },
  'pads': {
    id: 'pads',
    title: 'PAD GRID',
    brief: '16 velocity-sensitive triggers.',
    body: 'Play samples, slices, or sequence slots depending on mode.',
    tips: ['Bottom row = Shift shortcuts.', 'Green = seq slot on SEQ screen.'],
  },
  'lcd.upload': {
    id: 'lcd.upload',
    title: 'UPLOAD',
    brief: 'Load WAV/MP3 from your device.',
    body: 'First load asks Auto chop vs Manual. Auto splits long files across 16 pads.',
    tips: ['2s+ files can auto CHOP SONG.'],
  },
  'lcd.browse': {
    id: 'lcd.browse',
    title: 'BROWSE',
    brief: 'Samples saved on this device.',
    tips: ['Upload first, then reuse here.'],
  },
  'lcd.beats': {
    id: 'lcd.beats',
    title: 'BEATS',
    brief: 'Factory songs — seq + kits, ready to play.',
    body: 'Full grooves with drums and melody programmed in. Tap to load and hit PLAY.',
    tips: ['LONG tab = 16–32 bar songs.', 'SHORT = 4–8 bar loops.'],
  },
  'lcd.kits': {
    id: 'lcd.kits',
    title: 'KITS',
    brief: '100 one-shot kits — 16 hits each.',
    body: 'No sequence included. Use BEATS if you want a finished song.',
    tips: ['Melodic kits support loop mode.'],
  },
  'lcd.loops': {
    id: 'lcd.loops',
    title: 'LOOPS',
    brief: 'Freesound — one-shots and long loops.',
    body: 'Loop / Beat / Song tabs filter by length. 6s+ loads enable loop playback.',
    tips: ['CHOP SONG slices loops to pads.'],
    more: [
      {
        heading: 'PICK A LOOP',
        lines: ['Song tab → full-length material.', 'Beat tab → 4–16 bar loops.', 'Loop tab → shorter phrases.'],
      },
      {
        heading: 'THEN CHOP',
        lines: ['Auto chop on first load = instant 16 pads.', 'Or tap CHOP SONG on the LCD after load.'],
      },
    ],
  },
  'lcd.chop': {
    id: 'lcd.chop',
    title: 'CHOP',
    brief: 'Re-run slice detection.',
    body: 'Uses Chop Type from the Trim tab knob — threshold, 4/8/16 regions, or Manual.',
    tips: ['Regions 16 for full songs.', 'Manual = tap waveform points.'],
  },
  'lcd.chopsong': {
    id: 'lcd.chopsong',
    title: 'CHOP SONG',
    brief: 'Split sample → 16 pads, one slice each.',
    body: 'Turns one long file into a playable kit. Chop type scales with length (4 / 8 / 16 regions). Loop mode turns off so each pad is a one-shot.',
    tips: ['Best for 4–60s loops from LOOPS.', 'Turn panel CHOP off when done.'],
    more: [
      {
        heading: 'WORKFLOW',
        lines: [
          'LOOPS → load → CHOP SONG (or Auto chop on first load).',
          'Play pads — each hit is the next slice.',
          'Record into SEQ for a flipped arrangement.',
        ],
      },
      {
        heading: 'AFTER CHOPPING',
        lines: [
          'TO PADS makes each slice a separate sample file.',
          'SPLIT / MERGE / EXTRACT tweak slices before committing.',
          'K1 Chop Type knob changes slice count — tap CHOP again.',
        ],
      },
    ],
  },
  'lcd.topads': {
    id: 'lcd.topads',
    title: 'TO PADS',
    brief: 'Spread slices to pads 1–16.',
    body: 'Each slice becomes its own sample on a pad. CHOP mode turns off automatically.',
    tips: ['Run CHOP first if you only have one slice.'],
  },
  'lcd.split': {
    id: 'lcd.split',
    title: 'SLICE EDIT',
    brief: 'SPLIT · MERGE · EXTRACT slices.',
    body: 'Split at playhead, merge neighbors, or pull a slice onto a free pad.',
    tips: ['Switch to Manual chop type for hand edits.'],
    more: [
      {
        heading: 'SPLIT',
        lines: ['Places a new slice boundary at the playhead.'],
      },
      {
        heading: 'MERGE',
        lines: ['Combines the selected slice with the next one.'],
      },
      {
        heading: 'EXTRACT',
        lines: ['Copies the slice to the next empty pad as a new sample.'],
      },
    ],
  },
};

export function getGuideTopic(id: string): GuideTopic | undefined {
  return GUIDE_TOPICS[id];
}
