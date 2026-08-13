/** AKIRA — original neon wordmark (Akira-inspired, not a trademarked mark). */
export function AkiraLogo({ className }: { className?: string }) {
  return (
    <div className={`akaibrand ${className ?? ''}`} aria-label="AKIRA">
      <span className="akaibrand__main">AKIRA</span>
      <span className="akaibrand__sub">pro</span>
    </div>
  );
}

export function ProMcpWordmark({ className }: { className?: string }) {
  return (
    <div className={`mpcword ${className ?? ''}`} aria-label="AKIRA PRO MCP">
      AKIRA PRO MCP
    </div>
  );
}
