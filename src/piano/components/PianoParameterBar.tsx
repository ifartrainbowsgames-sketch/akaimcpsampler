interface Props {
  label: string;
  value: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
}

/** FL Studio-style horizontal parameter bar. */
export function PianoParameterBar({ label, value, onChange, min = 0, max = 100 }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const norm = pct / 100;

  const setFromClientX = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange(Math.round(min + x * (max - min)));
  };

  return (
    <div className="piano-param">
      <div className="piano-param__label">{label}</div>
      <div
        className="piano-param__track"
        role="slider"
        tabIndex={0}
        aria-valuenow={pct}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={`${label} ${pct}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientX(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            setFromClientX(e.clientX, e.currentTarget);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(max, pct + 1));
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(min, pct - 1));
        }}
      >
        <div className="piano-param__fill" style={{ width: `${norm * 100}%` }} />
      </div>
      <div className="piano-param__val">{pct}{max === 100 ? '%' : ''}</div>
    </div>
  );
}
