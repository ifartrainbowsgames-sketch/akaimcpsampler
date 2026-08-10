interface Props {
  midi: number;
  lit: boolean;
  widthPct: number;
  leftPct: number;
  onPointerDown(e: React.PointerEvent): void;
  onPointerEnter(e: React.PointerEvent): void;
}

export function PianoBlackKey({ midi, lit, widthPct, leftPct, onPointerDown, onPointerEnter }: Props) {
  return (
    <button
      type="button"
      className={`piano-bkey${lit ? ' piano-bkey--lit' : ''}`}
      style={{ width: `${widthPct}%`, left: `${leftPct}%` }}
      data-midi={midi}
      aria-label={`Sharp note ${midi}`}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
    />
  );
}
