import { gsap } from 'gsap';
import { burstSpeedLines } from '../akiraWallpaperAnim';

export interface AkiraEnvRefs {
  root: HTMLElement;
  bg: HTMLElement;
  atmo: HTMLElement;
  neon: HTMLElement;
  branding?: HTMLElement | null;
  bike: HTMLElement;
  grain: HTMLElement;
  speedHost: HTMLElement;
}

/** Ambient GSAP — slow parallax, neon flicker, bike depth. */
export function mountAkiraEnvironmentAnim(refs: AkiraEnvRefs): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return () => undefined;

  let cleanup: (() => void) | undefined;

  const ctx = gsap.context(() => {
    // Slow background drift
    gsap.to(refs.bg, {
      y: -12,
      scale: 1.04,
      duration: 28,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    // Atmospheric haze pulse
    gsap.to(refs.atmo, {
      opacity: 0.92,
      duration: 6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    // Irregular neon flicker
    const flickerNeon = () => {
      gsap.timeline()
        .to(refs.neon, { opacity: 0.55, duration: 0.05 })
        .to(refs.neon, { opacity: 1, duration: 0.08 })
        .to(refs.neon, { opacity: 0.75, duration: 0.04 })
        .to(refs.neon, { opacity: 1, duration: 0.12 });
    };
    gsap.timeline({ repeat: -1 })
      .call(flickerNeon)
      .to({}, { duration: 4 + Math.random() * 6 });

    // Bike subtle hover — NOT flying around
    gsap.to(refs.bike, {
      y: -6,
      duration: 3.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    // Pointer parallax (desktop)
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      gsap.to(refs.bg, { x: nx * -8, y: ny * -4, duration: 1.2, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(refs.bike, { x: nx * 14, y: ny * 6, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
      if (refs.branding) {
        gsap.to(refs.branding, { x: nx * -6, duration: 1, ease: 'power2.out', overwrite: 'auto' });
      }
    };

    const onHit = () => {
      burstSpeedLines(refs.speedHost, 14, 1);
      gsap.fromTo(refs.bike, { filter: 'brightness(1.35)' }, { filter: 'brightness(1)', duration: 0.5 });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('akira-hit', onHit);
    cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('akira-hit', onHit);
    };
  }, refs.root);

  return () => {
    cleanup?.();
    ctx.revert();
  };
}

export interface AkiraIntroRefs {
  curtain: HTMLElement;
  sysline: HTMLElement;
  env: HTMLElement;
  neon: HTMLElement;
  content: HTMLElement;
  bike: HTMLElement;
}

/** Short boot intro — skippable via early interaction. */
export function runAkiraIntro(refs: AkiraIntroRefs): gsap.core.Timeline {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    gsap.set([refs.curtain, refs.sysline], { autoAlpha: 0 });
    gsap.set([refs.env, refs.neon, refs.content, refs.bike], { autoAlpha: 1 });
    return gsap.timeline();
  }

  gsap.set(refs.env, { autoAlpha: 0 });
  gsap.set(refs.neon, { autoAlpha: 0, filter: 'brightness(0.2)' });
  gsap.set(refs.content, { autoAlpha: 0, y: 24 });
  gsap.set(refs.bike, { autoAlpha: 0, x: 40 });
  gsap.set(refs.sysline, { autoAlpha: 0 });
  gsap.set(refs.curtain, { autoAlpha: 1 });

  return gsap.timeline({ defaults: { ease: 'power2.out' } })
    .to(refs.sysline, { autoAlpha: 1, duration: 0.35 }, 0.2)
    .to(refs.sysline, { autoAlpha: 0, duration: 0.25 }, 1.1)
    .to(refs.curtain, { autoAlpha: 0, duration: 0.6 }, 0.9)
    .to(refs.env, { autoAlpha: 1, duration: 1.1 }, 0.85)
    .to(refs.neon, { autoAlpha: 1, filter: 'brightness(1)', duration: 0.7, ease: 'power3.out' }, 1.5)
    .to(refs.content, { autoAlpha: 1, y: 0, duration: 0.65 }, 1.65)
    .to(refs.bike, { autoAlpha: 1, x: 0, duration: 0.9, ease: 'power3.out' }, 1.75);
}

/** MPC panel subtle entrance after boot. */
export function runMpcEntrance(unit: HTMLElement, lcd?: HTMLElement | null): gsap.core.Timeline {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return gsap.timeline();

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.from(unit, { autoAlpha: 0, y: 28, scale: 0.985, duration: 0.75 });
  if (lcd) {
    tl.from(lcd, { filter: 'brightness(0.3)', duration: 0.4 }, '-=0.35')
      .to(lcd, { filter: 'brightness(1)', duration: 0.55, ease: 'steps(4)' });
  }
  return tl;
}
