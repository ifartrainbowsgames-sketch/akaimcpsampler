import { useEffect, useRef } from 'react';
import { cachedWaveformPeaks } from '../audio/peakCache';
import type { Slice } from '../audio/types';

interface Props {
  buffer: AudioBuffer | null;
  start: number;
  end: number;
  loopStart?: number;
  slices?: Slice[];
  playhead?: number;
  viewStart?: number;
  viewLen?: number;
  /** Highlight the zoomed region in overview mode. */
  zoomWindow?: { start: number; len: number };
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer | null,
  start: number,
  end: number,
  loopStart: number | undefined,
  slices: Slice[] | undefined,
  viewStart: number,
  viewLen: number | undefined,
  zoomWindow: { start: number; len: number } | undefined,
) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = '#4a4636';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  if (!buffer) {
    ctx.fillStyle = '#5a5a52';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('LOAD A SAMPLE', 8, h / 2 - 6);
    return;
  }

  const regionLen = viewLen ?? buffer.length;
  const peaks = cachedWaveformPeaks(buffer, Math.max(1, Math.floor(w)), {
    start: viewStart,
    end: viewStart + regionLen,
  });
  ctx.fillStyle = '#E8D24A';
  for (let x = 0; x < peaks.length; x++) {
    const barH = Math.max(1, peaks[x] * (h * 0.92));
    ctx.fillRect(x, (h - barH) / 2, 1, barH);
  }

  const toX = (frame: number) => (frame / regionLen) * w;

  ctx.fillStyle = '#57C8D8';
  ctx.fillRect(toX(start), 0, 2, h);
  ctx.fillRect(toX(end) - 2, 0, 2, h);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, toX(start), h);
  ctx.fillRect(toX(end), 0, w - toX(end), h);

  if (loopStart !== undefined && loopStart > start) {
    ctx.fillStyle = '#7CE08A';
    ctx.fillRect(toX(loopStart), 0, 1.5, h);
  }

  if (slices?.length) {
    ctx.fillStyle = 'rgba(240,124,30,0.9)';
    for (const s of slices) ctx.fillRect(toX(s.start), 0, 1.5, h);
  }

  if (zoomWindow) {
    const total = buffer.length;
    const zx = (zoomWindow.start / total) * w;
    const zw = (zoomWindow.len / total) * w;
    ctx.strokeStyle = 'rgba(87,200,216,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(zx, 1, Math.max(2, zw), h - 2);
  }
}

export function Waveform({
  buffer, start, end, loopStart, slices, playhead, viewStart = 0, viewLen, zoomWindow,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    drawWaveform(c, buffer, start, end, loopStart, slices, viewStart, viewLen, zoomWindow);
  }, [buffer, start, end, loopStart, slices, viewStart, viewLen, zoomWindow]);

  useEffect(() => {
    const el = playheadRef.current;
    if (!el) return;
    if (playhead === undefined || playhead < 0) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.left = `${playhead * 100}%`;
  }, [playhead]);

  return (
    <div className="waveform-wrap">
      <canvas ref={canvas} className="waveform" />
      <div ref={playheadRef} className="waveform-playhead" aria-hidden />
    </div>
  );
}
