interface Props {
  midi: number;
  label?: string;
  lit: boolean;
  widthPct: number;
  leftPct: number;
  onPointerDown(e: React.PointerEvent): void;
  onPointerEnter(e: React.PointerEvent): void;
}

export function PianoWhiteKey({ midi, label, lit, widthPct, leftPct, onPointerDown, onPointerEnter }: Props) {
  return (
    <button
      type="button"
      className={`piano-wkey${lit ? ' piano-wkey--lit' : ''}`}
      style={{ width: `${widthPct}%`, left: `${leftPct}%` }}
      data-midi={midi}
      aria-label={label ?? `Note ${midi}`}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
    >
      <span className="piano-wkey__lbl">{label}</span>
    </button>
  );
}
