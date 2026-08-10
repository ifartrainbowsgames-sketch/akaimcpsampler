import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { SHIFT_FUNCTIONS, SHIFT_SCREENS } from './shiftMap';

const ROWS = [
  [12, 13, 14, 15],
  [8, 9, 10, 11],
  [4, 5, 6, 7],
  [0, 1, 2, 3],
];

const KEYMAP: Record<string, number> = {
  z: 0, x: 1, c: 2, v: 3,
  a: 4, s: 5, d: 6, f: 7,
  q: 8, w: 9, e: 10, r: 11,
  '1': 12, '2': 13, '3': 14, '4': 15,
};

const FLASH_MS = 220;
const SEQ_LIT_MS = 180;

export function Pads() {
  const hitPad = useStore((s) => s.hitPad);
  const releasePad = useStore((s) => s.releasePad);
  const shift = useStore((s) => s.shift);
  const setScreen = useStore((s) => s.setScreen);
  const importSample = useStore((s) => s.importSample);
  const toggleFullLevel = useStore((s) => s.toggleFullLevel);
  const trimSelected = useStore((s) => s.trimSelected);
  const halfSeq = useStore((s) => s.halfSeq);
  const doubleSeq = useStore((s) => s.doubleSeq);
  const toggleCountIn = useStore((s) => s.toggleCountIn);
  const halfSpeed = useStore((s) => s.halfSpeed);
  const doubleSpeed = useStore((s) => s.doubleSpeed);
  const toggleRecQuantize = useStore((s) => s.toggleRecQuantize);
  const resampleToPad = useStore((s) => s.resampleToPad);
  const toggleWarpMode = useStore((s) => s.toggleWarpMode);
  const screen = useStore((s) => s.screen);
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const selected = useStore((s) => s.selectedPad);
  const seqSlot = useStore((s) => s.seqSlot);
  const queuedSeqSlot = useStore((s) => s.queuedSeqSlot);
  const noteRepeat = useStore((s) => s.noteRepeat);
  const noteRepeatTriplet = useStore((s) => s.noteRepeatTriplet);
  const fullLevel = useStore((s) => s.fullLevel);
  const startPadNoteRepeat = useStore((s) => s.startPadNoteRepeat);
  const knobFXRouting = useStore((s) => s.knobFXRouting);
  const timeCorrectPads = useStore((s) => s.timeCorrectPads);

  const [flash, setFlash] = useState<Record<number, boolean>>({});
  const [seqLit, setSeqLit] = useState<Record<number, boolean>>({});
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const held = useRef(new Set<number>());
  const now = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = performance.now();
      now.current = t;
      const lit: Record<number, boolean> = {};
      for (let i = 0; i < 16; i++) {
        if (t - engine.telemetry.padActivity[i] < FLASH_MS) lit[i] = true;
        if (t - engine.telemetry.seqPadLit[i] < SEQ_LIT_MS) lit[i] = true;
      }
      setSeqLit(lit);
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
      startPadNoteRepeat(i, 110);
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
  }, [shift, noteRepeat, noteRepeatTriplet, project.bpm]);

  function trigger(i: number, velocity: number) {
    if (shift) {
      switch (i) {
        case 0: toggleFullLevel(); return;
        case 1: halfSeq(); return;
        case 2: doubleSeq(); return;
        case 3: toggleCountIn(); return;
        case 5: halfSpeed(); return;
        case 6: doubleSpeed(); return;
        case 9: toggleRecQuantize(); return;
        case 10: void resampleToPad(selected); return;
        case 12: trimSelected(); return;
        case 14: toggleWarpMode(); return;
        default: break;
      }
      const target = SHIFT_SCREENS[i];
      if (target) {
        setScreen(target);
        return;
      }
    }

    hitPad(i, velocity);
    if (screen !== 'stepedit' && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(4);
    }
    setFlash((f) => ({ ...f, [i]: true }));
    window.setTimeout(() => setFlash((f) => ({ ...f, [i]: false })), FLASH_MS);
  }

  return (
    <div className="padwell">
      {ROWS.map((row, ri) => (
        <div className="padrow" key={ri}>
          {row.map((i) => {
            const pad = project.banks[bank][i];
            const loaded = !!pad.sampleId;
            const playing = !!seqLit[i];
            const isSeqSlot = screen === 'seq' && seqSlot === i;
            const isSeqQueued = screen === 'seq' && queuedSeqSlot === i;
            const seq = project.sequences[bank][i];
            const seqHasEvents = seq.events.length > 0;
            const inSeqMode = screen === 'seq';
            const inKnobSelect = screen === 'knobfx-select';
            const inTimeCorr = screen === 'timecorr';
            const inFlexBeat = screen === 'flexbeat';
            const isFlexActive = inFlexBeat && useStore.getState().flexBeat.activePad === i;
            const knobRouted = inKnobSelect && knobFXRouting[i];
            const tcSelected = inTimeCorr && timeCorrectPads[i];
            return (
              <div className="padcell" key={i}>
                <button
                  type="button"
                  className={[
                    'pad',
                    flash[i] || playing ? 'hit' : '',
                    pad.muted ? 'muted' : '',
                    loaded ? 'loaded' : 'empty',
                    playing ? 'seqlit' : '',
                    inSeqMode && seqHasEvents ? 'seqfilled' : '',
                    inSeqMode && !seqHasEvents ? 'seqempty' : '',
                    isSeqSlot ? 'seqslot' : '',
                    isSeqQueued ? 'seqqueued' : '',
                    inKnobSelect ? (knobRouted ? 'knobfx-lit' : 'knobfx-dim') : '',
                    inTimeCorr && tcSelected ? 'tcsel' : '',
                    isFlexActive ? 'flexon' : '',
                    selected === i ? 'selected' : '',
                    dropTarget === i ? 'dropping' : '',
                  ].join(' ')}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const v = e.pressure > 0 && e.pressure < 1
                      ? Math.max(20, Math.round(e.pressure * 127))
                      : fullLevel ? 127 : 100;
                    trigger(i, v);
                    startPadNoteRepeat(i, v);
                  }}
                  onPointerUp={(e) => {
                    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
                    releasePad(i);
                  }}
                  onPointerCancel={() => {
                    releasePad(i);
                  }}
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
