import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { SHIFT_FUNCTIONS, SHIFT_SCREENS } from './shiftMap';

/** Display rows run top-to-bottom; pad 1 is bottom-left. */
const ROWS = [
  [12, 13, 14, 15],
  [8, 9, 10, 11],
  [4, 5, 6, 7],
  [0, 1, 2, 3],
];

/** QWERTY mapping so desktop users can actually play. */
const KEYMAP: Record<string, number> = {
  z: 0, x: 1, c: 2, v: 3,
  a: 4, s: 5, d: 6, f: 7,
  q: 8, w: 9, e: 10, r: 11,
  '1': 12, '2': 13, '3': 14, '4': 15,
};

export function Pads() {
  const hitPad = useStore((s) => s.hitPad);
  const releasePad = useStore((s) => s.releasePad);
  const shift = useStore((s) => s.shift);
  const setScreen = useStore((s) => s.setScreen);
  const importSample = useStore((s) => s.importSample);
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const selected = useStore((s) => s.selectedPad);

  const [flash, setFlash] = useState<Record<number, boolean>>({});
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const held = useRef(new Set<number>());

  // Telemetry is polled on rAF — the engine never triggers a render itself.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setStep(engine.telemetry.step);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const i = KEYMAP[e.key.toLowerCase()];
      if (i === undefined || held.current.has(i)) return;
      held.current.add(i);
      trigger(i, 110);
    };
    const up = (e: KeyboardEvent) => {
      const i = KEYMAP[e.key.toLowerCase()];
      if (i === undefined) return;
      held.current.delete(i);
      releasePad(i);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift]);

  function trigger(i: number, velocity: number) {
    if (shift) {
      const target = SHIFT_SCREENS[i];
      if (target) {
        setScreen(target);
        return;
      }
    }
    hitPad(i, velocity);
    setFlash((f) => ({ ...f, [i]: true }));
    window.setTimeout(() => setFlash((f) => ({ ...f, [i]: false })), 140);
  }

  return (
    <div className="padwell">
      {ROWS.map((row, ri) => (
        <div className="padrow" key={ri}>
          {row.map((i) => {
            const pad = project.banks[bank][i];
            const loaded = !!pad.sampleId;
            const playing = step % 16 === i && engine.telemetry.playing;
            return (
              <div className="padcell" key={i}>
                <button
                  type="button"
                  className={[
                    'pad',
                    flash[i] ? 'hit' : '',
                    pad.muted ? 'muted' : '',
                    loaded ? 'loaded' : 'empty',
                    playing ? 'seqlit' : '',
                    selected === i ? 'selected' : '',
                    dropTarget === i ? 'dropping' : '',
                  ].join(' ')}
                  onPointerDown={(e) => {
                    // Velocity from pointer pressure where the device reports
                    // it; a sensible fixed value otherwise.
                    const v = e.pressure > 0 && e.pressure < 1
                      ? Math.max(20, Math.round(e.pressure * 127))
                      : 100;
                    trigger(i, v);
                  }}
                  onPointerUp={() => releasePad(i)}
                  onPointerLeave={() => releasePad(i)}
                  onDragOver={(e) => { e.preventDefault(); setDropTarget(i); }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    const file = e.dataTransfer.files[0];
                    if (file) void importSample(file, i);
                  }}
                  aria-label={`Pad ${i + 1}${loaded ? ` — ${pad.sampleName}` : ' — empty'}`}
                >
                  <span className="padnum">{i + 1}</span>
                  {loaded && <span className="padname">{pad.sampleName}</span>}
                </button>
                <div className={`padlegend ${shift ? 'active' : ''}`}>
                  <b>{i + 1}</b>
                  <span>{SHIFT_FUNCTIONS[i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
