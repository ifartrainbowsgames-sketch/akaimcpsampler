import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../piano.css';
import { usePianoStore } from '../store/pianoStore';
import { pianoEngine } from '../audio/PianoEngine';
import { pianoMidi } from '../audio/MidiEngine';
import { PianoDisplay } from './PianoDisplay';
import { PianoParameterBar } from './PianoParameterBar';
import { PianoControls } from './PianoControls';
import { PianoKeyboard } from './PianoKeyboard';
import { PianoSongStudio } from './PianoSongStudio';
import { bindPianoSongRecorder, usePianoSongStore } from '../store/pianoSongStore';
import {
  COMPUTER_KEY_MAP,
  isTypingTarget,
  PIANO_SHORTCUTS,
} from '../keyboard/computerKeys';

/** Full-screen piano overlay — opened from MPC PIANO button. */
export function PianoOverlay() {
  const rootRef = useRef<HTMLElement>(null);
  const keysHeld = useRef(new Set<string>());
  const sustainKey = useRef(false);
  const [ready, setReady] = useState(false);

  const open = usePianoStore((s) => s.open);
  const setOpen = usePianoStore((s) => s.setOpen);
  const setFocused = usePianoStore((s) => s.setFocused);
  const initPiano = usePianoStore((s) => s.initPiano);
  const velocity = usePianoStore((s) => s.velocity);
  const volume = usePianoStore((s) => s.volume);
  const reverb = usePianoStore((s) => s.reverb);
  const tone = usePianoStore((s) => s.tone);
  const release = usePianoStore((s) => s.release);
  const stereoWidth = usePianoStore((s) => s.stereoWidth);
  const keyScale = usePianoStore((s) => s.keyScale);
  const setVelocity = usePianoStore((s) => s.setVelocity);
  const setVolume = usePianoStore((s) => s.setVolume);
  const setReverb = usePianoStore((s) => s.setReverb);
  const setTone = usePianoStore((s) => s.setTone);
  const setRelease = usePianoStore((s) => s.setRelease);
  const setStereoWidth = usePianoStore((s) => s.setStereoWidth);
  const setKeyScale = usePianoStore((s) => s.setKeyScale);
  const setOctave = usePianoStore((s) => s.setOctave);
  const octave = usePianoStore((s) => s.octave);
  const setSustain = usePianoStore((s) => s.setSustain);
  const audioStatus = usePianoStore((s) => s.audioStatus);
  const tab = usePianoSongStore((s) => s.tab);
  const setTab = usePianoSongStore((s) => s.setTab);

  useEffect(() => {
    bindPianoSongRecorder();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('piano-open', open);
    return () => document.body.classList.remove('piano-open');
  }, [open]);

  useEffect(() => {
    if (!open) {
      pianoEngine.allNotesOff();
      setReady(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      pianoEngine.allNotesOff();
      pianoMidi.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

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
      if (PIANO_SHORTCUTS.sustain.includes(k)) {
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
  }, [open, ready, velocity, octave, setOctave, setSustain, setOpen]);

  const ensureReady = async () => {
    if (ready) return;
    await initPiano();
    pianoEngine.setVelocity(usePianoStore.getState().velocity);
    setReady(true);
  };

  if (!open) return null;

  return createPortal(
    <section
      ref={rootRef}
      className="piano-fs"
      onPointerDown={() => { void ensureReady(); setFocused(true); }}
    >
      <div className="piano-fs__head">
        <span className="piano-fs__title">GRAND PIANO</span>
        <div className="piano-fs__tabs">
          <button
            type="button"
            className={`piano-fs__tab${tab === 'play' ? ' piano-fs__tab--on' : ''}`}
            onClick={() => setTab('play')}
          >
            PLAY
          </button>
          <button
            type="button"
            className={`piano-fs__tab${tab === 'song' ? ' piano-fs__tab--on' : ''}`}
            onClick={() => setTab('song')}
          >
            SONG
          </button>
        </div>
        <button type="button" className="piano-fs__close" onClick={() => setOpen(false)} aria-label="Close piano">
          ✕ MPC
        </button>
      </div>

      {!ready && (
        <button type="button" className="piano-boot-btn" onClick={() => void ensureReady()}>
          {audioStatus === 'TAP TO ENABLE' ? 'TAP TO LOAD PIANO' : audioStatus}
        </button>
      )}

      {tab === 'play' ? (
        <>
          <PianoDisplay />

          <div className="piano-mixer">
            <div className="piano-mixer__hdr">MIXER</div>
            <PianoParameterBar label="VELOCITY" value={velocity} onChange={setVelocity} max={127} />
            <PianoParameterBar label="VOLUME" value={Math.round(volume * 100)} onChange={(v) => setVolume(v / 100)} />
            <PianoParameterBar label="REVERB" value={Math.round(reverb * 100)} onChange={(v) => setReverb(v / 100)} />
            <PianoParameterBar label="TONE" value={Math.round(tone * 100)} onChange={(v) => setTone(v / 100)} />
            <PianoParameterBar label="RELEASE" value={Math.round(release * 100)} onChange={(v) => setRelease(v / 100)} />
            <PianoParameterBar label="WIDTH" value={Math.round(stereoWidth * 100)} onChange={(v) => setStereoWidth(v / 100)} />
            <PianoParameterBar
              label="KEY SIZE"
              value={Math.round(keyScale * 100)}
              onChange={(v) => setKeyScale(v / 100)}
            />
          </div>

          <PianoControls />
        </>
      ) : (
        <PianoSongStudio />
      )}

      <PianoKeyboard compact={tab === 'song'} />
    </section>,
    document.body,
  );
}

/** Opens the full-screen piano (call from MPC panel). */
export function openPiano() {
  usePianoStore.getState().setOpen(true);
}
