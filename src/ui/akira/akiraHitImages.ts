import { gsap } from 'gsap';
import { AKIRA_ASSETS } from './akiraAssets';

/** Flash pre-rendered speed-lines image on pad/button hits (not CSS-drawn lines). */
export function flashSpeedLinesImage(host: HTMLElement, power = 1) {
  const img = document.createElement('img');
  img.className = 'akira-hit-speedlines';
  img.src = AKIRA_ASSETS.speedLines;
  img.alt = '';
  img.draggable = false;
  host.appendChild(img);

  gsap.fromTo(
    img,
    { opacity: 0, scale: 0.75 * power, rotation: -4 + Math.random() * 8 },
    {
      opacity: 0.9,
      scale: 1.05 * power,
      duration: 0.1,
      ease: 'power2.out',
    },
  );
  gsap.to(img, {
    opacity: 0,
    scale: 1.15 * power,
    duration: 0.38,
    delay: 0.06,
    ease: 'power2.in',
    onComplete: () => img.remove(),
  });
}
