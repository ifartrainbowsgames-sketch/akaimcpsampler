import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { ticksPerBar } from '../audio/scheduler';
import { NUM_PADS, TICKS_PER_16TH } from '../audio/types';
import './channelrack.css';

const BANK_LETTERS = 'ABCDEFGH';

/**
 * FL-style Channel Rack: every pad of the active bank is a channel row of step
 * buttons over the active pattern, plus a velocity graph editor for the
 * selected channel. All edits map onto the pattern's events (see
 * channelRackSlice), so what you toggle here is the same data the sequencer,
 * step-edit and piano-roll views read.
 */
export function ChannelRack() {
  const project    = useStore((s) => s.project);
  const bank       = useStore((s) => s.bank);
  const seqSlot    = useStore((s) => s.seqSlot);
  const selectedPad = useStore((s) => s.selectedPad);
  const setScreen  = useStore((s) => s.setScreen);
  const selectPad  = useStore((s) => s.selectPad);
  const toggleStep = useStore((s) => s.toggleStep);
  const setStepVelocity = useStore((s) => s.setStepVelocity);
  const clearChannel = useStore((s) => s.clearChannel);

  const seq = project.sequences[bank][seqSlot];
  const barTicks = ticksPerBar(project.timeSignature);
  const stepsPerBar = Math.max(1, Math.round(barTicks / TICKS_PER_16TH));
  const stepsTotal = seq.bars * stepsPerBar;

  const [vel, setVel] = useState(100); // default velocity for new steps
  const [playStep, setPlayStep] = useState(-1);
  const lastStep = useRef(-1);
  const stripRef = useRef<HTMLDivElement>(null);

  // Build a velocity grid [pad][step]; 0 = step off. Pitched notes (piano-roll
  // material) are skipped — the rack only shows base-pitch drum hits.
  const grid: number[][] = Array.from({ length: NUM_PADS }, () => new Array(stepsTotal).fill(0));
  for (const e of seq.events) {
    if (e.note !== undefined && e.note !== 60) continue;
    if (e.pad < 0 || e.pad >= NUM_PADS) continue;
    const step = Math.round(e.tick / TICKS_PER_16TH);
    if (step >= 0 && step < stepsTotal) grid[e.pad][step] = e.velocity;
  }

  // Live playhead column (only advances when a value actually changes).
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = engine.telemetry.playing
        ? Math.floor(engine.telemetry.positionTicks / TICKS_PER_16TH) % stepsTotal
        : -1;
      if (s !== lastStep.current) {
        lastStep.current = s;
        setPlayStep(s);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stepsTotal]);

  const padName = (p: number) => project.banks[bank][p].sampleName || `Pad ${p + 1}`;

  // ── Graph editor: click / drag to set velocity per step for selected pad ────
  const paintVel = (clientX: number, clientY: number) => {
    const rect = stripRef.current!.getBoundingClientRect();
    const step = Math.floor(((clientX - rect.left) / rect.width) * stepsTotal);
    if (step < 0 || step >= stepsTotal) return;
    const v = Math.max(1, Math.min(127, Math.round((1 - (clientY - rect.top) / rect.height) * 127)));
    setStepVelocity(selectedPad, step, v);
  };
  const onStripDown = (e: React.PointerEvent) => {
    paintVel(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => paintVel(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="cr">
      <div className="cr-toolbar">
        <button type="button" className="cr-btn" onClick={() => setScreen('seq')}>◀ BACK</button>
        <span className="cr-sep" />
        <span className="cr-title">RACK · {BANK_LETTERS[bank]}{seqSlot + 1} · {seq.name}</span>
        <span className="cr-sep" />
        <span className="cr-lbl">VEL</span>
        <input
          type="range" min={1} max={127} value={vel}
          onChange={(e) => setVel(Number(e.target.value))}
          className="cr-vel"
        />
        <span className="cr-num">{vel}</span>
      </div>

      <div className="cr-grid-wrap">
        <div className="cr-grid" style={{ gridTemplateColumns: `140px repeat(${stepsTotal}, 1fr)` }}>
          {Array.from({ length: NUM_PADS }, (_, p) => (
            <div key={p} className="cr-row" style={{ display: 'contents' }}>
              <div
                className={`cr-chan${selectedPad === p ? ' cr-chan--sel' : ''}`}
                onClick={() => selectPad(p)}
              >
                <span className="cr-chan-name" title={padName(p)}>{padName(p)}</span>
                <button
                  type="button"
                  className="cr-chan-clear"
                  title="Clear channel"
                  onClick={(e) => { e.stopPropagation(); clearChannel(p); }}
                >✕</button>
              </div>
              {Array.from({ length: stepsTotal }, (_, s) => {
                const v = grid[p][s];
                const on = v > 0;
                const beat = Math.floor(s / stepsPerBar * 4) % 2 === 0; // shade alternate beats
                return (
                  <button
                    key={s}
                    type="button"
                    className={
                      `cr-step${on ? ' cr-step--on' : ''}` +
                      `${s % 4 === 0 ? ' cr-step--beat' : ''}` +
                      `${beat ? ' cr-step--barA' : ' cr-step--barB'}` +
                      `${playStep === s ? ' cr-step--play' : ''}`
                    }
                    style={on ? { opacity: 0.4 + (v / 127) * 0.6 } : undefined}
                    onClick={() => { selectPad(p); toggleStep(p, s, vel); }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="cr-graph">
        <div className="cr-graph-head">
          GRAPH · {padName(selectedPad)} <span className="cr-lbl">velocity — click/drag</span>
        </div>
        <div className="cr-graph-row">
          <div className="cr-graph-spacer" />
          <div
            className="cr-strip"
            ref={stripRef}
            style={{ gridTemplateColumns: `repeat(${stepsTotal}, 1fr)` }}
            onPointerDown={onStripDown}
          >
            {Array.from({ length: stepsTotal }, (_, s) => {
              const v = grid[selectedPad][s];
              return (
                <div key={s} className={`cr-bar-cell${s % 4 === 0 ? ' cr-step--beat' : ''}`}>
                  {v > 0 && <div className="cr-bar" style={{ height: `${(v / 127) * 100}%` }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
