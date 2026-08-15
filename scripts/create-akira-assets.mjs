#!/usr/bin/env node
/**
 * Bake AKIRA overlay assets to WebP (build-time only — never rendered as CSS/SVG in the app).
 */
import sharp from 'sharp';
import { mkdir, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../public/images/akira');
mkdir(outDir, { recursive: true }, () => {});

const svgToWebp = async (svg, name, w, h) => {
  await sharp(Buffer.from(svg)).resize(w, h).webp({ quality: 85 }).toFile(join(outDir, name));
  console.log('wrote', name);
};

// Atmospheric overlay — vignette + haze + red wash baked into one transparent PNG
const cityOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs>
    <radialGradient id="v" cx="50%" cy="42%" r="75%">
      <stop offset="38%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.58"/>
    </radialGradient>
    <linearGradient id="h" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#140c12" stop-opacity="0.38"/>
      <stop offset="40%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.48"/>
    </linearGradient>
    <radialGradient id="r" cx="78%" cy="78%" r="45%">
      <stop offset="0" stop-color="#e60012" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#e60012" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#h)"/>
  <rect width="1920" height="1080" fill="url(#v)"/>
  <rect width="1920" height="1080" fill="url(#r)"/>
</svg>`;

// Japanese neon sign artwork
const neonSign = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="220">
  <rect width="480" height="220" fill="none"/>
  <text x="8" y="72" font-family="sans-serif" font-size="52" font-weight="900" fill="#ff5040"
    style="paint-order:stroke;stroke:#e60012;stroke-width:2">ネオ東京</text>
  <text x="8" y="118" font-family="sans-serif" font-size="22" font-weight="700" letter-spacing="8" fill="#e8e0d8">NEO-TOKYO</text>
  <text x="8" y="168" font-family="sans-serif" font-size="36" font-weight="900" fill="#f5d000">警告</text>
</svg>`;

// Anime speed-line burst (transparent)
const speedLines = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <g stroke="#e60012" stroke-width="3" stroke-linecap="round" opacity="0.85">
    ${Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const x2 = 400 + Math.cos(a) * 360;
      const y2 = 400 + Math.sin(a) * 360;
      return `<line x1="400" y1="400" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }).join('')}
  </g>
</svg>`;

// Large background kanji graphic
const titleKanji = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
  <text x="50%" y="55%" text-anchor="middle" font-family="sans-serif" font-size="280" font-weight="900"
    fill="#e60012" opacity="0.12">東京</text>
</svg>`;

await svgToWebp(cityOverlay, 'city-overlay.webp', 1920, 1080);
await svgToWebp(neonSign, 'neon-sign.webp', 480, 220);
await svgToWebp(speedLines, 'speed-lines.webp', 800, 800);
await svgToWebp(titleKanji, 'title-kanji.webp', 600, 400);

writeFileSync(join(outDir, 'README.md'), `# AKIRA environment assets

All scenery is **image files** — the app never draws city, bike, neon, or speed lines with CSS/SVG.

| File | Role |
|------|------|
| neo-tokyo-bg.webp | Desktop background |
| neo-tokyo-mobile.webp | Mobile background |
| kaneda-bike.webp | Foreground motorcycle (transparent) |
| city-overlay.webp | Vignette / haze / red wash overlay |
| neon-sign.webp | Japanese neon signage artwork |
| speed-lines.webp | Hit-flash speed lines |
| title-kanji.webp | Background 東京 graphic |
| grain.webp | Film grain tile |

Replace any file with the same filename to customize. Run \`npm run akira-assets\` to regenerate baked overlays.
`);

console.log('done');
