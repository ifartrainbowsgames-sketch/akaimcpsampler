import { useEffect, useRef, useState } from 'react';
import { usePianoStore } from '../store/pianoStore';
import { pianoEngine } from '../audio/PianoEngine';
import { pianoMidi } from '../audio/MidiEngine';
import { PianoDisplay } from './PianoDisplay';
import { PianoParameterBar } from './PianoParameterBar';
import { PianoControls } from './PianoControls';
import { PianoKeyboard } from './PianoKeyboard';
import {
  COMPUTER_KEY_MAP,
  isTypingTarget,
  PIANO_SHORTCUTS,
} from '../keyboard/computerKeys';

export function PianoInstrument() {
  const rootRef = useRef<HTMLElement>(null);
  const keysHeld = useRef(new Set<string>());
  const sustainKey = useRef(false);
  const [ready, setReady] = useState(false);

  const collapsed = usePianoStore((s) => s.collapsed);
  const setCollapsed = usePianoStore((s) => s.setCollapsed);
  const focused = usePianoStore((s) => s.focused);
  const setFocused = usePianoStore((s) => s.setFocused);
  const showMore = usePianoStore((s) => s.showMore);
  const setShowMore = usePianoStore((s) => s.setShowMore);
  const initPiano = usePianoStore((s) => s.initPiano);
  const velocity = usePianoStore((s) => s.velocity);
  const volume = usePianoStore((s) => s.volume);
  const reverb = usePianoStore((s) => s.reverb);
  const tone = usePianoStore((s) => s.tone);
  const release = usePianoStore((s) => s.release);
  const stereoWidth = usePianoStore((s) => s.stereoWidth);
  const setVelocity = usePianoStore((s) => s.setVelocity);
  const setVolume = usePianoStore((s) => s.setVolume);
  const setReverb = usePianoStore((s) => s.setReverb);
  const setTone = usePianoStore((s) => s.setTone);
  const setRelease = usePianoStore((s) => s.setRelease);
  const setStereoWidth = usePianoStore((s) => s.setStereoWidth);
  const setOctave = usePianoStore((s) => s.setOctave);
  const octave = usePianoStore((s) => s.octave);
  const setSustain = usePianoStore((s) => s.setSustain);
  const audioStatus = usePianoStore((s) => s.audioStatus);

  useEffect(() => {
    return () => {
      pianoEngine.allNotesOff();
      pianoMidi.disconnect();
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const pianoActive = focused || rootRef.current?.contains(document.activeElement);
      if (!pianoActive && !rootRef.current?.contains(e.target as Node)) return;

      const k = e.key;
      if (PIANO_SHORTCUTS.octaveDown.includes(k)) {
        e.preventDefault();
        setOctave(octave - 1);
        return;
      }
      if (PIANO_SHORTCUTS.octaveUp.includes(k)) {
        e.preventDefault();
        setOctave(octave + 1);
        return;
      }
      if (PIANO_SHORTCUTS.sustain.includes(k) && pianoActive) {
        e.preventDefault();
        if (!sustainKey.current) {
          sustainKey.current = true;
          setSustain(true);
        }
        return;
      }

      const note = COMPUTER_KEY_MAP[k.toLowerCase()];
      if (note === undefined || keysHeld.current.has(k)) return;
      if (!ready) return;
      e.preventDefault();
      keysHeld.current.add(k);
      pianoEngine.noteOn(note, velocity, 'keyboard', `key-${k}`);
    };

    const up = (e: KeyboardEvent) => {
      if (PIANO_SHORTCUTS.sustain.includes(e.key) && sustainKey.current) {
        sustainKey.current = false;
        setSustain(false);
      }
      const note = COMPUTER_KEY_MAP[e.key.toLowerCase()];
      if (note !== undefined && keysHeld.current.has(e.key)) {
        keysHeld.current.delete(e.key);
        pianoEngine.noteOff(note, 'keyboard', `key-${e.key}`);
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [focused, ready, velocity, octave, setOctave, setSustain]);

  const ensureReady = async () => {
    if (ready) return;
    await initPiano();
    setReady(true);
  };

  if (collapsed) {
    return (
      <header className="piano-shell piano-shell--collapsed">
        <button type="button" className="piano-expand-btn" onClick={() => setCollapsed(false)}>
          ▲ PIANO
        </button>
      </header>
    );
  }

  return (
    <section
      ref={rootRef}
      className="piano-shell"
      onPointerDown={() => { void ensureReady(); setFocused(true); }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <div className="piano-shell__head">
        <span className="piano-shell__title">WORKSTATION PIANO</span>
        <button type="button" className="piano-collapse-btn" onClick={() => setCollapsed(true)} aria-label="Collapse piano">
          ▼
        </button>
      </div>

      {!ready && (
        <button type="button" className="piano-boot-btn" onClick={() => void ensureReady()}>
          {audioStatus === 'TAP TO ENABLE' ? 'TAP TO LOAD PIANO' : audioStatus}
        </button>
      )}

      <PianoDisplay />

      <div className="piano-params piano-params--main">
        <PianoParameterBar label="VELOCITY" value={velocity} onChange={setVelocity} />
        <PianoParameterBar label="VOLUME" value={Math.round(volume * 100)} onChange={(v) => setVolume(v / 100)} />
      </div>

      <div className={`piano-params piano-params--more${showMore ? ' piano-params--open' : ''}`}>
        <PianoParameterBar label="REVERB" value={Math.round(reverb * 100)} onChange={(v) => setReverb(v / 100)} />
        <PianoParameterBar label="TONE" value={Math.round(tone * 100)} onChange={(v) => setTone(v / 100)} />
        <PianoParameterBar label="RELEASE" value={Math.round(release * 100)} onChange={(v) => setRelease(v / 100)} />
        <PianoParameterBar label="WIDTH" value={Math.round(stereoWidth * 100)} onChange={(v) => setStereoWidth(v / 100)} />
      </div>

      <button type="button" className="piano-more-toggle" onClick={() => setShowMore(!showMore)}>
        {showMore ? '▲ LESS' : '▼ MORE'}
      </button>

      <PianoControls />
      <PianoKeyboard />
    </section>
  );
}
