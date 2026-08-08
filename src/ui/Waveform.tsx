import { useEffect, useRef } from 'react';
import { waveformPeaks } from '../audio/chop';
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

export function Waveform({
  buffer, start, end, loopStart, slices, playhead, viewStart = 0, viewLen, zoomWindow,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
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
    const peaks = waveformPeaks(buffer, Math.max(1, Math.floor(w)), {
      start: viewStart,
      end: viewStart + regionLen,
    });
    ctx.fillStyle = '#E8D24A';
    for (let x = 0; x < peaks.length; x++) {
      const barH = Math.max(1, peaks[x] * (h * 0.92));
      ctx.fillRect(x, (h - barH) / 2, 1, barH);
    }

    const toX = (frame: number) => ((frame) / regionLen) * w;

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

    if (playhead !== undefined && playhead >= 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playhead * w, 0, 1, h);
    }

    if (zoomWindow && buffer) {
      const total = buffer.length;
      const zx = (zoomWindow.start / total) * w;
      const zw = (zoomWindow.len / total) * w;
      ctx.strokeStyle = 'rgba(87,200,216,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(zx, 1, Math.max(2, zw), h - 2);
    }
  }, [buffer, start, end, loopStart, slices, playhead, viewStart, viewLen, zoomWindow]);

  return <canvas ref={canvas} className="waveform" />;
}
