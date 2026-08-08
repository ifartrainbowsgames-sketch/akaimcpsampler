import { useRef, useCallback } from 'react';

interface Props {
  value: number;
  onChange(v: number): void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  softTakeover?: boolean;
  sensitivity?: number;
  /** Blue position ring like the hardware MAIN VOLUME knob. */
  variant?: 'default' | 'volume';
}

export function Knob({ value, onChange, size = 'md', label, sensitivity = 300, variant = 'default' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, y: 0, v: 0 });

  const down = useCallback((e: React.PointerEvent) => {
    drag.current = { active: true, y: e.clientY, v: value };
    ref.current?.setPointerCapture(e.pointerId);
  }, [value]);

  const move = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dy = drag.current.y - e.clientY;
    const next = Math.max(0, Math.min(1, drag.current.v + dy / sensitivity));
    onChange(next);
  }, [onChange]);

  const up = useCallback(() => { drag.current.active = false; }, []);

  const angle = -150 + value * 300;

  return (
    <div className="knobwrap">
      <div
        ref={ref}
        className={`knob knob-${size}${variant === 'volume' ? ' knob--vol' : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="slider"
        tabIndex={0}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'knob'}
      >
        <i style={{ transform: `rotate(${angle}deg)` }} />
        {variant === 'volume' && (
          <span className="knob-blue" style={{ transform: `rotate(${angle}deg)` }} />
        )}
        <span className="knobtick" />
      </div>
      {label && <div className="knoblabel">{label}</div>}
    </div>
  );
}
