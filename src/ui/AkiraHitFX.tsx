import { useEffect, useRef, useState } from 'react';
import type { AkiraHitVariant } from './akiraHitBus';

/** Full-screen anime speed-line burst on pad/button hits. */
export function AkiraHitFX() {
  const [burst, setBurst] = useState<{ id: number; variant: AkiraHitVariant } | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const onHit = (e: Event) => {
      const variant = (e as CustomEvent<{ variant: AkiraHitVariant }>).detail?.variant ?? 'red';
      idRef.current += 1;
      setBurst({ id: idRef.current, variant });
      window.setTimeout(() => setBurst(null), 400);
    };
    window.addEventListener('akira-hit', onHit);
    return () => window.removeEventListener('akira-hit', onHit);
  }, []);

  if (!burst) return null;

  return (
    <div
      key={burst.id}
      className={`akira-speedflash akira-speedflash--on${burst.variant === 'cyan' ? ' akira-speedflash--cyan' : ''}`}
      aria-hidden
    />
  );
}

/** Capsule pill, katakana, barcode — original Akira-inspired deck chrome. */
export function AkiraDeckDecor() {
  return (
    <>
      <div className="akira-deck-deco akira-capsule" aria-hidden>
        <span className="akira-capsule__dot" />
        <span>NEO-TOKYO</span>
      </div>
      <div className="akira-deck-deco akira-katakana" aria-hidden>ネオ東京</div>
      <div className="akira-deck-deco akira-barcode" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ height: `${40 + (i * 17) % 60}%` }} />
        ))}
      </div>
    </>
  );
}
