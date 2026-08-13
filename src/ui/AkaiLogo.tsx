/** AKIRA — bold movie-poster style wordmark (original, not the trademarked logo). */
export function AkiraLogo({ className }: { className?: string }) {
  return (
    <div className={`akaibrand ${className ?? ''}`} aria-label="AKIRA">
      <span className="akaibrand__kanji" aria-hidden>赤</span>
      <span className="akaibrand__main">AKIRA</span>
      <span className="akaibrand__sub">neo-tokyo</span>
    </div>
  );
}

export function ProMcpWordmark({ className }: { className?: string }) {
  return (
    <div className={`mpcword ${className ?? ''}`} aria-label="AKIRA PRO MPC">
      <span className="mpcword__year">2019</span>
      <span className="mpcword__label">PRO MPC</span>
    </div>
  );
}
