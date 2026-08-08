interface Props {
  label: string;
  sub?: string;
  colour?: 'grey' | 'orange' | 'blue';
  lit?: boolean;
  htmlFor?: string;
  onClick?(): void;
  onPointerDown?(): void;
  onPointerUp?(): void;
  onPointerLeave?(): void;
}

export function PanelButton({
  label, sub, colour = 'grey', lit, htmlFor, onClick, onPointerDown, onPointerUp, onPointerLeave,
}: Props) {
  const className = `pb ${colour} ${lit ? 'lit' : ''}`;
  const body = (
    <>
      <span className="cap">{label}</span>
      <span className="sub">{sub ?? '\u00a0'}</span>
    </>
  );

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={className}>
        {body}
      </label>
    );
  }

  return (
    <button
      className={className}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      type="button"
    >
      {body}
    </button>
  );
}
