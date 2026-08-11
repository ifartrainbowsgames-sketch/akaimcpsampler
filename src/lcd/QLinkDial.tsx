import { useCallback, useRef } from 'react';
import type { KParam } from './pages';

/**
 * MPC Q-Link style arc dial: a ring that fills MPC-red from 0→value across a
 * −150°..+150° sweep, with the param name above and its live display value
 * below. Vertical pointer-drag changes the value (same feel as Knob.tsx).
 */
function QLinkDial({
  param,
  onChange,
}: {
  param: KParam | undefined;
  onChange(p: KParam, v: number): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, y: 0, v: 0 });

  const value = param?.norm ?? 0;
  const empty = !param || param.name === '—';

  const down = useCallback((e: React.PointerEvent) => {
    if (empty || !param) return;
    drag.current = { active: true, y: e.clientY, v: param.norm };
    ref.current?.setPointerCapture(e.pointerId);
  }, [empty, param]);

  const move = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active || !param) return;
    const dy = drag.current.y - e.clientY;
    const next = Math.max(0, Math.min(1, drag.current.v + dy / 320));
    onChange(param, next);
  }, [onChange, param]);

  const up = useCallback(() => { drag.current.active = false; }, []);

  const angle = -150 + value * 300;

  return (
    <div className={`qlink${empty ? ' qlink--empty' : ''}`}>
      <div className="qlink__name">{param?.name ?? '—'}</div>
      <div
        ref={ref}
        className="qlink__dial"
        style={{ ['--fill' as string]: `${value * 300}deg` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="slider"
        tabIndex={0}
        aria-label={param?.name ?? 'unassigned'}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="qlink__cap">
          <i style={{ transform: `rotate(${angle}deg)` }} />
        </span>
      </div>
      <div className="qlink__val">{param ? param.display : '—'}</div>
    </div>
  );
}

/** The three-across Q-Link strip at the bottom of the LCD. */
export function QLinkStrip({
  params,
  onChange,
}: {
  params: KParam[];
  onChange(p: KParam, v: number): void;
}) {
  return (
    <div className="qlinkstrip">
      {[0, 1, 2].map((i) => (
        <QLinkDial key={i} param={params[i]} onChange={onChange} />
      ))}
    </div>
  );
}
