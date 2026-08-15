import { forwardRef } from 'react';
import { AKIRA_ASSETS } from './akiraAssets';

/** Layer 5 — Kaneda-style red bike as a transparent image (never CSS/SVG art). */
export const BikeForeground = forwardRef<HTMLDivElement>(function BikeForeground(_, ref) {
  return (
    <div ref={ref} className="bike-fg" aria-hidden>
      <picture>
        <source srcSet={AKIRA_ASSETS.bike} type="image/webp" />
        <img
          className="bike-fg__img"
          src={AKIRA_ASSETS.bikeFallback}
          alt=""
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      </picture>
      <div className="bike-fg__glow" />
    </div>
  );
});
