import { gsap } from 'gsap';

export interface AkiraWallpaperRefs {
  root: HTMLElement;
  field: HTMLElement;
  crack: HTMLElement;
  bike: HTMLElement;
  headlight: HTMLElement;
  rider: HTMLElement;
  pill: HTMLElement;
  katakana: HTMLElement;
  speedHost: HTMLElement;
}

/** Spawn a burst of anime speed-line streaks. */
export function burstSpeedLines(host: HTMLElement, count = 14, power = 1) {
  const frag = document.createDocumentFragment();
  const lines: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'akira-wp__speedline';
    const angle = -90 + (Math.random() - 0.5) * 120;
    const len = 40 + Math.random() * 90 * power;
    el.style.setProperty('--a', `${angle}deg`);
    el.style.setProperty('--len', `${len}px`);
    el.style.left = `${20 + Math.random() * 60}%`;
    el.style.top = `${15 + Math.random() * 55}%`;
    frag.appendChild(el);
    lines.push(el);
  }
  host.appendChild(frag);

  gsap.fromTo(
    lines,
    { scaleX: 0, opacity: 0.95 },
    {
      scaleX: 1,
      opacity: 0,
      duration: 0.35 + Math.random() * 0.2,
      stagger: 0.012,
      ease: 'power2.out',
      onComplete: () => lines.forEach((l) => l.remove()),
    },
  );
}

/** Ambient + reactive GSAP timeline for the poster-style live wallpaper. */
export function mountAkiraWallpaperAnim(refs: AkiraWallpaperRefs): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return () => undefined;

  let cleanupListeners: (() => void) | undefined;

  const ctx = gsap.context(() => {
    gsap.set(refs.rider, { y: 40, opacity: 0 });
    gsap.set(refs.bike, { y: -20, opacity: 0 });
    gsap.set(refs.katakana, { scale: 1.15, opacity: 0 });

    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro
      .to(refs.field, { opacity: 1, duration: 0.8 }, 0)
      .to(refs.katakana, { opacity: 0.14, scale: 1, duration: 1.4 }, 0.1)
      .to(refs.bike, { opacity: 1, y: 0, duration: 1.1 }, 0.15)
      .to(refs.rider, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, 0.35);

    // --- Ambient loop: bike hover, headlight pulse, rider walk cycle ---
    gsap.to(refs.bike, {
      y: 6,
      duration: 2.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: 1.2,
    });

    gsap.to(refs.headlight, {
      opacity: 0.45,
      scale: 1.25,
      duration: 0.55,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: 1.2,
    });

    // Walk toward the bike — scale shrinks + moves up (poster perspective)
    gsap.to(refs.rider, {
      y: -48,
      scale: 0.88,
      duration: 9,
      repeat: -1,
      yoyo: true,
      ease: 'none',
      delay: 1.5,
    });

    // Capsule pill subtle wobble
    gsap.to(refs.pill, {
      rotation: 3,
      duration: 1.6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      transformOrigin: '50% 50%',
    });

    // Katakana brush stroke flicker (psychic energy)
    gsap.to(refs.katakana, {
      opacity: 0.22,
      duration: 2.2,
      repeat: -1,
      yoyo: true,
      ease: 'steps(3)',
      delay: 0.5,
    });

    // Crack line shimmer
    gsap.to(refs.crack, {
      opacity: 0.55,
      duration: 3.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    // Periodic speed-line wisps
    gsap.timeline({ repeat: -1, delay: 2.5 })
      .call(() => burstSpeedLines(refs.speedHost, 6, 0.6))
      .to({}, { duration: 4.5 });

    // --- Pointer parallax + hit reactions ---
    const onHit = () => {
      burstSpeedLines(refs.speedHost, 18, 1.2);
      gsap.timeline()
        .to(refs.bike, { x: '+=18', duration: 0.07, ease: 'power4.in' })
        .to(refs.bike, { x: '-=18', duration: 0.25, ease: 'elastic.out(1, 0.35)' });
      gsap.to(refs.headlight, { scale: 2, opacity: 1, duration: 0.12, yoyo: true, repeat: 1 });
      gsap.to(refs.rider, { y: '-=12', duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' });
      gsap.fromTo(
        refs.katakana,
        { opacity: 0.35, scale: 1.04 },
        { opacity: 0.12, scale: 1, duration: 0.8, ease: 'power2.out' },
      );
    };

    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      gsap.to(refs.bike, { x: nx * 10, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(refs.rider, { x: nx * 6, duration: 0.7, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(refs.katakana, { x: nx * -14, y: ny * -8, duration: 1, ease: 'power2.out', overwrite: 'auto' });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('akira-hit', onHit);

    cleanupListeners = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('akira-hit', onHit);
    };
  }, refs.root);

  return () => {
    cleanupListeners?.();
    ctx.revert();
  };
}
