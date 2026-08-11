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

  /* ───────── GUIDE ITSELF ───────── */
  'guide.mode': {
    id: 'guide.mode',
    title: 'GUIDE MODE',
    brief: 'Shows tips alongside every button you press.',
    body: 'Guide mode is now non-blocking — press any button and it still works. The tip panel pops up at the same time so you can read and play simultaneously. Tap OK or tap anywhere outside the panel to dismiss.',
    tips: ['Tap GUIDE again to turn off tips.', 'Tips come from the Akai MPC manual.'],
  },

  /* ───────── MODE BUTTONS ───────── */
  'mode.sample': {
    id: 'mode.sample',
    title: 'SAMPLE',
    brief: 'Waveform editor — trim, tune, filter, chop.',
    body: 'The SAMPLE screen is the main sound-design view. Select a pad, then use this screen to edit everything about that pad\'s sound: where the sample starts and ends, pitch, filter, envelopes, slices, and more.',
    tips: ['Shift+SAMPLE → Input Config (mic/line routing).', 'Tabs Trim / Tune / Filter control what the foot-sliders do.'],
    more: [
      {
        heading: 'TRIM TAB',
        lines: [
          'Set Start / End points to cut silence or isolate a hit.',
          'Chop Type knob: Threshold, Regions 4/8/16, or Manual.',
          'Tap waveform in Manual mode to drop a slice point.',
          'APPLY TRIM permanently crops the sample.',
        ],
      },
      {
        heading: 'TUNE TAB',
        lines: [
          'Semi: pitch in semitones (−24 to +24).',
          'Fine: pitch in cents (−90 to +90).',
          'Warp Mode: Pitch shifts without changing length. Stretch changes length to fit bars.',
          'Warp Amount: Off / 50–200% / Seq (lock to sequence length).',
        ],
      },
      {
        heading: 'FILTER TAB',
        lines: [
          'Filter Type: Off, Classic (Akai ladder), LPF 2/4, HPF 2/4, BPF 2/4.',
          'Cutoff and Resonance set the filter character.',
          'Filter Env adds a time-varying sweep — set Amount for depth.',
          'EQ: 3-band graphic (Low / Mid / High, ±12 dB).',
        ],
      },
    ],
  },

  'mode.seq': {
    id: 'mode.seq',
    title: 'SEQ',
    brief: 'Sequencer — tempo, swing, humanize, transport.',
    body: 'The SEQ screen manages the active sequence slot. Change BPM, swing, humanize, and count-in here. Tap a pad while on this screen to select which sequence slot (1–16) you are editing. During playback, tapping a pad queues the next slot — it switches cleanly at the loop end.',
    tips: ['Shift+SEQ → Step Edit grid.', 'PIANO ROLL button → draw melodic notes.', 'Humanize adds life to programmed patterns.'],
    more: [
      {
        heading: 'SWING',
        lines: [
          '50% = straight 16th notes.',
          '66.7% = full triplet swing (classic hip-hop feel).',
          'Values in between give subtle groove.',
          'The MPC hardware uses Linn swing — even 16ths push slightly late.',
        ],
      },
      {
        heading: 'HUMANIZE',
        lines: [
          'Timing: randomly shifts each note a few ticks early or late.',
          'Velocity: randomly nudges each note\'s velocity up or down.',
          'Set both to 10–20% for a natural live-played feel.',
          'Higher values create a loose, drunk drummer effect.',
        ],
      },
      {
        heading: 'SEQUENCE SLOTS',
        lines: [
          'Each bank has 16 sequence slots (pads 1–16 on SEQ screen).',
          'Slots share the same kit but have independent patterns.',
          'Build verse/chorus/bridge by chaining slots in SONG mode.',
          'Copy a slot with Shift+ERASE, then edit the copy.',
        ],
      },
    ],
  },

  'mode.padfx': {
    id: 'mode.padfx',
    title: 'PAD FX',
    brief: 'Hold a pad to apply a beat-synced effect to the mix.',
    body: 'PAD FX turns the 16 pads into real-time effect triggers. Hold any pad to engage that effect — harder pressure means wetter signal on pressure-sensitive devices. Effects include delay, reverb, filter, bit crush, vinyl noise, stutter, and more.',
    tips: ['Shift+PAD FX → FLEX BEAT (beat-repeat / slice looper).', 'Release the pad to instantly remove the effect.', 'Combine multiple pads for layered FX.'],
    more: [
      {
        heading: 'AVAILABLE EFFECTS',
        lines: [
          'Pad 1: Echo — synced delay (1/4, 1/8, 1/16).',
          'Pad 2: Reverb — large hall space.',
          'Pad 3: Filter Sweep — auto-wah LPF.',
          'Pad 4: Bit Crush — lo-fi degradation.',
          'Pad 5: Ring Mod — metallic pitch effect.',
          'Pad 6: Vinyl Noise — adds crackle and hiss.',
          'Pad 7: Gate — rhythmic mute chop.',
          'Pad 8: Pitch Shift — real-time chromatic shift.',
          'Pad 9–16: additional FX per page.',
        ],
      },
      {
        heading: 'LIVE PERFORMANCE',
        lines: [
          'Hold multiple pads to stack effects.',
          'Combine Echo + Reverb for a washed-out dub style.',
          'Gate + Filter gives classic MPC "chop" performances.',
          'Pressure controls wet amount on supported devices.',
        ],
      },
    ],
  },

  'mode.knobfx': {
    id: 'mode.knobfx',
    title: 'KNOB FX',
    brief: 'Master chain effects — K1/K2/K3 control parameters.',
    body: 'KNOB FX adds three send effects to the master chain: Delay, Reverb, and a LoFi processor (bit crush + decimate + ring mod + noise). K1, K2, and K3 control the main parameters of the active effect. Use Shift+K for secondary parameters.',
    tips: ['Shift+KNOB FX → FX SELECT to route individual pads.', 'Hold Shift while turning a knob for fine-tune.', 'Bypass a specific effect with the bypass toggle on the FX page.'],
    more: [
      {
        heading: 'DELAY',
        lines: [
          'Time: synced to BPM (1/32 to 2 bars).',
          'Feedback: how many repeats (0 = single echo, 100 = infinite).',
          'Mix: dry/wet balance.',
          'Filter: tone of the echoes (darker = more vintage).',
        ],
      },
      {
        heading: 'REVERB',
        lines: [
          'Size: room size (small plate to large hall).',
          'Decay: how long the tail rings (0.1s to 8s).',
          'Mix: dry/wet balance.',
          'Pre-delay: gap before reverb onset (0–100ms).',
        ],
      },
      {
        heading: 'LO-FI',
        lines: [
          'Bits: bit depth reduction (24 = clean, 2 = destroyed).',
          'Decimate: sample-rate reduction (0 = off, 100 = very crunchy).',
          'Ring: ring modulator frequency (0 = off).',
          'Noise: vinyl hiss level.',
        ],
      },
      {
        heading: 'FX SELECT',
        lines: [
          'Tap Shift+KNOB FX to enter FX Select.',
          'Pad grid shows which pads are routed to the master FX chain.',
          'Tap a pad to toggle routing on/off.',
          'Useful for sending only drums through the delay, not melody.',
        ],
      },
    ],
  },

  'mode.shift': {
    id: 'mode.shift',
    title: 'SHIFT',
    brief: 'Toggle for alternate functions — tap ON, tap OFF.',
    body: 'SHIFT is now a toggle: tap once to activate (LED lights), tap again to deactivate. While SHIFT is on, all buttons and pads perform their secondary function (shown in the sub-label). On a physical keyboard, the Shift key still works as hold.',
    tips: ['Look for the blue/orange sub-labels on each button.', 'Pad bottom row has shortcuts to most screens.', 'Tap SHIFT again after your action to turn it off.'],
    more: [
      {
        heading: 'SHIFT + PADS (BOTTOM ROW)',
        lines: [
          'Pad 1: Full Level — forces velocity 127.',
          'Pad 2: Half Seq — halves current sequence length.',
          'Pad 3: Double Seq — doubles current sequence length.',
          'Pad 4: Count-In — toggles 1-bar count-in before recording.',
          'Pad 6: Half Speed — plays at 50% speed (octave down).',
          'Pad 7: Double Speed — plays at 200% speed (octave up).',
          'Pad 10: Rec Quantize — snap recorded hits to grid.',
          'Pad 11: Resample — bounce current pad audio back to a pad.',
          'Pad 13: Trim Selected — crop sample to trim points.',
          'Pad 15: Warp Mode — toggle between Pitch and Stretch warp.',
        ],
      },
      {
        heading: 'SHIFT + MODE BUTTONS',
        lines: [
          'Shift+SAMPLE → Input Config (mic gain, monitor).',
          'Shift+SEQ → Step Edit (draw/erase individual steps).',
          'Shift+PAD FX → Flex Beat (beat repeat, stutter, loop).',
          'Shift+KNOB FX → FX Select (per-pad routing).',
        ],
      },
    ],
  },

  'mode.padbank': {
    id: 'mode.padbank',
    title: 'PAD BANK',
    brief: 'Cycle through banks A–H (8 banks × 16 pads = 128 sounds).',
    body: 'Each bank is an independent set of 16 pads with its own samples and sequence slots. Banks share the same BPM and project settings but have completely separate kits and patterns. The bank letter (A–H) is shown on the LCD.',
    tips: ['Bank A = drums, Bank B = melody is a classic MPC layout.', 'Each bank has 16 sequence slots for 128 patterns total.', 'SONG mode chains banks and slots into a full arrangement.'],
    more: [
      {
        heading: 'WORKFLOW',
        lines: [
          '1. Bank A: load your drum kit.',
          '2. Bank B: load a melodic sample or piano roll notes.',
          '3. Record each bank\'s sequence separately.',
          '4. Switch to SONG mode to chain them into a full track.',
        ],
      },
    ],
  },

  /* ───────── PAD PLAY ───────── */
  'play.chop': {
    id: 'play.chop',
    title: 'CHOP',
    brief: 'All pads play slices of one sample.',
    body: 'CHOP mode splits one sample across all 16 pads as slices. Instead of 16 separate files, you can chop a drum break or long loop and play the pieces in real time. This is the classic MPC workflow for flipping samples.',
    tips: ['LOOPS → load long audio → CHOP SONG for instant 16 slices.', 'Shift+CHOP → NOTE ON (held/gated playback).', 'Turn CHOP off to go back to 16 independent pads.'],
    more: [
      {
        heading: 'CHOP A SONG — FAST',
        lines: [
          '1. LOOPS → pick a loop.',
          '2. Choose Auto-chop on first load (or tap CHOP SONG on LCD).',
          '3. Pads fill with 16 slices — play immediately.',
          '4. Record into SEQ for a flipped arrangement.',
        ],
      },
      {
        heading: 'CHOP A SONG — MANUAL',
        lines: [
          '1. Load sample → tap CHOP on LCD → set Chop Type.',
          '2. Threshold: detects transients automatically.',
          '3. Regions 16: divides evenly into 16 equal parts.',
          '4. Manual: zoom with JOG, tap waveform for custom points.',
          '5. TO PADS: commit slices as separate samples.',
        ],
      },
      {
        heading: 'CHOPPING TIPS',
        lines: [
          'Regions 16 is best for 4-bar loops.',
          'Threshold works well on drum breaks (one hit per region).',
          'SPLIT / MERGE / EXTRACT fine-tune individual slices.',
          'APPLY TRIM first to remove silence at start/end.',
        ],
      },
    ],
  },

  'play.mute': {
    id: 'play.mute',
    title: 'MUTE',
    brief: 'Tap pads to mute/unmute in real time.',
    body: 'MUTE mode turns the pad grid into a mute bank. Tap any pad to silence it while the sequence keeps running — great for dropping elements in and out during a performance. The LED stays lit on muted pads.',
    tips: ['Shift+MUTE → Unmute All (restore everything at once).', 'Mutes are saved with the project.', 'Combine with PAD FX for classic MPC mute performances.'],
  },

  'play.loop': {
    id: 'play.loop',
    title: 'LOOP',
    brief: 'Loops the selected pad\'s sample continuously.',
    body: 'When LOOP is on, the pad plays its sample start-to-end repeatedly as long as it is held. Loop Start point (set in SAMPLE → Trim) controls where the loop snaps back to — useful for layering a sustained texture over drums.',
    tips: ['Shift+LOOP → REVERSE (plays sample backwards).', 'Long samples (6s+) auto-enable loop on import.', 'Loop + Warp Seq = locked to sequence length.'],
  },

  'play.levels': {
    id: 'play.levels',
    title: '16 LEVELS',
    brief: 'All 16 pads control one pad at 16 different values.',
    body: '16 LEVELS turns the grid into a dynamic controller for the selected pad. Pad 1 = lowest value, Pad 16 = highest value. The TYPE determines what changes: Velocity (hit strength), Filter (cutoff sweep), or Tune (chromatic scale).',
    tips: ['Shift+16 LEVELS → TYPE (cycles Velocity / Filter / Tune).', 'Tune type gives you a chromatic scale — great for melody.', 'Velocity type makes subtle dynamics easy on a touch screen.'],
    more: [
      {
        heading: 'TUNE TYPE',
        lines: [
          'Pad 1 = −12 semitones (one octave down).',
          'Pad 9 = 0 semitones (original pitch).',
          'Pad 16 = +3 semitones.',
          'Combine with a melodic loop for instant chord stabs.',
        ],
      },
    ],
  },

  'play.sampleselect': {
    id: 'play.sampleselect',
    title: 'SAMPLE SELECT',
    brief: 'Opens the factory KITS browser.',
    body: 'SAMPLE SELECT loads the Kits screen — 100+ factory one-shot kits ready to play. Each kit fills all 16 pads with related sounds (kicks, snares, hats, etc.). Use BEATS for complete songs with sequences already programmed.',
    tips: ['Shift+SAMPLE SELECT → BROWSE (your uploaded files).', 'KITS = sounds only, no sequence. BEATS = full song with sequence.', 'LOOPS = long audio from Freesound for chopping.'],
  },

  'play.taptempo': {
    id: 'play.taptempo',
    title: 'TAP TEMPO',
    brief: 'Tap 4 times to set BPM by feel.',
    body: 'Tap TAP TEMPO in time with your track — the app averages your taps and sets the BPM. Most accurate after 4 or more taps. Works while the sequencer is playing or stopped.',
    tips: ['Shift+TAP TEMPO → METRO (toggles click track).', 'Metronome has three modes: Off / On / Record-only.', 'DETECT BPM (Project screen) auto-detects BPM from the loaded sample.'],
  },

  /* ───────── TRANSPORT ───────── */
  'transport.play': {
    id: 'transport.play',
    title: 'PLAY',
    brief: 'Start the sequencer from current position.',
    body: 'PLAY starts playback from wherever the playhead stopped last. Press STOP + PLAY to restart from bar 1. BEATS auto-play when loaded. PLAY CONTINUE resumes from the last stop point.',
    tips: ['Space bar on keyboard also toggles play/stop.', 'Jam pads while the sequence runs to record new parts.', 'Shift+STOP then PLAY = restart from bar 1.'],
  },

  'transport.stop': {
    id: 'transport.stop',
    title: 'STOP',
    brief: 'Stop playback — remembers position for CONTINUE.',
    body: 'Soft stop (tap once) pauses at the current position so PLAY resumes from there. Hard reset (Shift+STOP) returns to bar 1, beat 1. Tap STOP twice to also return to the start.',
    tips: ['Shift+STOP = hard reset to bar 1.', 'Tap STOP twice to return to start without Shift.'],
  },

  'transport.record': {
    id: 'transport.record',
    title: 'SEQ RECORD',
    brief: 'Record pad hits into the current sequence slot.',
    body: 'SEQ RECORD arms the sequencer for recording. Hit pads — every hit is captured with its velocity, timing, and duration. If Count-In is on, you get one bar to prepare before recording starts. Rec Quantize snaps hits to the nearest 16th note grid.',
    tips: ['Count-In: enable on SEQ screen (or Shift+Pad 4).', 'Rec Quantize: Shift+Pad 10 — removes timing slop.', 'Overdub: press RECORD again while playing to add more notes.', 'UNDO removes the last recorded event.'],
    more: [
      {
        heading: 'RECORDING WORKFLOW',
        lines: [
          '1. Set BPM and sequence length on the SEQ screen.',
          '2. Press PLAY + SEQ RECORD to start recording.',
          '3. Hit pads in time — the loop repeats, layer as you go.',
          '4. Press RECORD again to stop recording (stays playing).',
          '5. Press STOP when done.',
        ],
      },
      {
        heading: 'EDITING AFTER RECORDING',
        lines: [
          'Shift+SEQ → Step Edit: see and edit each step.',
          'ERASE: wipe the whole sequence (Shift+ERASE = copy first).',
          '− button: undo last recorded hit.',
          'Piano Roll: draw/move/resize individual notes.',
        ],
      },
    ],
  },

  'transport.samplerecord': {
    id: 'transport.samplerecord',
    title: 'SAMPLE RECORD',
    brief: 'Record from mic or line input onto a pad.',
    body: 'SAMPLE RECORD opens the recording screen. Choose a source (mic or resample), set the level, then hit record. The recording goes directly onto the selected pad as a sample. Trim points are auto-set to the detected content.',
    tips: ['Shift+SAMPLE RECORD → RECALL (grab the last 25 seconds of monitoring).', 'Resample mode re-records what is playing out of the speakers.', 'Input Config (Shift+SAMPLE) sets mic gain and monitor level.'],
    more: [
      {
        heading: 'RECALL',
        lines: [
          'The app silently monitors the mic at all times (25s rolling buffer).',
          'Missed a take? Press Shift+SAMPLE RECORD → RECALL.',
          'Retrieves the last 25 seconds of audio — no re-recording needed.',
        ],
      },
    ],
  },

  'transport.undo': {
    id: 'transport.undo',
    title: 'UNDO',
    brief: 'Undo the last project change.',
    body: 'Undo steps back through the last 50 changes: pad edits, sequence recording, sample trimming, and more. In Step Edit mode, the − button decrements the step cursor instead of undoing.',
    tips: ['Up to 50 undo steps.', '+ button = REDO.', 'In Step Edit, − / + navigate steps instead.'],
  },

  'transport.redo': {
    id: 'transport.redo',
    title: 'REDO',
    brief: 'Redo the last undone change.',
    tips: ['+ button on panel.', 'Works until you make a new edit (which clears redo history).'],
  },

  /* ───────── OTHER PANEL ───────── */
  'erase': {
    id: 'erase',
    title: 'ERASE',
    brief: 'Clears all events from the current sequence slot.',
    body: 'ERASE wipes the active sequence slot completely. There is no partial erase from this button — use Step Edit to delete individual notes. Erase is undoable.',
    tips: ['Shift+ERASE → COPY (duplicates slot to the next empty slot).', 'Undo recovers an erased sequence.'],
  },

  'noterepeat': {
    id: 'noterepeat',
    title: 'NOTE REPEAT',
    brief: 'Hold a pad to retrigger it in time with the BPM.',
    body: 'Hold NOTE REPEAT, then hold a pad — the pad fires repeatedly at the rate set by the K1 knob on the SEQ screen (1/4, 1/8, 1/16, 1/32, 1/64). Letting go of the pad stops repeating. Note Repeat is transport-synced so hits always land on the grid.',
    tips: ['Shift+NOTE REPEAT → TRIPLET (uses triplet timing grid).', 'Record Note Repeat hits into the sequencer for rapid fills.', 'K1 on SEQ screen sets the repeat rate.'],
  },

  'fader': {
    id: 'fader',
    title: 'FADER',
    brief: 'Controls the parameter shown in the label.',
    body: 'The fader is a soft takeover control — it only engages once the physical position matches the stored value. This prevents jumps when switching pads. Enable the fader and choose its target in the Fader menu (Shift+Pad 9).',
    tips: ['Fader target: Volume, Pan, Tune, Attack, Decay, Filter Cutoff, or Kit Volume.', 'Soft takeover: the fader \'catches\' the current value rather than jumping.', 'Step Edit: fader nudges the selected event\'s pitch (−/+ semitones).'],
  },

  'jog': {
    id: 'jog',
    title: 'JOG WHEEL',
    brief: 'Zooms waveform on SAMPLE; navigates steps in Step Edit.',
    body: 'On the SAMPLE screen, the JOG wheel zooms in on the waveform for precise editing. Zoomed in, you can see individual zero-crossings and manually tap chop points. In Step Edit mode, JOG scrubs through the step grid instead.',
    tips: ['Zoom in + tap waveform = manual chop points.', 'In Step Edit, JOG selects the step to edit.'],
  },

  'knobs': {
    id: 'knobs',
    title: 'K1 – K3',
    brief: 'Context-sensitive knobs — change per screen.',
    body: 'K1, K2, and K3 always control the three parameters listed below the LCD on the current screen. On SAMPLE they edit trim/tune/filter. On KNOB FX they edit delay/reverb/lofi. In Step Edit they set note value, velocity, and offset.',
    tips: ['Hold Shift while turning for fine adjustment.', 'Foot sliders match Trim/Tune/Filter on the SAMPLE screen.'],
  },

  'pads': {
    id: 'pads',
    title: 'PAD GRID',
    brief: '16 velocity-sensitive pads — the heart of the MPC.',
    body: 'The 16 pads trigger samples, chop slices, sequence slots, or FX depending on the active mode. Pressure is detected on devices that support it — harder hits = higher velocity = louder and brighter sound.',
    tips: ['Keyboard shortcuts: Z–V (bottom row), A–F, Q–R, 1–4 (top row).', 'Drag & drop a WAV/MP3 onto any pad to load it.', 'Shift+pad (bottom row) = quick access to screens and functions.'],
    more: [
      {
        heading: 'VELOCITY & FEEL',
        lines: [
          'Velocity 1–127 controls sample volume and filter tracking.',
          'Full Level (Shift+Pad 1) forces every hit to 127.',
          '16 Levels mode spreads one pad across a velocity or pitch range.',
          'Velocity sensitivity on touch screens uses pressure API where available.',
        ],
      },
      {
        heading: 'DRAG & DROP',
        lines: [
          'Drag any audio file from your file manager onto a pad.',
          'WAV, MP3, AIFF, M4A, OGG, and FLAC are supported.',
          'Files longer than 2 seconds prompt Auto-chop or Manual.',
        ],
      },
    ],
  },

  'piano.open': {
    id: 'piano.open',
    title: 'PIANO',
    brief: 'Full-screen chromatic keyboard for melodic playing.',
    body: 'The PIANO overlay opens a full Salamander grand piano instrument. Use it to play melodies, chords, and basslines. OCT − / + shifts the octave range. The pitch ladder (right side) transposes up/down. All notes are recorded into the sequencer when SEQ RECORD is armed.',
    tips: ['Tap ✕ MPC to return to the pad view.', 'Keys A–K on computer keyboard map to white keys.', 'Velocity bars on the left control loudness, reverb, tone, and more.'],
    more: [
      {
        heading: 'PARAMETERS',
        lines: [
          'Bar 1 (VEL): velocity — how hard notes play.',
          'Bar 2 (REV): reverb wet amount.',
          'Bar 3 (ATK): attack — slow = pad, fast = pluck.',
          'Bar 4 (REL): release — how long notes fade.',
          'Bar 5 (TN): tone — brightness filter.',
          'Bar 6 (WD): width — stereo spread.',
          'Bar 7 (SZ): key width — bigger keys for easier play.',
        ],
      },
    ],
  },

  /* ───────── PIANO ROLL ───────── */
  'pianoroll': {
    id: 'pianoroll',
    title: 'PIANO ROLL',
    brief: 'FL Studio-style melodic editor — draw notes on a grid.',
    body: 'The Piano Roll lets you draw, move, and resize individual notes on a pitch × time grid — just like FL Studio or Ableton\'s piano roll. Each note has a pitch (vertical axis), timing (horizontal), length (note width), and velocity (bottom lane).',
    tips: ['Tap empty grid = draw a note.', 'Right-click (long press) = delete a note.', 'Drag note body = move pitch and timing.', 'Drag note right edge = resize length.'],
    more: [
      {
        heading: 'DRAWING NOTES',
        lines: [
          'Tap and drag on the empty grid to draw a note.',
          'The note snaps to the current Quantize setting (1/4, 1/8, 1/16, 1/32).',
          'Drag left/right while drawing to set note length.',
          'The piano keyboard on the left shows the pitch as you draw.',
        ],
      },
      {
        heading: 'EDITING NOTES',
        lines: [
          'Drag a note body to move it (pitch + timing).',
          'Drag the right edge of a note to make it shorter or longer.',
          'Tap in the velocity lane to change a note\'s velocity.',
          'CLEAR removes all notes in the current sequence slot.',
        ],
      },
      {
        heading: 'PLAYBACK',
        lines: [
          'Notes trigger the selected pad\'s sample at the note\'s pitch.',
          'C4 (MIDI 60) = the pad\'s original pitch.',
          'Notes above C4 pitch the sample up; below C4 pitches it down.',
          'The scrolling playhead shows the current position during playback.',
        ],
      },
    ],
  },

  /* ───────── LCD BUTTONS ───────── */
  'lcd.upload': {
    id: 'lcd.upload',
    title: 'UPLOAD',
    brief: 'Load WAV/MP3/AIFF from your device onto the selected pad.',
    body: 'Opens the file picker. Supported formats: WAV, MP3, AIFF, M4A, OGG, FLAC. First load of a file longer than 2 seconds asks whether to Auto-chop (16 slices across all pads) or leave as Manual.',
    tips: ['Drag & drop also works — drop a file onto any pad.', 'Auto-chop is great for drum breaks and loops.', '2s+ files can CHOP SONG from the LCD after loading.'],
  },

  'lcd.browse': {
    id: 'lcd.browse',
    title: 'BROWSE',
    brief: 'Files you\'ve already uploaded — stored on this device.',
    body: 'BROWSE shows every audio file you have previously uploaded via the UPLOAD button. Files are stored locally using OPFS (Origin Private File System) and survive app restarts. Tap any file to load it onto the selected pad.',
    tips: ['Use UPLOAD for new files first.', 'Files persist across sessions and reloads.'],
  },

  'lcd.beats': {
    id: 'lcd.beats',
    title: 'BEATS',
    brief: 'Factory songs — drum kit + melody sequence, ready to play.',
    body: 'BEATS loads a complete factory project: drums, melody samples, and a pre-programmed sequence. Tap any beat to load it, then hit PLAY. SHORT tab = 4–8 bar loops, LONG tab = 16–32 bar songs.',
    tips: ['Beats are a great starting point for remixing.', 'Change BPM on the SEQ screen after loading.', 'Swap kits by going to KITS and loading onto the same pads.'],
  },

  'lcd.kits': {
    id: 'lcd.kits',
    title: 'KITS',
    brief: '100+ factory one-shot kits — no sequence included.',
    body: 'KITS loads 16 one-shot samples onto the pad grid. Unlike BEATS, there is no sequence — you are expected to record or program your own. Kits include classic drum machines (808, 606, Linn), acoustic drums, lo-fi, and melodic kits.',
    tips: ['KITS ≠ BEATS — no pattern comes with a kit.', 'Load BEATS first, then swap the kit to a new sound.', 'Melodic kits work great with 16 LEVELS (Tune mode) for melodies.'],
  },

  'lcd.loops': {
    id: 'lcd.loops',
    title: 'LOOPS',
    brief: 'Freesound browser — one-shots and long loops from the internet.',
    body: 'LOOPS connects to Freesound.org to browse royalty-aware community samples. Three tabs: LOOP (short phrases), BEAT (4–16 bar grooves), SONG (full-length material). Previews stream instantly; tap LOAD to import onto the selected pad.',
    tips: ['Requires an internet connection.', 'SONG tab → CHOP SONG = instant 16-slice chop kit.', 'Add your own Freesound API key in PROJECT → Settings for unlimited access.'],
    more: [
      {
        heading: 'TABS',
        lines: [
          'LOOP tab: duration 0–6s — short one-shots and phrases.',
          'BEAT tab: duration 4–30s — drum loops and grooves.',
          'SONG tab: duration 30s+ — full arrangements for chopping.',
        ],
      },
      {
        heading: 'WORKFLOW',
        lines: [
          '1. Search for a sound (e.g., "vintage 808 kick").',
          '2. Tap a result to stream a preview.',
          '3. Tap LOAD to import onto the selected pad.',
          '4. Use CHOP SONG to slice a long loop across all 16 pads.',
        ],
      },
    ],
  },

  'lcd.chop': {
    id: 'lcd.chop',
    title: 'CHOP',
    brief: 'Re-run slice detection on the current sample.',
    body: 'CHOP re-detects and re-draws slice points using the current Chop Type setting (from the Trim tab K1 knob). Use this after changing the Chop Type or Threshold to refresh the slices without reloading the sample.',
    tips: ['Change Chop Type knob first, then tap CHOP.', 'Threshold: automated beat detection.', 'Regions 16: even split — best for melodic loops.'],
  },

  'lcd.chopsong': {
    id: 'lcd.chopsong',
    title: 'CHOP SONG',
    brief: 'Splits the sample into up to 16 slices across all pads.',
    body: 'CHOP SONG is the fastest way to make a chop kit. It divides the loaded sample across pads 1–16 using Regions mode scaled to the file length (4 regions for <8s, 8 for 8–16s, 16 for longer). Loop mode is turned off automatically so each pad is a one-shot.',
    tips: ['Best for 4–60s loops from BEATS or LOOPS.', 'Record pads into the sequencer to flip the loop.', 'TO PADS commits each slice as an independent sample file.'],
    more: [
      {
        heading: 'CLASSIC MPC WORKFLOW',
        lines: [
          '1. LOOPS → search "drum break" → LOAD.',
          '2. CHOP SONG → 16 pads fill with slices.',
          '3. PLAY + SEQ RECORD → tap pads to flip.',
          '4. Stop recording → listen → adjust with Step Edit.',
        ],
      },
    ],
  },

  'lcd.topads': {
    id: 'lcd.topads',
    title: 'TO PADS',
    brief: 'Commits slices to individual pads as separate samples.',
    body: 'TO PADS turns each slice into its own sample file assigned to pads 1–16. After this operation, CHOP mode is turned off and each pad is fully independent — you can trim, tune, and filter each slice separately. This is non-destructive; the original sample is unchanged.',
    tips: ['Run CHOP first to set up slices.', 'EXTRACT (Step Edit) moves one slice to a specific pad.'],
  },

  'lcd.split': {
    id: 'lcd.split',
    title: 'SLICE EDIT',
    brief: 'SPLIT · MERGE · EXTRACT — fine-tune individual slice boundaries.',
    body: 'The three slice edit buttons let you refine your chop points without re-running the full detection. SPLIT adds a boundary at the playhead. MERGE combines the selected slice with the next. EXTRACT copies the selected slice to the next empty pad.',
    tips: ['Switch to Manual Chop Type for hand-editing.', 'Zoom with JOG for precise boundary placement.'],
    more: [
      {
        heading: 'SPLIT',
        lines: [
          'Places a new slice boundary at the current playhead position.',
          'Zoom into the waveform first for accuracy.',
          'Use to separate two hits that were merged.',
        ],
      },
      {
        heading: 'MERGE',
        lines: [
          'Combines the selected slice with the next one.',
          'Use to join two slices that are too small.',
        ],
      },
      {
        heading: 'EXTRACT',
        lines: [
          'Copies the selected slice to the next empty pad as a new sample.',
          'The original pad and CHOP mode are unchanged.',
          'Great for pulling out the best hit to its own pad.',
        ],
      },
    ],
  },

  'lcd.normalize': {
    id: 'lcd.normalize',
    title: 'NORMALIZE',
    brief: "Auto-sets Volume so the sample's loudest point hits -0.1dB.",
    body: 'NORMALIZE scans the current Start/End region for its peak level and computes the Volume needed to bring that peak up to -0.1dB — the same Volume knob as the Mix tab, just auto-calculated instead of set by ear. Non-destructive: the sample file itself is untouched.',
    tips: ['Re-run after trimming — the peak region changes.', 'A silent region is left alone.'],
  },

  'lcd.looptoend': {
    id: 'lcd.looptoend',
    title: 'LOOP TO END',
    brief: 'Resets End back to the sample’s true full length.',
    body: 'LOOP TO END undoes any trim/chop on the end side, restoring End to the actual end of the audio — useful when a chop boundary cut off a tail (like reverb decay) you want to hear ring out. Start and Loop points are unchanged.',
    tips: ['Only shown when End is currently short of the full sample.'],
  },
};

export function getGuideTopic(id: string): GuideTopic | undefined {
  return GUIDE_TOPICS[id];
}
