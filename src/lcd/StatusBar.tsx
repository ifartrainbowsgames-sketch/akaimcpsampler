import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { TICKS_PER_BEAT } from '../audio/types';
import { ticksPerBar } from '../audio/scheduler';

/**
 * MPC-style top status strip: transport state, project name, a large tap-tempo
 * BPM readout, time signature, and a live bar.beat.tick position counter.
 * Polls engine telemetry on its own throttled rAF so only this strip re-renders
 * while the transport runs.
 */
export function StatusBar() {
  const name = useStore((s) => s.project.name);
  const bpm = useStore((s) => s.project.bpm);
  const timeSignature = useStore((s) => s.project.timeSignature);
  const bank = useStore((s) => s.bank);
  const seqSlot = useStore((s) => s.seqSlot);
  const bars = useStore((s) => s.project.sequences[bank][seqSlot].bars);
  const tapTempo = useStore((s) => s.tapTempo);

  const [pos, setPos] = useState('001.1.1');
  const [state, setState] = useState<'idle' | 'play' | 'rec'>('idle');

  useEffect(() => {
    const barTicks = ticksPerBar(timeSignature);
    const loopLen = Math.max(1, bars * barTicks);
    const beatDiv = TICKS_PER_BEAT / 4; // 16th-note subdivision
    let raf = 0;
    let last = 0;
    let lastPos = '';
    let lastState: 'idle' | 'play' | 'rec' | '' = '';
    const loop = (t: number) => {
      if (t - last >= 60) {
        last = t;
        const tel = engine.telemetry;
        const p = ((tel.positionTicks % loopLen) + loopLen) % loopLen;
        const bar = Math.floor(p / barTicks) + 1;
        const inBar = p % barTicks;
        const beat = Math.floor(inBar / TICKS_PER_BEAT) + 1;
        const tick = Math.floor((inBar % TICKS_PER_BEAT) / beatDiv) + 1;
        const str = `${String(bar).padStart(3, '0')}.${beat}.${tick}`;
        if (str !== lastPos) { lastPos = str; setPos(str); }
        const st = tel.recording ? 'rec' : tel.playing ? 'play' : 'idle';
        if (st !== lastState) { lastState = st; setState(st); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [timeSignature, bars]);

  return (
    <div className="lcd-status">
      <span className={`lcd-status__dot lcd-status__dot--${state}`} aria-label={state}>
        {state === 'rec' ? '●' : state === 'play' ? '▶' : '■'}
      </span>
      <span className="lcd-status__name">{name}</span>
      <button
        type="button"
        className="lcd-status__bpm"
        onClick={() => tapTempo()}
        title="Tap tempo"
      >
        <b>{bpm.toFixed(1)}</b>
        <small>BPM</small>
      </button>
      <span className="lcd-status__sig">{timeSignature[0]}/{timeSignature[1]}</span>
      <span className="lcd-status__pos">{pos}</span>
    </div>
  );
}
