/** Layer 2 — dark readibility overlay + Neo-Tokyo ambient lighting (CSS only). */
export function AtmosphereOverlay({ className }: { className?: string }) {
  return (
    <div className={`atmo ${className ?? ''}`} aria-hidden>
      <div className="atmo__vignette" />
      <div className="atmo__haze" />
      <div className="atmo__redwash" />
    </div>
  );
}
