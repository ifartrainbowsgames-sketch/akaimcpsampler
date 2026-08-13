import { useEffect, useRef } from 'react';
import './akira-bg.css';
import { burstSpeedLines, mountAkiraWallpaperAnim } from './akiraWallpaperAnim';

/**
 * AKIRA-inspired live wallpaper — poster composition animated with GSAP.
 *
 * Original homage art: stark white field, red bike, rider walking toward it,
 * capsule pill on the jacket, brushstroke katakana, speed-line bursts on hits.
 * Optional image at public/akira/wallpaper.* sits beneath as a soft texture.
 */

const WALLPAPER_SRCS = ['/akira/wallpaper.jpg', '/akira/wallpaper.png', '/akira/wallpaper.webp'];

export function AkiraBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const crackRef = useRef<HTMLDivElement>(null);
  const bikeRef = useRef<HTMLDivElement>(null);
  const headlightRef = useRef<HTMLDivElement>(null);
  const riderRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const katakanaRef = useRef<HTMLDivElement>(null);
  const speedHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // GSAP poster scene
  useEffect(() => {
    const root = rootRef.current;
    const field = fieldRef.current;
    const crack = crackRef.current;
    const bike = bikeRef.current;
    const headlight = headlightRef.current;
    const rider = riderRef.current;
    const pill = pillRef.current;
    const katakana = katakanaRef.current;
    const speedHost = speedHostRef.current;
    if (!root || !field || !crack || !bike || !headlight || !rider || !pill || !katakana || !speedHost) return;

    return mountAkiraWallpaperAnim({
      root, field, crack, bike, headlight, rider, pill, katakana, speedHost,
    });
  }, []);

  // Light rain + optional image texture on canvas (cheap overlay)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, raf = 0;
    let bg: HTMLImageElement | null = null;

    (function tryLoad(i: number) {
      if (i >= WALLPAPER_SRCS.length) return;
      const img = new Image();
      img.onload = () => { bg = img; if (reduced) draw(true); };
      img.onerror = () => tryLoad(i + 1);
      img.src = WALLPAPER_SRCS[i];
    })(0);

    type Drop = { x: number; y: number; len: number; v: number };
    let rain: Drop[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(W * dpr));
      canvas.height = Math.max(1, Math.floor(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rain = Array.from({ length: 55 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        len: 6 + Math.random() * 12, v: 4 + Math.random() * 6,
      }));
    };

    const draw = (once = false) => {
      ctx.clearRect(0, 0, W, H);
      if (bg) {
        const s = Math.max(W / bg.width, H / bg.height);
        const dw = bg.width * s, dh = bg.height * s;
        ctx.globalAlpha = 0.18;
        ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.globalAlpha = 1;
      }
      if (!reduced) {
        ctx.strokeStyle = 'rgba(80,80,90,0.07)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of rain) {
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1.5, d.y + d.len);
          d.y += d.v; d.x -= 0.4;
          if (d.y > H) { d.y = -d.len; d.x = Math.random() * W; }
        }
        ctx.stroke();
      }
      if (!once) raf = requestAnimationFrame(() => draw());
    };

    const onHit = () => {
      if (reduced || !speedHostRef.current) return;
      burstSpeedLines(speedHostRef.current, 10, 0.8);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('akira-hit', onHit);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) raf = requestAnimationFrame(() => draw());
    });
    if (reduced) draw(true); else raf = requestAnimationFrame(() => draw());

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('akira-hit', onHit);
    };
  }, []);

  return (
    <div ref={rootRef} className="akira-wp" aria-hidden="true">
      <canvas ref={canvasRef} className="akira-bg" />
      <div ref={fieldRef} className="akira-wp__field">
        <div ref={katakanaRef} className="akira-wp__katakana">アキラ</div>
        <div ref={crackRef} className="akira-wp__crack" />

        <div ref={bikeRef} className="akira-wp__bike">
          <svg viewBox="0 0 320 100" className="akira-wp__bike-svg" aria-hidden>
            <ellipse cx="52" cy="78" rx="28" ry="28" fill="#111" />
            <ellipse cx="52" cy="78" rx="18" ry="18" fill="#222" />
            <ellipse cx="268" cy="78" rx="28" ry="28" fill="#111" />
            <ellipse cx="268" cy="78" rx="18" ry="18" fill="#222" />
            <path
              d="M40 78 L90 78 L110 58 L200 52 L240 58 L280 78 L268 78 L230 62 L120 65 L95 78 Z"
              fill="#e60012"
            />
            <path d="M200 52 L215 28 L235 24 L250 38 L240 52 Z" fill="#e60012" opacity="0.95" />
            <rect x="198" y="38" width="38" height="10" rx="2" fill="rgba(255,255,255,0.35)" />
            <rect x="130" y="48" width="44" height="14" rx="4" fill="#8B4513" opacity="0.85" />
            <circle cx="248" cy="32" r="5" fill="#fff" opacity="0.5" />
          </svg>
          <div ref={headlightRef} className="akira-wp__headlight" />
        </div>

        <div ref={riderRef} className="akira-wp__rider">
          <div ref={pillRef} className="akira-wp__pill" title="Capsule emblem">
            <span className="akira-wp__pill-half akira-wp__pill-half--blue" />
            <span className="akira-wp__pill-half akira-wp__pill-half--white" />
          </div>
          <svg viewBox="0 0 80 120" className="akira-wp__rider-svg" aria-hidden>
            <ellipse cx="40" cy="18" rx="14" ry="16" fill="#111" />
            <path d="M22 34 L58 34 L52 88 L28 88 Z" fill="#e60012" />
            <path d="M28 88 L24 112 L34 112 L36 88 Z" fill="#111" />
            <path d="M52 88 L56 112 L46 112 L44 88 Z" fill="#111" />
            <path d="M26 36 L54 36 L50 48 L30 48 Z" fill="#c40010" opacity="0.5" />
          </svg>
        </div>

        <div ref={speedHostRef} className="akira-wp__speedhost" />
      </div>
      <div className="akira-scan" />
    </div>
  );
}
