import { useEffect, useRef } from 'react';
import './akira-bg.css';

/**
 * AKIRA PRO MCP live wallpaper.
 *
 * If a real image exists at one of WALLPAPER_SRCS (drop your own into
 * `public/akira/`), it is drawn as the base layer — cover-fit, gently darkened
 * for UI legibility — with animated rain + a streaking bike light on top.
 *
 * With no image it renders an original illustrated Neo-Tokyo scene: gradient
 * sky, a big red sun, a procedural lit-window skyline, a Kaneda-style bike
 * light-streak, and rain. Cheap: single canvas, DPR-capped, paused when hidden
 * or when the user prefers reduced motion.
 */

const WALLPAPER_SRCS = ['/akira/wallpaper.jpg', '/akira/wallpaper.png', '/akira/wallpaper.webp'];
const HORIZON = 0.62;

interface Building { x: number; w: number; h: number; lights: { y: number; on: boolean; warm: boolean }[]; }
interface Drop { x: number; y: number; len: number; v: number; }

export function AkiraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1;
    let raf = 0;

    // Optional real image
    let bg: HTMLImageElement | null = null;
    (function tryLoad(i: number) {
      if (i >= WALLPAPER_SRCS.length) return;
      const img = new Image();
      img.onload = () => { bg = img; if (reduced) draw(true); };
      img.onerror = () => tryLoad(i + 1);
      img.src = WALLPAPER_SRCS[i];
    })(0);

    let buildings: Building[] = [];
    let rain: Drop[] = [];
    // Bike light streak
    let bike = { x: -300, y: 0, speed: 0, active: false, cool: 120 };

    const buildScene = () => {
      const hy = H * HORIZON;
      buildings = [];
      let x = -20;
      while (x < W + 20) {
        const w = 24 + Math.random() * 70;
        const h = 30 + Math.random() * (H * HORIZON * 0.75);
        const lights: Building['lights'] = [];
        const rows = Math.floor(h / 14);
        for (let r = 0; r < rows; r++) {
          if (Math.random() < 0.5) lights.push({ y: hy - 8 - r * 14, on: Math.random() < 0.7, warm: Math.random() < 0.5 });
        }
        buildings.push({ x, w, h, lights });
        x += w + 4 + Math.random() * 10;
      }
      rain = Array.from({ length: 90 }, () => ({
        x: Math.random() * W, y: Math.random() * H, len: 8 + Math.random() * 16, v: 6 + Math.random() * 8,
      }));
      bike.y = hy + 6 + Math.random() * (H * 0.2);
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(W * dpr));
      canvas.height = Math.max(1, Math.floor(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildScene();
    };

    const drawImageCover = (img: HTMLImageElement) => {
      const s = Math.max(W / img.width, H / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      // Subtle breathing glow on image wallpaper
      const pulse = 0.92 + Math.sin(Date.now() * 0.0008) * 0.04;
      ctx.globalAlpha = pulse;
      const glow = ctx.createRadialGradient(W * 0.65, H * HORIZON, 0, W * 0.65, H * HORIZON, W * 0.5);
      glow.addColorStop(0, 'rgba(255,42,51,0.12)');
      glow.addColorStop(1, 'rgba(255,42,51,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      // darken for legibility + red/cyan grade
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(8,4,14,0.55)');
      g.addColorStop(0.5, 'rgba(10,4,10,0.35)');
      g.addColorStop(1, 'rgba(4,2,8,0.7)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    };

    const drawScene = () => {
      const hy = H * HORIZON;
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0a0614');
      sky.addColorStop(0.45, '#1b0a22');
      sky.addColorStop(HORIZON, '#4a0d18');
      sky.addColorStop(HORIZON + 0.001, '#080510');
      sky.addColorStop(1, '#040309');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // red sun + glow
      const sunX = W * 0.66, sunY = hy - H * 0.06, R = Math.min(W, H) * 0.16;
      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, R * 3.4);
      glow.addColorStop(0, 'rgba(255,60,50,0.5)');
      glow.addColorStop(1, 'rgba(255,60,50,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, hy + 40);
      const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, R);
      sun.addColorStop(0, '#ff6a4a'); sun.addColorStop(0.7, '#e42a2b'); sun.addColorStop(1, '#7a0f14');
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sunX, sunY, R, 0, Math.PI * 2); ctx.fill();

      // skyline
      for (const b of buildings) {
        ctx.fillStyle = '#0a0713';
        ctx.fillRect(b.x, hy - b.h, b.w, b.h);
        ctx.strokeStyle = 'rgba(41,192,255,0.10)';
        ctx.strokeRect(b.x + 0.5, hy - b.h + 0.5, b.w, b.h);
        for (const l of b.lights) {
          if (!l.on) continue;
          ctx.fillStyle = l.warm ? 'rgba(255,180,90,0.85)' : 'rgba(90,210,255,0.8)';
          const cols = Math.max(1, Math.floor(b.w / 12));
          for (let c = 0; c < cols; c++) if (Math.random() < 0.6) ctx.fillRect(b.x + 4 + c * 11, l.y, 4, 5);
        }
      }
      // horizon neon line
      ctx.strokeStyle = 'rgba(255,42,51,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
    };

    const drawBike = () => {
      if (!bike.active) {
        bike.cool -= 1;
        if (bike.cool <= 0) {
          bike.active = true;
          const l2r = Math.random() < 0.5;
          bike.speed = (l2r ? 1 : -1) * (7 + Math.random() * 6);
          bike.x = l2r ? -200 : W + 200;
          bike.y = H * HORIZON + 6 + Math.random() * (H * 0.22);
        }
        return;
      }
      bike.x += bike.speed;
      const dir = Math.sign(bike.speed);
      const tailX = bike.x - dir * (180 + Math.abs(bike.speed) * 14);
      const grad = ctx.createLinearGradient(bike.x, bike.y, tailX, bike.y);
      grad.addColorStop(0, 'rgba(255,90,80,0.95)');
      grad.addColorStop(1, 'rgba(255,42,51,0)');
      ctx.strokeStyle = grad; ctx.lineWidth = 3;
      ctx.shadowBlur = 16; ctx.shadowColor = 'rgba(255,42,51,0.9)';
      ctx.beginPath(); ctx.moveTo(bike.x, bike.y); ctx.lineTo(tailX, bike.y); ctx.stroke();
      // bright head
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bike.x, bike.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (bike.x < -260 || bike.x > W + 260) { bike.active = false; bike.cool = 120 + Math.random() * 240; }
    };

    const drawRain = () => {
      ctx.strokeStyle = 'rgba(150,200,255,0.10)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of rain) {
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + d.len);
        d.y += d.v; d.x -= 0.6;
        if (d.y > H) { d.y = -d.len; d.x = Math.random() * W; }
      }
      ctx.stroke();
    };

    const draw = (once = false) => {
      if (bg) drawImageCover(bg); else drawScene();
      drawBike();
      drawRain();
      if (once) return;
      raf = requestAnimationFrame(() => draw());
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) raf = requestAnimationFrame(() => draw());
    };

    const onHit = () => {
      if (reduced) return;
      bike.active = true;
      bike.speed = (Math.random() < 0.5 ? 1 : -1) * (10 + Math.random() * 8);
      bike.x = bike.speed > 0 ? -200 : W + 200;
      bike.y = H * HORIZON + 6 + Math.random() * (H * 0.22);
      bike.cool = 0;
    };
    window.addEventListener('akira-hit', onHit);

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    if (reduced) draw(true); else raf = requestAnimationFrame(() => draw());

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('akira-hit', onHit);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="akira-bg" aria-hidden="true" />
      <div className="akira-scan" aria-hidden="true" />
    </>
  );
}
