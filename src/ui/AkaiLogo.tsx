/** AKAI professional — matches hardware deck silkscreen. */
export function AkaiLogo({ className }: { className?: string }) {
  return (
    <div className={`akaibrand ${className ?? ''}`} aria-label="AKAI professional">
      <span className="akaibrand__main">AKAI</span>
      <span className="akaibrand__sub">professional</span>
    </div>
  );
}

export function MpcWordmark({ className }: { className?: string }) {
  return (
    <div className={`mpcword ${className ?? ''}`} aria-label="MPC SAMPLE">
      MPC SAMPLE
    </div>
  );
}
