/** Broadcast pad/button hits for shared Akira VFX (speed lines, chassis pulse). */
export type AkiraHitVariant = 'red' | 'cyan' | 'orange';

export function emitAkiraHit(variant: AkiraHitVariant = 'red') {
  window.dispatchEvent(new CustomEvent('akira-hit', { detail: { variant } }));
}

export function flashElement(el: HTMLElement | null, variant: AkiraHitVariant = 'red') {
  if (!el) return;
  el.classList.remove('neon-flash', 'neon-flash--red', 'neon-flash--cyan', 'neon-flash--orange');
  void el.offsetWidth;
  el.classList.add('neon-flash', `neon-flash--${variant}`);
  window.setTimeout(() => {
    el.classList.remove('neon-flash', 'neon-flash--red', 'neon-flash--cyan', 'neon-flash--orange');
  }, 420);
}
