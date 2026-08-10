import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isBlackKey,
  midiToName,
  PIANO_MAX_NOTE,
  totalWhiteKeys,
  visibleWhiteKeyCount,
  whiteKeyMidi,
} from '../types/piano';
import { pianoEngine } from '../audio/PianoEngine';
import { usePianoStore } from '../store/pianoStore';
import { PianoWhiteKey } from './PianoWhiteKey';
import { PianoBlackKey } from './PianoBlackKey';

export function PianoKeyboard() {
  const viewportStart = usePianoStore((s) => s.viewportStart);
  const panViewport = usePianoStore((s) => s.panViewport);
  const velocity = usePianoStore((s) => s.velocity);
  const litNotes = usePianoStore((s) => s.litNotes);
  const setFocused = usePianoStore((s) => s.setFocused);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>());
  const [visibleWhites, setVisibleWhites] = useState(14);

  const totalWhites = totalWhiteKeys();

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setVisibleWhites(visibleWhiteKeyCount(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const endPointer = useCallback((pointerId: number) => {
    const note = pointers.current.get(pointerId);
    if (note !== undefined) {
      pianoEngine.noteOff(note, 'touch', `ptr-${pointerId}`);
      pointers.current.delete(pointerId);
    }
  }, []);

  useEffect(() => {
    const allOff = () => {
      for (const pid of [...pointers.current.keys()]) endPointer(pid);
      pianoEngine.allNotesOff();
    };
    const onVis = () => { if (document.hidden) allOff(); };
    window.addEventListener('blur', allOff);
    window.addEventListener('pointerup', (e) => endPointer(e.pointerId));
    window.addEventListener('pointercancel', (e) => endPointer(e.pointerId));
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', allOff);
      document.removeEventListener('visibilitychange', onVis);
      pianoEngine.allNotesOff();
    };
  }, [endPointer]);

  const hitTest = (clientX: number): number | null => {
    const el = surfaceRef.current;
    if (!el) return null;
    const target = document.elementFromPoint(clientX, el.getBoundingClientRect().top + el.clientHeight / 2);
    if (!target || !(target instanceof HTMLElement)) return null;
    const midi = target.dataset.midi;
    return midi ? Number(midi) : null;
  };

  const onKeyPointerDown = (e: React.PointerEvent, midi: number) => {
    e.preventDefault();
    setFocused(true);
    const pid = e.pointerId;
    e.currentTarget.setPointerCapture(pid);
    const prev = pointers.current.get(pid);
    if (prev !== undefined && prev !== midi) {
      pianoEngine.glide(`ptr-${pid}`, prev, midi, velocity);
    } else {
      pianoEngine.noteOn(midi, velocity, 'touch', `ptr-${pid}`);
    }
    pointers.current.set(pid, midi);
  };

  const onKeyPointerEnter = (e: React.PointerEvent, midi: number) => {
    if (e.buttons === 0) return;
    const pid = e.pointerId;
    if (!pointers.current.has(pid)) return;
    const prev = pointers.current.get(pid)!;
    if (prev !== midi) {
      pianoEngine.glide(`ptr-${pid}`, prev, midi, velocity);
      pointers.current.set(pid, midi);
    }
  };

  const start = Math.min(viewportStart, Math.max(0, totalWhites - visibleWhites));
  const startMidi = whiteKeyMidi(start);

  const whiteKeys: { midi: number; idx: number }[] = [];
  for (let n = startMidi; n <= PIANO_MAX_NOTE && whiteKeys.length < visibleWhites; n++) {
    if (!isBlackKey(n)) whiteKeys.push({ midi: n, idx: whiteKeys.length });
  }

  const whiteW = 100 / visibleWhites;
  const blackW = whiteW * 0.58;

  const blackKeys: { midi: number; left: number }[] = [];
  for (let i = 0; i < whiteKeys.length - 1; i++) {
    const w = whiteKeys[i].midi;
    const candidate = w + 1;
    if (candidate <= PIANO_MAX_NOTE && isBlackKey(candidate)) {
      blackKeys.push({ midi: candidate, left: (i + 1) * whiteW - blackW / 2 });
    }
  }

  return (
    <div className="piano-kb-wrap">
      <div className="piano-kb-nav">
        <button type="button" className="piano-nav-btn" onClick={() => panViewport(-3)} aria-label="Keyboard left">◀</button>
        <button type="button" className="piano-nav-btn" onClick={() => panViewport(3)} aria-label="Keyboard right">▶</button>
      </div>
      <div
        ref={surfaceRef}
        className="piano-kb"
        style={{ touchAction: 'none', userSelect: 'none' }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            const n = hitTest(e.clientX);
            if (n !== null) onKeyPointerDown(e, n);
          }
        }}
      >
        <div className="piano-kb__whites">
          {whiteKeys.map(({ midi, idx }) => (
            <PianoWhiteKey
              key={midi}
              midi={midi}
              label={idx === 0 || midi % 12 === 0 ? midiToName(midi) : undefined}
              lit={litNotes.has(midi)}
              widthPct={whiteW}
              leftPct={idx * whiteW}
              onPointerDown={(e) => onKeyPointerDown(e, midi)}
              onPointerEnter={(e) => onKeyPointerEnter(e, midi)}
            />
          ))}
        </div>
        <div className="piano-kb__blacks">
          {blackKeys.map(({ midi, left }) => (
            <PianoBlackKey
              key={midi}
              midi={midi}
              lit={litNotes.has(midi)}
              widthPct={blackW}
              leftPct={left}
              onPointerDown={(e) => onKeyPointerDown(e, midi)}
              onPointerEnter={(e) => onKeyPointerEnter(e, midi)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
