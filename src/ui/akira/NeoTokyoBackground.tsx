import { AKIRA_ASSETS } from './akiraAssets';

/** Layer 1 — responsive Neo-Tokyo night background (real image, not CSS art). */
export function NeoTokyoBackground({ className }: { className?: string }) {
  return (
    <div className={`neo-bg ${className ?? ''}`} aria-hidden>
      <picture>
        <source media="(max-width: 768px)" srcSet={AKIRA_ASSETS.bgMobile} type="image/webp" />
        <source media="(min-width: 769px)" srcSet={AKIRA_ASSETS.bgDesktop} type="image/webp" />
        <img
          className="neo-bg__img"
          src={AKIRA_ASSETS.bgFallback}
          alt=""
          decoding="async"
          fetchPriority="high"
        />
      </picture>
    </div>
  );
}
