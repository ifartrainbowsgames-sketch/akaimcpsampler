import { forwardRef } from 'react';

/** Layer 3 — restrained Japanese neon signage (occasional GSAP flicker). */
export const NeonSign = forwardRef<HTMLElement, { className?: string }>(function NeonSign(
  { className },
  ref,
) {
  return (
    <aside ref={ref} className={`neon-sign ${className ?? ''}`} aria-hidden>
      <span className="neon-sign__line neon-sign__line--jp">ネオ東京</span>
      <span className="neon-sign__line neon-sign__line--en">NEO-TOKYO</span>
      <span className="neon-sign__line neon-sign__line--warn">警告</span>
    </aside>
  );
});
