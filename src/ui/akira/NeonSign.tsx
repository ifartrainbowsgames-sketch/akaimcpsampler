import { forwardRef } from 'react';
import { AKIRA_ASSETS } from './akiraAssets';

/** Layer 3 — neon signage as image artwork (not CSS text). */
export const NeonSign = forwardRef<HTMLElement, { className?: string }>(function NeonSign(
  { className },
  ref,
) {
  return (
    <aside ref={ref} className={`neon-sign ${className ?? ''}`} aria-hidden>
      <img
        className="neon-sign__img"
        src={AKIRA_ASSETS.neonSign}
        alt=""
        decoding="async"
        loading="lazy"
        draggable={false}
      />
    </aside>
  );
});
