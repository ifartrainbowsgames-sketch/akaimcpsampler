import { useCallback, useRef } from 'react';
import { Waveform } from './Waveform';
import type { Slice } from '../audio/types';

type Handle = 'start' | 'end' | 'loop';

interface Props {
  buffer: AudioBuffer | null;
  start: number;
  end: number;
  loopStart: number;
  slices?: Slice[];
  playhead?: number;
  zoom?: number;
  chopActive?: boolean;
  onTrim(start: number, end: number, loopStart: number): void;
  onPreview(norm: number): void;
  onSliceTap?(frame: number): void;
}

const HIT = 22;

export function WaveformSurface({
  buffer,
  start,
  end,
  loopStart,
  slices,
  playhead,
  zoom = 1,
  chopActive,
  onTrim,
  onPreview,
  onSliceTap,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; base: { start: number; end: number; loopStart: number } } | null>(null);

  const len = buffer?.length ?? 1;
  const viewEnd = end || len;
  const viewStart = zoom > 1
    ? Math.max(0, Math.min(start, len - Math.floor(len / zoom)))
    : 0;
  const viewLen = zoom > 1 ? Math.floor(len / zoom) : len;

  const toNorm = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return viewStart + x * viewLen;
  }, [viewStart, viewLen]);

  const pickHandle = (clientX: number): Handle | null => {
    if (!buffer) return null;
    const toX = (f: number) => ((f - viewStart) / viewLen) * (ref.current?.clientWidth ?? 1);
    const px = clientX - (ref.current?.getBoundingClientRect().left ?? 0);
    const targets: { h: Handle; f: number }[] = [
      { h: 'start', f: start },
      { h: 'end', f: viewEnd },
      { h: 'loop', f: loopStart },
    ];
    let best: { h: Handle; d: number } | null = null;
    for (const t of targets) {
      const d = Math.abs(px - toX(t.f));
      if (d <= HIT && (!best || d < best.d)) best = { h: t.h, d };
    }
    return best?.h ?? null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!buffer) return;
    ref.current?.setPointerCapture(e.pointerId);
    const handle = pickHandle(e.clientX);
    if (handle) {
      drag.current = { handle, base: { start, end: viewEnd, loopStart } };
      return;
    }
    const frame = Math.round(toNorm(e.clientX));
    if (chopActive && onSliceTap) {
      onSliceTap(frame);
      return;
    }
    onPreview((frame - viewStart) / viewLen);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !buffer) return;
    const frame = Math.round(toNorm(e.clientX));
    const { handle, base } = drag.current;
    let ns = base.start;
    let ne = base.end;
    let nl = base.loopStart;
    if (handle === 'start') {
      ns = Math.max(0, Math.min(frame, ne - 1));
      nl = Math.min(nl, ns);
    } else if (handle === 'end') {
      ne = Math.max(ns + 1, Math.min(len, frame));
    } else {
      nl = Math.max(ns, Math.min(ne - 1, frame));
    }
    onTrim(ns, ne, nl);
  };

  const onPointerUp = () => { drag.current = null; };

  const displayStart = Math.max(0, start - viewStart);
  const displayEnd = Math.min(viewLen, (viewEnd || len) - viewStart);
  const displayLoop = Math.max(0, loopStart - viewStart);

  return (
    <div
      ref={ref}
      className="wave-surface"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Waveform
        buffer={buffer}
        start={displayStart}
        end={displayEnd || viewLen}
        loopStart={displayLoop}
        slices={slices?.map((s) => ({
          start: Math.max(0, s.start - viewStart),
          end: Math.max(0, s.end - viewStart),
        }))}
        playhead={playhead}
        viewStart={viewStart}
        viewLen={viewLen}
      />
    </div>
  );
}
