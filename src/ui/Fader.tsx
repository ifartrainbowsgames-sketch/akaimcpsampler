import { useRef, useCallback } from 'react';

interface Props {
  value: number; // 0..1
  onChange(v: number): void;
  label?: string;
}

export function Fader({ value, onChange, label = 'FADER' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const set = useCallback((clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = 1 - (clientY - r.top) / r.height;
    onChange(Math.max(0, Math.min(1, pct)));
  }, [onChange]);

  const down = (e: React.PointerEvent) => {
    dragging.current = true;
    ref.current?.setPointerCapture(e.pointerId);
    set(e.clientY);
  };
  const move = (e: React.PointerEvent) => { if (dragging.current) set(e.clientY); };
  const up = () => { dragging.current = false; };

  return (
    <div className="faderwrap">
      {/* Brightness tracks the parameter value, as on the hardware. */}
      <div className="faderled" style={{ opacity: 0.25 + value * 0.75 }} />
      <div
        ref={ref}
        className="fader"
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
      >
        <div className="slot" />
        <div className="knobcap" style={{ bottom: `${5 + value * 77}%` }} />
      </div>
      <div className="legend">{label}</div>
    </div>
  );
}
