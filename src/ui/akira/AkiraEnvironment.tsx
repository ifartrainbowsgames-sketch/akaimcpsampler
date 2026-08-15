import { useEffect, useRef, type RefObject } from 'react';
import { NeoTokyoBackground } from './NeoTokyoBackground';
import { AtmosphereOverlay } from './AtmosphereOverlay';
import { NeonSign } from './NeonSign';
import { BikeForeground } from './BikeForeground';
import { FilmGrain } from './FilmGrain';
import { mountAkiraEnvironmentAnim } from './akiraEnvironmentAnim';
import { flashSpeedLinesImage } from './akiraHitImages';
import '../akira-environment.css';

interface AkiraEnvironmentProps {
  brandingRef?: RefObject<HTMLElement | null>;
  showBike?: boolean;
  className?: string;
}

/**
 * Full AKIRA (1988) environment — image layers only for scenery.
 * CSS is used for layout/positioning/effects on images, never to draw artwork.
 */
export function AkiraEnvironment({ brandingRef, showBike = true, className }: AkiraEnvironmentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const atmoRef = useRef<HTMLDivElement>(null);
  const neonRef = useRef<HTMLElement>(null);
  const bikeRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const speedHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const bg = bgRef.current;
    const atmo = atmoRef.current;
    const neon = neonRef.current;
    const bike = bikeRef.current;
    const grain = grainRef.current;
    const speedHost = speedHostRef.current;
    if (!root || !bg || !atmo || !neon || !bike || !grain || !speedHost) return;

    return mountAkiraEnvironmentAnim({
      root,
      bg,
      atmo,
      neon,
      branding: brandingRef?.current ?? null,
      bike,
      grain,
      speedHost,
    });
  }, [brandingRef]);

  useEffect(() => {
    const onHit = () => {
      if (speedHostRef.current) flashSpeedLinesImage(speedHostRef.current, 0.85);
    };
    window.addEventListener('akira-hit', onHit);
    return () => window.removeEventListener('akira-hit', onHit);
  }, []);

  return (
    <div ref={rootRef} className={`akira-env ${className ?? ''}`} aria-hidden="true">
      <div ref={bgRef} className="akira-env__bg-wrap">
        <NeoTokyoBackground />
      </div>
      <div ref={atmoRef}>
        <AtmosphereOverlay />
      </div>
      <NeonSign ref={neonRef} />
      <div ref={speedHostRef} className="akira-env__speedhost" />
      {showBike && <BikeForeground ref={bikeRef} />}
      <div ref={grainRef}>
        <FilmGrain />
      </div>
    </div>
  );
}

export { AkiraEnvironment as AkiraBackground };
