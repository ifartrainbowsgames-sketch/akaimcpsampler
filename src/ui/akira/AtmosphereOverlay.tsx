import { AKIRA_ASSETS } from './akiraAssets';

/** Layer 2 — atmospheric overlay image (vignette/haze baked in, not CSS gradients). */
export function AtmosphereOverlay({ className }: { className?: string }) {
  return (
    <div className={`atmo ${className ?? ''}`} aria-hidden>
      <img
        className="atmo__img"
        src={AKIRA_ASSETS.cityOverlay}
        alt=""
        decoding="async"
        loading="eager"
        draggable={false}
      />
    </div>
  );
}
