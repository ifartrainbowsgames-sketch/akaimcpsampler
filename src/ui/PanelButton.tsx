import { emitAkiraHit, flashElement, type AkiraHitVariant } from './akiraHitBus';
import type { PointerEvent as ReactPointerEvent } from 'react';

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

function neonVariant(colour: 'grey' | 'orange' | 'blue'): AkiraHitVariant {
  if (colour === 'blue') return 'cyan';
  if (colour === 'orange') return 'orange';
  return 'red';
}

export function PanelButton({
  label, sub, colour = 'grey', lit, htmlFor, onClick, onPointerDown, onPointerUp, onPointerLeave,
}: Props) {
  const className = `pb ${colour} ${lit ? 'lit' : ''}`;

  const onDown = (e: ReactPointerEvent<HTMLButtonElement | HTMLLabelElement>) => {
    const v = neonVariant(colour);
    flashElement(e.currentTarget, v);
    emitAkiraHit(v);
    onPointerDown?.();
  };

  const body = (
    <>
      <span className="cap">{label}</span>
      <span className="sub">{sub ?? '\u00a0'}</span>
    </>
  );

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={className} onPointerDown={onDown}>
        {body}
      </label>
    );
  }

  return (
    <button
      className={className}
      onClick={onClick}
      onPointerDown={onDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      type="button"
    >
      {body}
    </button>
  );
}
