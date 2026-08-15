# AKIRA (1988) environment assets

Original homage artwork — not copyrighted movie frames.

## Required files (auto-loaded when present)

| File | Purpose |
|------|---------|
| `neo-tokyo-bg.webp` | Desktop cinematic Neo-Tokyo night background |
| `neo-tokyo-mobile.webp` | Mobile/tablet crop (≤768px) |
| `kaneda-bike.webp` | Transparent foreground motorcycle |
| `grain.webp` | Film grain tile (256×256, repeats) |

## Optional

| File | Purpose |
|------|---------|
| `city-overlay.webp` | Extra atmospheric light layer |
| `neo-tokyo-bg.avif` | AVIF variant (future) |

## Replacing artwork

Drop higher-resolution files with the **same filenames**. The app uses `<picture>` with WebP + PNG fallbacks.

To swap the bike only: replace `kaneda-bike.webp` (and optionally `kaneda-bike.png`).

Legacy path `public/akira/wallpaper.png` is still copied as `neo-tokyo-bg-fallback.png` for offline fallback.
