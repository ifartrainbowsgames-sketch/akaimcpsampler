import { useEffect, useRef } from 'react';
import { flashSpeedLinesImage } from './akira/akiraHitImages';

/** Hit feedback — image-based speed lines only (no CSS conic gradients / orb glow). */
export function AkiraHitFX() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onHit = () => flashSpeedLinesImage(host, 1.1);
    window.addEventListener('akira-hit', onHit);
    return () => window.removeEventListener('akira-hit', onHit);
  }, []);

  return <div ref={hostRef} className="akira-hit-host" aria-hidden />;
}
