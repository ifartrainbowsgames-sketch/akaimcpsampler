import { AKIRA_ASSETS } from './akiraAssets';

/** Layer 6 — subtle film grain (image tile, not CSS noise over controls). */
export function FilmGrain() {
  return (
    <div className="film-grain" aria-hidden>
      <img src={AKIRA_ASSETS.grain} alt="" decoding="async" loading="lazy" draggable={false} />
    </div>
  );
}
