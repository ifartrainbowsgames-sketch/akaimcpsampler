import { useRef, useCallback } from 'react';
import { guideClick } from '../guide/guideClick';

interface Props {
  value: number;
  onChange(v: number): void;
  label?: string;
  guideId?: string;
}

/** Large encoder — angle drag with gentle sensitivity for touch. */
export function JogWheel({ value, onChange, label, guideId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, angle: 0, v: 0 });

  const angleAt = (cx: number, cy: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.atan2(cy - (r.top + r.height / 2), cx - (r.left + r.width / 2));
  };

  const down = useCallback((e: React.PointerEvent) => {
    if (guideId && guideClick(guideId)) return;
    drag.current = {
      active: true,
      angle: angleAt(e.clientX, e.clientY),
      v: value,
    };
    ref.current?.setPointerCapture(e.pointerId);
  }, [value, guideId]);

  const move = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const a = angleAt(e.clientX, e.clientY);
    let da = a - drag.current.angle;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    drag.current.angle = a;
    // One full turn ≈ 35% of travel — slow, controllable on tablet.
    const next = Math.max(0, Math.min(1, drag.current.v + da / (Math.PI * 2.85)));
    drag.current.v = next;
    onChange(next);
  }, [onChange]);

  const up = useCallback(() => { drag.current.active = false; }, []);

  const rot = -150 + value * 300;

  return (
    <div className="knobwrap">
      <div
        ref={ref}
        className="knob knob-enc"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="slider"
        tabIndex={0}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'jog wheel'}
      >
        <i style={{ transform: `rotate(${rot}deg)` }} />
        <span className="knobtick" />
      </div>
      {label && <div className="knoblabel">{label}</div>}
    </div>
  );
}
