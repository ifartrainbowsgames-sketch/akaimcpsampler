import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { ticksPerBar } from '../audio/scheduler';
import { TICKS_PER_16TH, makeArrangement } from '../audio/types';
import './playlist.css';

const BANK_LETTERS = 'ABCDEFGH';
const TRACK_HEIGHT = 40;
const HEADER_W = 96;
const MIN_PX_PER_BAR = 24;
const MAX_PX_PER_BAR = 320;

function clipLabel(bank: number, slot: number): string {
  return `${BANK_LETTERS[bank] ?? '?'}${slot + 1}`;
}

/**
 * FL-style playlist: pattern clips painted on parallel tracks over a song
 * timeline. Clips reference stored patterns by (bank, slot); the transport
 * plays them concurrently via the engine's arrangement mode.
 */
export function Playlist() {
  const project    = useStore((s) => s.project);
  const bank       = useStore((s) => s.bank);
  const seqSlot    = useStore((s) => s.seqSlot);
  const setScreen  = useStore((s) => s.setScreen);
  const addClip    = useStore((s) => s.addClip);
  const moveClip   = useStore((s) => s.moveClip);
  const deleteClip = useStore((s) => s.deleteClip);
  const toggleClipMute       = useStore((s) => s.toggleClipMute);
  const setArrangementLength = useStore((s) => s.setArrangementLength);
  const seedArrangementFromSong = useStore((s) => s.seedArrangementFromSong);
  const playArrangement = useStore((s) => s.playArrangement);
  const stop            = useStore((s) => s.stop);

  const arr = project.arrangement ?? makeArrangement();
  const barTicks = ticksPerBar(project.timeSignature);

  const [pxPerBar, setPxPerBar] = useState(80);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; track: number; startTick: number } | null>(null);

  const lanesRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const pxPerTick = pxPerBar / barTicks;
  const totalTicks = arr.lengthBars * barTicks;
  const laneWidth = totalTicks * pxPerTick;

  // Snap to the nearest 16th; hold Shift while dragging for bar snapping.
  const snap = (tick: number, coarse: boolean) => {
    const div = coarse ? barTicks : TICKS_PER_16TH;
    return Math.max(0, Math.round(tick / div) * div);
  };

  // ── Live playhead (rAF poll of engine telemetry, like the rest of the app) ──
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = playheadRef.current;
      if (el) {
        const playing = engine.telemetry.playing;
        el.style.opacity = playing ? '1' : '0';
        el.style.transform = `translateX(${engine.telemetry.positionTicks * pxPerTick}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pxPerTick]);

  // Delete selected clip with keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteClip(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, deleteClip]);

  // Coordinates relative to the lanes element. Its bounding rect already
  // reflects horizontal/vertical scroll, so no manual scroll offset is needed.
  const laneLocal = (clientX: number, clientY: number) => {
    const rect = lanesRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Click an empty lane cell → paint the currently selected pattern there.
  const onLaneClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // ignore clicks that hit a clip
    const { x, y } = laneLocal(e.clientX, e.clientY);
    const track = Math.floor(y / TRACK_HEIGHT);
    if (track < 0 || track >= arr.tracks) return;
    addClip(track, bank, seqSlot, snap(x / pxPerTick, !e.shiftKey));
  };

  const onClipPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const clip = arr.clips.find((c) => c.id === id);
    if (!clip) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = laneLocal(e.clientX, e.clientY);
    const grabTickOffset = x / pxPerTick - clip.startTick;
    const grabTrackOffset = y - clip.track * TRACK_HEIGHT;

    const onMove = (ev: PointerEvent) => {
      const p = laneLocal(ev.clientX, ev.clientY);
      const track = Math.max(0, Math.min(arr.tracks - 1,
        Math.floor((p.y - grabTrackOffset) / TRACK_HEIGHT + 0.5)));
      const startTick = snap(p.x / pxPerTick - grabTickOffset, !ev.shiftKey);
      setDrag({ id, track, startTick });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag((d) => {
        if (d && d.id === id) moveClip(id, d.track, d.startTick);
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const bars = Array.from({ length: arr.lengthBars + 1 }, (_, i) => i);

  return (
    <div className="pl">
      <div className="pl-toolbar">
        <button type="button" className="pl-btn" onClick={() => setScreen('song')}>◀ BACK</button>
        <button type="button" className="pl-btn pl-btn--play" onClick={() => playArrangement()}>▶ PLAY</button>
        <button type="button" className="pl-btn" onClick={() => stop(true)}>⏹ STOP</button>
        <span className="pl-sep" />
        <button type="button" className="pl-btn" onClick={() => seedArrangementFromSong()}>SEED FROM SONG</button>
        <span className="pl-sep" />
        <span className="pl-label">PAINT: <b>{clipLabel(bank, seqSlot)}</b></span>
        <span className="pl-sep" />
        <span className="pl-label">BARS</span>
        <button type="button" className="pl-btn" onClick={() => setArrangementLength(arr.lengthBars - 1)}>−</button>
        <span className="pl-num">{arr.lengthBars}</span>
        <button type="button" className="pl-btn" onClick={() => setArrangementLength(arr.lengthBars + 1)}>+</button>
        <span className="pl-sep" />
        <span className="pl-label">ZOOM</span>
        <button type="button" className="pl-btn" onClick={() => setPxPerBar((z) => Math.max(MIN_PX_PER_BAR, z - 16))}>−</button>
        <button type="button" className="pl-btn" onClick={() => setPxPerBar((z) => Math.min(MAX_PX_PER_BAR, z + 16))}>+</button>
      </div>

      <div className="pl-body">
        <div className="pl-tracks-col" style={{ width: HEADER_W }}>
          <div className="pl-ruler-spacer" />
          {Array.from({ length: arr.tracks }, (_, t) => (
            <div key={t} className="pl-track-head" style={{ height: TRACK_HEIGHT }}>
              Track {t + 1}
            </div>
          ))}
        </div>

        <div className="pl-scroll">
          <div className="pl-ruler" style={{ width: laneWidth }}>
            {bars.map((b) => (
              <div key={b} className="pl-bar-tick" style={{ left: b * pxPerBar }}>
                <span>{b + 1}</span>
              </div>
            ))}
          </div>

          <div
            className="pl-lanes"
            ref={lanesRef}
            style={{ width: laneWidth, height: arr.tracks * TRACK_HEIGHT }}
            onClick={onLaneClick}
          >
            {/* bar grid lines */}
            {bars.map((b) => (
              <div
                key={b}
                className={`pl-grid-line${b % 4 === 0 ? ' pl-grid-line--strong' : ''}`}
                style={{ left: b * pxPerBar }}
              />
            ))}
            {/* track separators */}
            {Array.from({ length: arr.tracks }, (_, t) => (
              <div key={t} className="pl-track-row" style={{ top: t * TRACK_HEIGHT, height: TRACK_HEIGHT }} />
            ))}

            {/* clips */}
            {arr.clips.map((c) => {
              const view = drag && drag.id === c.id ? { ...c, track: drag.track, startTick: drag.startTick } : c;
              return (
                <div
                  key={c.id}
                  className={`pl-clip${c.muted ? ' pl-clip--muted' : ''}${selectedId === c.id ? ' pl-clip--sel' : ''}`}
                  style={{
                    left: view.startTick * pxPerTick,
                    top: view.track * TRACK_HEIGHT + 2,
                    width: Math.max(8, c.lengthTicks * pxPerTick - 2),
                    height: TRACK_HEIGHT - 4,
                  }}
                  onPointerDown={(e) => onClipPointerDown(e, c.id)}
                  onDoubleClick={(e) => { e.stopPropagation(); deleteClip(c.id); }}
                  title={`${clipLabel(c.bank, c.slot)} — double-click to delete`}
                >
                  <span className="pl-clip-name">{clipLabel(c.bank, c.slot)}</span>
                  <button
                    type="button"
                    className="pl-clip-mute"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); toggleClipMute(c.id); }}
                  >
                    {c.muted ? 'M' : '·'}
                  </button>
                </div>
              );
            })}

            <div className="pl-playhead" ref={playheadRef} style={{ height: arr.tracks * TRACK_HEIGHT }} />
          </div>
        </div>
      </div>

      <div className="pl-hint">
        Click a lane to place <b>{clipLabel(bank, seqSlot)}</b> · drag to move (hold Shift = snap to bar) ·
        double-click or Delete to remove · <b>M</b> mutes a clip
      </div>
    </div>
  );
}
