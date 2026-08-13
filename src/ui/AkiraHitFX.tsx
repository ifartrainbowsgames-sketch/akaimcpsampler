import { useEffect, useRef, useState } from 'react';
import type { AkiraHitVariant } from './akiraHitBus';

/** Speed-line burst + ambient orb pulse — Akira film aesthetic. */
export function AkiraHitFX() {
  const [burst, setBurst] = useState<{ id: number; variant: AkiraHitVariant } | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const onHit = (e: Event) => {
      const variant = (e as CustomEvent<{ variant: AkiraHitVariant }>).detail?.variant ?? 'red';
      idRef.current += 1;
      setBurst({ id: idRef.current, variant });
      window.setTimeout(() => setBurst(null), 450);
    };
    window.addEventListener('akira-hit', onHit);
    return () => window.removeEventListener('akira-hit', onHit);
  }, []);

  return (
    <>
      {burst && (
        <div
          key={burst.id}
          className={`akira-speedflash akira-speedflash--on${burst.variant === 'cyan' ? ' akira-speedflash--cyan' : ''}`}
          aria-hidden
        />
      )}
      <div className="akira-orb-glow" aria-hidden />
    </>
  );
}

/** Capsule gang pill + Neo-Tokyo stamp + hazard stripes (original homage). */
export function AkiraDeckDecor() {
  return (
    <>
      <div className="akira-deck-deco akira-capsule" aria-hidden title="Capsule emblem">
        <div className="akira-capsule__pill">
          <span className="akira-capsule__top">GOOD FOR BEATS</span>
          <span className="akira-capsule__mid" />
          <span className="akira-capsule__bot">BAD FOR SILENCE</span>
        </div>
        <span className="akira-capsule__stamp">NEO-TOKYO · 2019</span>
      </div>
      <div className="akira-deck-deco akira-hazard" aria-hidden>
        <span className="akira-hazard__chev">›</span>
        <span className="akira-hazard__chev">›</span>
        <span className="akira-hazard__chev">›</span>
      </div>
    </>
  );
}
