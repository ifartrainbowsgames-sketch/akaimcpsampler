interface Props {
  label: string;
  sub?: string;
  colour?: 'grey' | 'orange' | 'blue';
  lit?: boolean;
  onClick?(): void;
  onPointerDown?(): void;
  onPointerUp?(): void;
}

export function PanelButton({
  label, sub, colour = 'grey', lit, onClick, onPointerDown, onPointerUp,
}: Props) {
  return (
    <button
      className={`pb ${colour} ${lit ? 'lit' : ''}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      type="button"
    >
      <span className="cap">{label}</span>
      <span className="sub">{sub ?? '\u00a0'}</span>
    </button>
  );
}
