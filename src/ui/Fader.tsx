import { useRef, useCallback, useEffect } from 'react';
import { guideClick } from '../guide/guideClick';

interface Props {
  value: number; // 0..1
  onChange(v: number): void;
  label?: string;
  softTakeover?: boolean;
  /** Centre-bright curve for Pan/Tune. */
  centreBright?: boolean;
  enabled?: boolean;
  guideId?: string;
}

export function Fader({
  value,
  onChange,
  label = 'FADER',
  softTakeover = false,
  centreBright = false,
  enabled = true,
  guideId,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const armed = useRef(!softTakeover);
  const lastValue = useRef(value);

  useEffect(() => {
    if (!softTakeover) {
      armed.current = true;
      return;
    }
    if (Math.abs(value - lastValue.current) > 0.02) {
      armed.current = false;
    }
    lastValue.current = value;
  }, [value, softTakeover]);

  const set = useCallback((clientY: number) => {
    const el = ref.current;
    if (!el || !enabled) return;
    const r = el.getBoundingClientRect();
    const pct = 1 - (clientY - r.top) / r.height;
    const next = Math.max(0, Math.min(1, pct));
    if (softTakeover && !armed.current) {
      if (Math.abs(next - value) < 0.04) armed.current = true;
      else return;
    }
    onChange(next);
  }, [onChange, enabled, softTakeover, value]);

  const down = (e: React.PointerEvent) => {
    if (guideId && guideClick(guideId)) return;
    if (!enabled) return;
    dragging.current = true;
    ref.current?.setPointerCapture(e.pointerId);
    set(e.clientY);
  };
  const move = (e: React.PointerEvent) => { if (dragging.current) set(e.clientY); };
  const up = () => { dragging.current = false; };

  const ledOpacity = centreBright
    ? 0.25 + (1 - Math.abs(value - 0.5) * 2) * 0.75
    : 0.25 + value * 0.75;

  return (
    <div className={`faderwrap${!enabled ? ' faderwrap--off' : ''}`}>
      <div className="faderled" style={{ opacity: ledOpacity }} />
      <div
        ref={ref}
        className={`fader${softTakeover && !armed.current ? ' fader--takeover' : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="slider"
        tabIndex={0}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        aria-disabled={!enabled}
      >
        <div className="slot" />
        <div className="knobcap" style={{ bottom: `${5 + value * 77}%` }} />
      </div>
      <div className="legend">{label}</div>
    </div>
  );
}
