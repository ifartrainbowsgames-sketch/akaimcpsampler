import { useRef, useCallback, useEffect } from 'react';
import { guideClick } from '../guide/guideClick';

interface Props {
  value: number;
  onChange(v: number): void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  softTakeover?: boolean;
  sensitivity?: number;
  /** Blue position ring like the hardware MAIN VOLUME knob. */
  variant?: 'default' | 'volume';
  guideId?: string;
}

/**
 * Hardware-style soft takeover: the knob ignores movement until the control
 * crosses the stored parameter value, then tracks normally.
 */
export function Knob({
  value,
  onChange,
  size = 'md',
  label,
  sensitivity = 300,
  variant = 'default',
  softTakeover = false,
  guideId,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, y: 0, v: 0 });
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

  const down = useCallback((e: React.PointerEvent) => {
    if (guideId && guideClick(guideId)) return;
    drag.current = { active: true, y: e.clientY, v: value };
    if (!softTakeover) armed.current = true;
    ref.current?.setPointerCapture(e.pointerId);
  }, [value, softTakeover, guideId]);

  const move = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dy = drag.current.y - e.clientY;
    const next = Math.max(0, Math.min(1, drag.current.v + dy / sensitivity));
    if (softTakeover && !armed.current) {
      if (Math.abs(next - value) < 0.04) armed.current = true;
      else return;
    }
    onChange(next);
  }, [onChange, sensitivity, softTakeover, value]);

  const up = useCallback(() => { drag.current.active = false; }, []);

  const angle = -150 + value * 300;
  const showArrow = softTakeover && !armed.current;

  return (
    <div className="knobwrap">
      <div
        ref={ref}
        className={`knob knob-${size}${variant === 'volume' ? ' knob--vol' : ''}${showArrow ? ' knob--takeover' : ''}`}
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
        {showArrow && <span className="knob-arrow">◀▶</span>}
      </div>
      {label && <div className="knoblabel">{label}</div>}
    </div>
  );
}
