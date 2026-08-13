import { useEffect, useRef } from 'react';
import './akira-bg.css';

/**
 * Akira-inspired live wallpaper: an original Neo-Tokyo scene — a receding neon
 * grid and streaking red/cyan light-trails (evoking bike tail-lights on a
 * highway) over a dark horizon, with a CSS scanline overlay.
 *
 * Original art — no trademarked Akira assets. Cheap to run: single canvas,
 * DPR-capped, bounded object counts, paused when the tab is hidden or the user
 * prefers reduced motion (a single static frame is drawn instead).
 */

interface Trail {
  x: number;
  y: number;
  len: number;
  speed: number;
  cyan: boolean;
  w: number;
}

const HORIZON = 0.42;   // fraction of height where the "ground" starts
const MAX_TRAILS = 26;

export function AkiraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1;
    let trails: Trail[] = [];
    let scroll = 0;
    let raf = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(W * dpr));
      canvas.height = Math.max(1, Math.floor(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnTrail = (offscreen: boolean): Trail => {
      const dir = Math.random() < 0.5;
      const band = H * HORIZON + Math.random() * H * (1 - HORIZON) * 0.9;
      return {
        x: offscreen ? (dir ? -100 : W + 100) : Math.random() * W,
        y: band,
        len: 60 + Math.random() * 220,
        speed: (dir ? 1 : -1) * (2 + Math.random() * 5),
        cyan: Math.random() < 0.28,
        w: 1 + Math.random() * 2.5,
      };
    };

    const drawBackdrop = () => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#05060b');
      g.addColorStop(HORIZON - 0.05, '#0a0a14');
      g.addColorStop(HORIZON, '#1a0710');
      g.addColorStop(1, '#050408');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // red horizon glow
      const glow = ctx.createRadialGradient(W / 2, H * HORIZON, 0, W / 2, H * HORIZON, W * 0.7);
      glow.addColorStop(0, 'rgba(228,50,43,0.22)');
      glow.addColorStop(1, 'rgba(228,50,43,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H * 0.9);
    };

    const drawGrid = () => {
      const hy = H * HORIZON;
      const vp = W / 2; // vanishing point x
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(34,166,224,0.28)';

      // vertical lines converging to the vanishing point
      ctx.beginPath();
      for (let i = -10; i <= 10; i++) {
        const bx = vp + (i / 10) * W;
        ctx.moveTo(vp + (i / 10) * (W * 0.12), hy);
        ctx.lineTo(bx, H);
      }
      ctx.stroke();

      // horizontal lines scrolling toward the viewer (perspective spacing)
      ctx.strokeStyle = 'rgba(34,166,224,0.20)';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const t = ((i + scroll) % 16) / 16;
        const y = hy + t * t * (H - hy);
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
    };

    const drawTrail = (t: Trail) => {
      const x2 = t.x - Math.sign(t.speed) * t.len;
      const grad = ctx.createLinearGradient(t.x, t.y, x2, t.y);
      const core = t.cyan ? '87,200,216' : '255,70,60';
      grad.addColorStop(0, `rgba(${core},0.95)`);
      grad.addColorStop(1, `rgba(${core},0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = t.w;
      ctx.shadowBlur = 12;
      ctx.shadowColor = t.cyan ? 'rgba(34,166,224,0.9)' : 'rgba(228,50,43,0.9)';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(x2, t.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const frame = () => {
      drawBackdrop();
      drawGrid();

      if (trails.length < MAX_TRAILS && Math.random() < 0.15) trails.push(spawnTrail(true));
      for (const t of trails) {
        t.x += t.speed;
        drawTrail(t);
      }
      trails = trails.filter((t) => t.x > -t.len - 120 && t.x < W + t.len + 120);

      scroll = (scroll + 0.035) % 16;
      raf = requestAnimationFrame(frame);
    };

    const staticFrame = () => {
      // Reduced-motion: one calm static composition.
      trails = Array.from({ length: 8 }, () => spawnTrail(false));
      drawBackdrop();
      drawGrid();
      for (const t of trails) drawTrail(t);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduced) {
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    if (reduced) staticFrame();
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="akira-bg" aria-hidden="true" />
      <div className="akira-scan" aria-hidden="true" />
    </>
  );
}
