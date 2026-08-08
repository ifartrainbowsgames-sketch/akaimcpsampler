import { useRef } from 'react';

interface Props {
  label: string;
  value: number;
  onChange(v: number): void;
}

/** Hardware-style LCD foot slider — flat bar with grey fill, not a native range input. */
export function HwSlider({ label, value, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null);

  const setFromEvent = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const n = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange(n);
  };

  return (
    <div className="footcell">
      <span>{label}</span>
      <div
        ref={track}
        className="hwslider"
        role="slider"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        onPointerDown={(e) => {
          track.current?.setPointerCapture(e.pointerId);
          setFromEvent(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) setFromEvent(e.clientX);
        }}
      >
        <i style={{ width: `${Math.max(4, value * 100)}%` }} />
      </div>
    </div>
  );
}
