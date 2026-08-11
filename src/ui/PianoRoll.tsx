import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { TICKS_PER_16TH, TICKS_PER_BEAT } from '../audio/types';
import { ticksPerBar } from '../audio/scheduler';
import type { SeqEvent } from '../audio/types';
import './pianoroll.css';

// ─── Layout constants ────────────────────────────────────────────────────────
const ROW_HEIGHT = 18;         // px per MIDI note row (touch-friendly)
const TOTAL_NOTES = 128;
const PIANO_WIDTH = 48;        // px for keyboard column
const VELOCITY_HEIGHT = 72;    // px for velocity lane
const H_SCROLLBAR = 14;        // px for horizontal (time) scrollbar
const V_SCROLLBAR = 14;        // px for vertical (pitch) scrollbar
const RULER_H = 16;            // px for the top timeline ruler
const RESIZE_GRIP = 10;        // px hit zone on a note's right edge
const MIN_TICKS_PER_PX = 0.05; // most zoomed in
const MAX_TICKS_PER_PX = 8;    // most zoomed out
const DEFAULT_TICKS_PER_PX = 0.5;
const BASE_NOTE = 60;          // C4 = no pitch offset

// ─── Pitch helpers ───────────────────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function noteName(n: number) { return NOTE_NAMES[n % 12]; }
function isBlack(n: number)  { return [1,3,6,8,10].includes(n % 12); }
function octave(n: number)   { return Math.floor(n / 12) - 2; }
function noteLabel(n: number) {
  const name = noteName(n);
  if (name === 'C') return `C${octave(n)}`;
  return null;
}

// ─── Snap-to-scale ───────────────────────────────────────────────────────────
// Visual guidance only (highlight/dim), not a hard constraint on drawing —
// mirrors FL Studio's "Snap to Scale" grid highlighting.
type ScaleType = 'off' | 'major' | 'minor';
const SCALE_INTERVALS: Record<Exclude<ScaleType, 'off'>, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

// ─── Colour helpers ──────────────────────────────────────────────────────────
const NOTE_COLOR_SEL    = 'hsl(40,90%,60%)';
const NOTE_COLOR_BORDER = 'hsl(210,70%,40%)';
// Velocity → colour: soft notes read cool/dim, hard notes warm/bright, so the
// grid shows dynamics at a glance (MPC/FL both colour notes by velocity).
function velocityColor(v: number, light = false) {
  const n = Math.max(1, Math.min(127, v)) / 127;
  const hue = 210 - n * 190;          // 210 (blue) → 20 (orange-red)
  const sat = 55 + n * 30;            // more saturated when louder
  const lum = (light ? 40 : 34) + n * 24;
  return `hsl(${hue},${sat}%,${lum}%)`;
}
const PIANO_WHITE_BG    = '#e8e8e4';
const PIANO_BLACK_BG    = '#1e1e24';
const PIANO_WHITE_HOVER = '#ccccc8';
const PIANO_WHITE_LABEL = '#333';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NoteRef { tick: number; note: number; }
type DragMode = 'none' | 'draw' | 'move' | 'resize' | 'velocity';
type Tool = 'draw' | 'select' | 'erase';

export function PianoRoll() {
  const project     = useStore((s) => s.project);
  const bank        = useStore((s) => s.bank);
  const seqSlot     = useStore((s) => s.seqSlot);
  const selectedPad = useStore((s) => s.selectedPad);
  const setScreen   = useStore((s) => s.setScreen);
  const pianoRollAddNote    = useStore((s) => s.pianoRollAddNote);
  const pianoRollDeleteNote = useStore((s) => s.pianoRollDeleteNote);
  const pianoRollMoveNote   = useStore((s) => s.pianoRollMoveNote);
  const pianoRollResizeNote = useStore((s) => s.pianoRollResizeNote);
  const pianoRollSetVelocity = useStore((s) => s.pianoRollSetVelocity);

  const seq = project.sequences[bank][seqSlot];
  const pad = project.banks[bank][selectedPad];
  const padName = pad.sampleName || `Pad ${selectedPad + 1}`;

  // ── Refs to DOM elements ──────────────────────────────────────────────────
  const gridAreaRef    = useRef<HTMLDivElement>(null);
  const gridCanvasRef  = useRef<HTMLCanvasElement>(null);
  const pianoCanvasRef = useRef<HTMLCanvasElement>(null);
  const velCanvasRef   = useRef<HTMLCanvasElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);

  // ── State ─────────────────────────────────────────────────────────────────
  const [ticksPerPx,    setTicksPerPx]    = useState(DEFAULT_TICKS_PER_PX);
  const [scrollTick,    setScrollTick]    = useState(0);
  const [scrollNote,    setScrollNote]    = useState(128 - 60 - 10); // center C3
  const [selectedNote,  setSelectedNote]  = useState<NoteRef | null>(null);
  const [quantize, setQuantize]           = useState(TICKS_PER_16TH);
  const [scaleRoot, setScaleRoot]         = useState(0);          // 0 = C
  const [scaleType, setScaleType]         = useState<ScaleType>('off');
  const [tool, setTool]                   = useState<Tool>('draw');
  const [showKeys, setShowKeys]           = useState(true);
  const [snapScale, setSnapScale]         = useState(false);

  const isInScale = useCallback((note: number) => {
    if (scaleType === 'off') return true;
    const rel = ((note - scaleRoot) % 12 + 12) % 12;
    return SCALE_INTERVALS[scaleType].includes(rel);
  }, [scaleRoot, scaleType]);

  // Hard snap: nudge a note to the nearest in-scale pitch (only when armed).
  const snapToScale = useCallback((note: number) => {
    if (!snapScale || scaleType === 'off') return note;
    for (let d = 0; d <= 6; d++) {
      if (isInScale(note - d)) return note - d;
      if (isInScale(note + d)) return note + d;
    }
    return note;
  }, [snapScale, scaleType, isInScale]);

  // Sizes – updated on resize
  const [gridW, setGridW] = useState(1);
  const [gridH, setGridH] = useState(1);
  const [velH,  setVelH]  = useState(VELOCITY_HEIGHT);

  // Drag state (via refs to avoid stale closure in pointer events)
  const dragMode    = useRef<DragMode>('none');
  const dragStart   = useRef({ x: 0, y: 0 });
  const dragNote    = useRef<NoteRef | null>(null);
  const dragOrigTick = useRef(0);
  const dragOrigNote = useRef(0);
  const dragNewNote  = useRef<NoteRef | null>(null);   // note being drawn
  const pianoHover   = useRef(-1);
  const erasing      = useRef(false);                  // swipe-to-erase in progress
  const scrollDrag   = useRef<'v' | 'h' | null>(null); // scrollbar thumb being dragged

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalTicks  = seq.bars * ticksPerBar(project.timeSignature);
  const noteEvents  = seq.events.filter((e) => e.pad === selectedPad);

  // ── Helper: pixel → tick ──────────────────────────────────────────────────
  const pxToTick = useCallback((px: number) => {
    return scrollTick + px * ticksPerPx;
  }, [scrollTick, ticksPerPx]);

  // px → MIDI note (top-down: row 0 = note 127)
  const pxToNote = useCallback((py: number) => {
    const row = Math.floor((py + scrollNote * ROW_HEIGHT) / ROW_HEIGHT);
    return Math.max(0, Math.min(127, 127 - row));
  }, [scrollNote]);

  // tick → px
  const tickToPx = useCallback((tick: number) => {
    return (tick - scrollTick) / ticksPerPx;
  }, [scrollTick, ticksPerPx]);

  // note → py
  const noteToPy = useCallback((note: number) => {
    return (127 - note - scrollNote) * ROW_HEIGHT;
  }, [scrollNote]);

  // snap tick to quantize grid
  const snapTick = useCallback((tick: number) => {
    return Math.max(0, Math.round(tick / quantize) * quantize);
  }, [quantize]);

  // Find event at (tick, note) for selected pad
  const findEvent = useCallback((tick: number, note: number): SeqEvent | null => {
    for (const e of noteEvents) {
      const n = e.note ?? BASE_NOTE;
      if (n === note && tick >= e.tick && tick < e.tick + (e.duration || 1)) return e;
    }
    return null;
  }, [noteEvents]);

  // Check if px is near the right edge of an event (resize handle)
  const isResizeHandle = useCallback((e: SeqEvent, px: number, py: number) => {
    const ex = tickToPx(e.tick);
    const ew = Math.max(4, tickToPx(e.tick + e.duration) - ex);
    const ey = noteToPy(e.note ?? BASE_NOTE);
    return (
      py >= ey && py < ey + ROW_HEIGHT &&
      px >= ex + ew - RESIZE_GRIP && px <= ex + ew
    );
  }, [tickToPx, noteToPy]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const area = gridAreaRef.current;
    if (!area) return;
    const obs = new ResizeObserver(() => {
      const r = area.getBoundingClientRect();
      setGridW(Math.max(1, r.width));
      setGridH(Math.max(1, r.height - VELOCITY_HEIGHT - H_SCROLLBAR - RULER_H));
      setVelH(VELOCITY_HEIGHT);
    });
    obs.observe(area);
    return () => obs.disconnect();
  }, []);

  // ── Drawing helpers ────────────────────────────────────────────────────────

  const drawPiano = useCallback(() => {
    const canvas = pianoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = PIANO_WIDTH;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Draw each row = one MIDI note
    for (let row = 0; row < TOTAL_NOTES; row++) {
      const note = 127 - row;
      const y = (row - scrollNote) * ROW_HEIGHT;
      if (y + ROW_HEIGHT < 0 || y > H) continue;

      const black = isBlack(note);
      const hover = pianoHover.current === note;
      const inScale = isInScale(note);

      if (black) {
        ctx.fillStyle = hover ? '#3a3a44' : PIANO_BLACK_BG;
        ctx.fillRect(0, y, W * 0.65, ROW_HEIGHT);
        // White area to the right of black key
        ctx.fillStyle = '#2a2a32';
        ctx.fillRect(W * 0.65, y, W * 0.35, ROW_HEIGHT);
      } else {
        ctx.fillStyle = hover ? PIANO_WHITE_HOVER : (inScale ? PIANO_WHITE_BG : '#c8c8bc');
        ctx.fillRect(0, y, W - 1, ROW_HEIGHT - 1);
        ctx.fillStyle = '#999';
        ctx.fillRect(0, y + ROW_HEIGHT - 1, W - 1, 1);
      }
      if (!inScale) {
        // Faint dim overlay for out-of-scale keys, either color.
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(0, y, W, ROW_HEIGHT - (black ? 0 : 1));
      }

      // Label C notes
      const label = noteLabel(note);
      if (label) {
        ctx.fillStyle = black ? '#888' : PIANO_WHITE_LABEL;
        ctx.font = `bold ${Math.max(7, ROW_HEIGHT - 4)}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, W - 3, y + ROW_HEIGHT / 2);
      }
    }

    // Separator line
    ctx.fillStyle = '#333338';
    ctx.fillRect(W - 1, 0, 1, H);
  }, [scrollNote, isInScale]);

  const drawGrid = useCallback((playheadTick: number) => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // ── Row backgrounds (note rows) ──────────────────────────────────────
    for (let row = 0; row < TOTAL_NOTES; row++) {
      const note = 127 - row;
      const y = (row - scrollNote) * ROW_HEIGHT;
      if (y + ROW_HEIGHT < 0 || y > H) continue;
      const inScale = isInScale(note);
      if (isBlack(note)) {
        ctx.fillStyle = inScale ? '#1e1e28' : '#141419';
      } else {
        ctx.fillStyle = inScale ? '#242430' : '#1a1a22';
      }
      ctx.fillRect(0, y, W, ROW_HEIGHT);
    }

    // ── Grid lines (horizontal) ───────────────────────────────────────────
    for (let row = 0; row < TOTAL_NOTES; row++) {
      const note = 127 - row;
      const y = (row - scrollNote) * ROW_HEIGHT;
      if (y < 0 || y > H) continue;
      // Bold line at C notes
      if (noteName(note) === 'C') {
        ctx.fillStyle = '#3a3a50';
        ctx.fillRect(0, y, W, 1);
      } else {
        ctx.fillStyle = '#2c2c38';
        ctx.fillRect(0, y, W, 1);
      }
    }

    // ── Grid lines (vertical – time) ─────────────────────────────────────
    const barTicks  = ticksPerBar(project.timeSignature);
    const beatTicks = TICKS_PER_BEAT;
    const s16th     = TICKS_PER_16TH;

    const startBar = Math.floor(scrollTick / barTicks);
    const endBar   = Math.ceil((scrollTick + W * ticksPerPx) / barTicks) + 1;

    for (let b = startBar; b <= endBar; b++) {
      const barX = tickToPx(b * barTicks);
      if (barX < 0 || barX > W) continue;
      // bar line
      ctx.fillStyle = '#505070';
      ctx.fillRect(Math.round(barX), 0, 1, H);
      // label
      ctx.fillStyle = '#5050a0';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${b + 1}`, barX + 2, 10);

      // Beat lines
      for (let bt = 1; bt < project.timeSignature[0]; bt++) {
        const beatX = tickToPx(b * barTicks + bt * beatTicks);
        if (beatX < 0 || beatX > W) continue;
        ctx.fillStyle = '#383858';
        ctx.fillRect(Math.round(beatX), 0, 1, H);

        // 16th lines
        for (let s = 1; s < 4; s++) {
          const sixX = tickToPx(b * barTicks + bt * beatTicks + s * s16th);
          if (sixX < 0 || sixX > W) continue;
          ctx.fillStyle = '#2a2a40';
          ctx.fillRect(Math.round(sixX), 0, 1, H);
        }
      }
    }

    // ── Notes ─────────────────────────────────────────────────────────────
    for (const e of noteEvents) {
      const note = e.note ?? BASE_NOTE;
      const x    = tickToPx(e.tick);
      const w    = Math.max(4, tickToPx(e.tick + e.duration) - x);
      const y    = noteToPy(note);
      if (x + w < 0 || x > W) continue;
      if (y + ROW_HEIGHT < 0 || y > H) continue;

      const sel = selectedNote && selectedNote.tick === e.tick && selectedNote.note === note;
      ctx.fillStyle = sel ? NOTE_COLOR_SEL : velocityColor(e.velocity);
      ctx.fillRect(x, y + 1, w, ROW_HEIGHT - 2);
      ctx.fillStyle = NOTE_COLOR_BORDER;
      ctx.fillRect(x, y + 1, 1, ROW_HEIGHT - 2);
      ctx.fillRect(x, y + 1, w, 1);
      ctx.fillRect(x + w - 1, y + 1, 1, ROW_HEIGHT - 2);

      // Resize grip on the right edge, when the note is wide enough to show one.
      if (w >= RESIZE_GRIP + 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x + w - 4, y + 4, 1, ROW_HEIGHT - 8);
        ctx.fillRect(x + w - 6, y + 4, 1, ROW_HEIGHT - 8);
      }
    }

    // ── Playhead ──────────────────────────────────────────────────────────
    if (playheadTick >= 0) {
      const phX = tickToPx(playheadTick);
      if (phX >= 0 && phX <= W) {
        ctx.fillStyle = 'rgba(255,80,80,0.85)';
        ctx.fillRect(Math.round(phX), 0, 2, H);
      }
    }
  }, [scrollTick, scrollNote, ticksPerPx, tickToPx, noteToPy, noteEvents, selectedNote, project.timeSignature, isInScale]);

  const drawVelocity = useCallback(() => {
    const canvas = velCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#111116';
    ctx.fillRect(0, 0, W, H);

    for (const e of noteEvents) {
      const note = e.note ?? BASE_NOTE;
      const x  = tickToPx(e.tick);
      const bw = Math.max(3, Math.min(12, (e.duration / ticksPerPx)));
      if (x + bw < 0 || x > W) continue;
      const sel = selectedNote && selectedNote.tick === e.tick && selectedNote.note === note;
      const barH = Math.max(2, Math.round((e.velocity / 127) * (H - 4)));
      ctx.fillStyle = sel ? '#f0a040' : velocityColor(e.velocity, true);
      ctx.fillRect(x, H - barH - 2, Math.max(2, bw - 1), barH);
    }

    // Label
    ctx.fillStyle = '#444454';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('VEL', 2, 9);
  }, [tickToPx, noteEvents, selectedNote, ticksPerPx]);

  const drawRuler = useCallback(() => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#101014';
    ctx.fillRect(0, 0, W, H);

    const barTicks  = ticksPerBar(project.timeSignature);
    const beatTicks = TICKS_PER_BEAT;
    const startBar  = Math.floor(scrollTick / barTicks);
    const endBar    = Math.ceil((scrollTick + W * ticksPerPx) / barTicks) + 1;

    for (let b = startBar; b <= endBar; b++) {
      const barX = tickToPx(b * barTicks);
      if (barX > W) continue;
      if (barX >= 0) {
        ctx.fillStyle = '#5050a0';
        ctx.fillRect(Math.round(barX), 0, 1, H);
        ctx.fillStyle = '#8888c0';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${b + 1}`, barX + 3, H / 2);
      }
      // Beat ticks
      for (let bt = 1; bt < project.timeSignature[0]; bt++) {
        const beatX = tickToPx(b * barTicks + bt * beatTicks);
        if (beatX < 0 || beatX > W) continue;
        ctx.fillStyle = '#33335a';
        ctx.fillRect(Math.round(beatX), H * 0.5, 1, H * 0.5);
      }
    }
    // Bottom border
    ctx.fillStyle = '#2a2a40';
    ctx.fillRect(0, H - 1, W, 1);
  }, [scrollTick, ticksPerPx, tickToPx, project.timeSignature]);

  // ── Animation loop (playhead update) ─────────────────────────────────────
  useEffect(() => {
    let lastTick = -9999;
    const loop = () => {
      const tick = engine.telemetry.playing ? engine.telemetry.positionTicks % totalTicks : -1;
      if (Math.abs(tick - lastTick) > 0.5) {
        lastTick = tick;
        drawGrid(tick);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawGrid, totalTicks]);

  // ── Redraw on data change ────────────────────────────────────────────────
  useEffect(() => {
    drawPiano();
  }, [drawPiano]);

  useEffect(() => {
    drawVelocity();
  }, [drawVelocity]);

  useEffect(() => {
    drawRuler();
  }, [drawRuler]);

  // ── Canvas sizing ─────────────────────────────────────────────────────────
  useEffect(() => {
    const gc = gridCanvasRef.current;
    if (gc) { gc.width = gridW; gc.height = gridH; }
    const pc = pianoCanvasRef.current;
    if (pc) { pc.width = PIANO_WIDTH; pc.height = gridH; }
    const vc = velCanvasRef.current;
    if (vc) { vc.width = gridW; vc.height = velH; }
    const rc = rulerCanvasRef.current;
    if (rc) { rc.width = gridW; rc.height = RULER_H; }
    drawPiano();
    drawGrid(-1);
    drawVelocity();
    drawRuler();
  }, [gridW, gridH, velH, drawPiano, drawGrid, drawVelocity, drawRuler]);

  // ── Pointer events for grid canvas ────────────────────────────────────────
  const getGridPointerPos = (e: React.PointerEvent) => {
    const rect = gridCanvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onGridPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getGridPointerPos(e);
    dragStart.current = { x, y };

    const rawTick = pxToTick(x);
    const note    = pxToNote(y);
    const snapped = snapTick(rawTick);
    const found   = findEvent(rawTick, note);

    // Right-click (desktop) or the ERASE tool deletes the note under the pointer.
    if (e.button === 2 || e.buttons === 2 || tool === 'erase') {
      erasing.current = tool === 'erase';   // enables swipe-to-erase on move
      if (found) {
        pianoRollDeleteNote(found.tick, found.note ?? BASE_NOTE);
        setSelectedNote(null);
      }
      return;
    }

    if (found) {
      // Check resize handle
      if (isResizeHandle(found, x, y)) {
        dragMode.current  = 'resize';
        dragNote.current  = { tick: found.tick, note: found.note ?? BASE_NOTE };
        dragOrigTick.current = found.duration;
      } else {
        dragMode.current  = 'move';
        dragNote.current  = { tick: found.tick, note: found.note ?? BASE_NOTE };
        dragOrigTick.current = found.tick;
        dragOrigNote.current = found.note ?? BASE_NOTE;
      }
      setSelectedNote({ tick: found.tick, note: found.note ?? BASE_NOTE });
    } else if (tool === 'draw') {
      // Draw a new note. SELECT tool never creates notes on empty space.
      dragMode.current = 'draw';
      const drawNote = snapToScale(note);
      const newNote: NoteRef = { tick: snapped, note: drawNote };
      dragNewNote.current = newNote;
      dragNote.current    = newNote;
      pianoRollAddNote(snapped, drawNote, quantize, 100);
      setSelectedNote({ tick: snapped, note: drawNote });
    }
  };

  const onGridPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Swipe-to-erase: while ERASE is held, delete any note dragged across.
    if (erasing.current) {
      const p = getGridPointerPos(e);
      const found = findEvent(pxToTick(p.x), pxToNote(p.y));
      if (found) {
        pianoRollDeleteNote(found.tick, found.note ?? BASE_NOTE);
        setSelectedNote(null);
      }
      return;
    }
    if (dragMode.current === 'none') return;
    const { x, y } = getGridPointerPos(e);
    const rawTick = pxToTick(x);
    const note    = pxToNote(y);
    const snapped = snapTick(rawTick);

    if (dragMode.current === 'draw') {
      // Extend drawn note duration
      const dn = dragNewNote.current;
      if (!dn) return;
      const dur = Math.max(quantize, snapTick(rawTick) - dn.tick + quantize);
      pianoRollResizeNote(dn.tick, dn.note, dur);
    } else if (dragMode.current === 'move') {
      const dn = dragNote.current;
      if (!dn) return;
      const newTick = Math.max(0, snapped);
      const newNote = snapToScale(Math.max(0, Math.min(127, note)));
      if (newTick !== dn.tick || newNote !== dn.note) {
        pianoRollMoveNote(dn.tick, dn.note, newTick, newNote);
        dragNote.current = { tick: newTick, note: newNote };
        setSelectedNote({ tick: newTick, note: newNote });
      }
    } else if (dragMode.current === 'resize') {
      const dn = dragNote.current;
      if (!dn) return;
      const newDur = Math.max(quantize, snapTick(rawTick) - dn.tick + quantize);
      pianoRollResizeNote(dn.tick, dn.note, newDur);
    }
  };

  const onGridPointerUp = () => {
    dragMode.current = 'none';
    dragNewNote.current = null;
    erasing.current = false;
  };

  // Scroll on wheel
  const onGridWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const factor = e.deltaY > 0 ? 1.25 : 0.8;
      setTicksPerPx((prev) => Math.max(MIN_TICKS_PER_PX, Math.min(MAX_TICKS_PER_PX, prev * factor)));
    } else if (e.shiftKey) {
      // Horizontal scroll
      setScrollTick((prev) => {
        const next = prev + e.deltaY * ticksPerPx * 0.5;
        return Math.max(0, Math.min(totalTicks - 1, next));
      });
    } else {
      // Vertical scroll
      setScrollNote((prev) => {
        const next = prev + (e.deltaY > 0 ? 3 : -3);
        return Math.max(0, Math.min(TOTAL_NOTES - 1, next));
      });
    }
  };

  // ── Pointer events for velocity lane ─────────────────────────────────────
  const onVelPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragMode.current = 'velocity';
    const rect = velCanvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const H = velH;
    // Find nearest event by x
    let best: SeqEvent | null = null;
    let bestDist = Infinity;
    for (const ev of noteEvents) {
      const ex = tickToPx(ev.tick);
      const d = Math.abs(ex - x);
      if (d < bestDist && d < 20) { bestDist = d; best = ev; }
    }
    if (best) {
      const normY = 1 - (y / H);
      const vel   = Math.max(1, Math.min(127, Math.round(normY * 127)));
      const note  = best.note ?? BASE_NOTE;
      pianoRollSetVelocity(best.tick, note, vel);
      setSelectedNote({ tick: best.tick, note });
    }
  };

  const onVelPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragMode.current !== 'velocity') return;
    if (!selectedNote) return;
    const rect = velCanvasRef.current!.getBoundingClientRect();
    const y    = e.clientY - rect.top;
    const H    = velH;
    const normY = 1 - (y / H);
    const vel   = Math.max(1, Math.min(127, Math.round(normY * 127)));
    pianoRollSetVelocity(selectedNote.tick, selectedNote.note, vel);
  };

  const onVelPointerUp = () => { dragMode.current = 'none'; };

  // ── Pointer events for piano keyboard ────────────────────────────────────
  const onPianoPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = pianoCanvasRef.current!.getBoundingClientRect();
    const y    = e.clientY - rect.top;
    const note = pxToNote(y);
    pianoHover.current = note;
    // Audition: trigger pad with this pitch offset
    engine.triggerWithNote(selectedPad, 100, engine.ctx?.currentTime ?? 0, note);
    drawPiano();
  };

  const onPianoPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = pianoCanvasRef.current!.getBoundingClientRect();
    const y    = e.clientY - rect.top;
    const note = pxToNote(y);
    if (note !== pianoHover.current) {
      pianoHover.current = note;
      drawPiano();
    }
  };

  const onPianoPointerUp = () => {
    pianoHover.current = -1;
    drawPiano();
  };

  // ── Scroll bounds + thumb geometry ───────────────────────────────────────
  const visibleRows   = Math.max(1, Math.floor(gridH / ROW_HEIGHT));
  const maxScrollNote = Math.max(0, TOTAL_NOTES - visibleRows);
  const visibleTicks  = gridW * ticksPerPx;
  const maxScrollTick = Math.max(0, totalTicks - visibleTicks);

  const vThumbH   = Math.max(24, Math.min(gridH, (visibleRows / TOTAL_NOTES) * gridH));
  const vThumbTop = maxScrollNote > 0 ? (scrollNote / maxScrollNote) * (gridH - vThumbH) : 0;
  const hThumbW   = Math.max(24, Math.min(gridW, (visibleTicks / totalTicks) * gridW));
  const hThumbLeft = maxScrollTick > 0 ? (scrollTick / maxScrollTick) * (gridW - hThumbW) : 0;

  // ── Toolbar actions ────────────────────────────────────────────────────────
  const zoomIn  = () => setTicksPerPx((t) => Math.max(MIN_TICKS_PER_PX, t * 0.7));
  const zoomOut = () => setTicksPerPx((t) => Math.min(MAX_TICKS_PER_PX, t * 1.4));
  const octaveUp   = () => setScrollNote((n) => Math.max(0, n - 12));            // higher pitch = up
  const octaveDown = () => setScrollNote((n) => Math.min(maxScrollNote, n + 12));

  // ── Scrollbar thumb dragging ──────────────────────────────────────────────
  const moveVScroll = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrollDrag.current !== 'v') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
    setScrollNote(Math.round(frac * maxScrollNote));
  };
  const onVScrollDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    scrollDrag.current = 'v';
    moveVScroll(e);
  };
  const moveHScroll = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrollDrag.current !== 'h') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    setScrollTick(Math.round(frac * maxScrollTick));
  };
  const onHScrollDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    scrollDrag.current = 'h';
    moveHScroll(e);
  };
  const onScrollUp = () => { scrollDrag.current = null; };
  const clearAll = () => {
    // Delete all notes for this pad by simply bulk-deleting via updateProject
    const { bank: b, seqSlot: sl } = useStore.getState();
    const proj = useStore.getState().project;
    const sequences = proj.sequences.map((row, bi) =>
      bi === b
        ? row.map((s, si) =>
            si === sl
              ? { ...s, events: s.events.filter((ev) => ev.pad !== selectedPad) }
              : s
          )
        : row
    );
    useStore.getState().updateProject({ sequences });
    setSelectedNote(null);
  };

  const QUANTIZE_OPTIONS: { label: string; value: number }[] = [
    { label: '1/4',  value: TICKS_PER_BEAT },
    { label: '1/8',  value: TICKS_PER_BEAT / 2 },
    { label: '1/16', value: TICKS_PER_16TH },
    { label: '1/32', value: TICKS_PER_16TH / 2 },
  ];

  return (
    <div className="pianoroll">
      {/* Toolbar */}
      <div className="pianoroll__toolbar">
        <span className="pianoroll__title">PIANO ROLL — {padName}</span>

        <div className="pianoroll__tools">
          {(['draw', 'select', 'erase'] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`pianoroll__btn ${tool === t ? 'pianoroll__btn--active' : ''}`}
              onClick={() => setTool(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <button className="pianoroll__btn" type="button" onClick={zoomIn}>ZOOM+</button>
        <button className="pianoroll__btn" type="button" onClick={zoomOut}>ZOOM−</button>
        <button className="pianoroll__btn" type="button" onClick={octaveUp}>OCT+</button>
        <button className="pianoroll__btn" type="button" onClick={octaveDown}>OCT−</button>
        <button
          className={`pianoroll__btn ${showKeys ? 'pianoroll__btn--active' : ''}`}
          type="button"
          onClick={() => setShowKeys((v) => !v)}
        >
          KEYS
        </button>

        <select
          className="pianoroll__select"
          value={quantize}
          onChange={(e) => setQuantize(Number(e.target.value))}
          aria-label="Quantize"
        >
          {QUANTIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="pianoroll__select"
          value={scaleType}
          onChange={(e) => setScaleType(e.target.value as ScaleType)}
          aria-label="Scale"
        >
          <option value="off">No scale</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>

        {scaleType !== 'off' && (
          <select
            className="pianoroll__select"
            value={scaleRoot}
            onChange={(e) => setScaleRoot(Number(e.target.value))}
            aria-label="Scale root"
          >
            {NOTE_NAMES.map((n, i) => (
              <option key={n} value={i}>{n}</option>
            ))}
          </select>
        )}

        {scaleType !== 'off' && (
          <button
            className={`pianoroll__btn ${snapScale ? 'pianoroll__btn--active' : ''}`}
            type="button"
            onClick={() => setSnapScale((v) => !v)}
            title="Force drawn/moved notes into the selected scale"
          >
            SNAP
          </button>
        )}

        <button
          className="pianoroll__btn pianoroll__btn--danger"
          type="button"
          onClick={clearAll}
        >
          CLEAR
        </button>

        <button
          className="pianoroll__btn pianoroll__btn--close"
          type="button"
          onClick={() => setScreen('seq')}
        >
          CLOSE
        </button>
      </div>

      {!pad.sampleId && (
        <div className="pianoroll__hint">
          No sample loaded on {padName} — SAMPLE SELECT to add one, then come
          back and draw notes.
        </div>
      )}

      {/* Main area: piano keyboard + note grid */}
      <div className="pianoroll__main">
        {/* Piano keyboard */}
        <div
          className="pianoroll__piano"
          style={{ width: PIANO_WIDTH, minWidth: PIANO_WIDTH }}
        >
          <canvas
            ref={pianoCanvasRef}
            className="pianoroll__piano-canvas"
            width={PIANO_WIDTH}
            height={gridH}
            style={{ width: PIANO_WIDTH, height: gridH, display: 'block' }}
            onPointerDown={onPianoPointerDown}
            onPointerMove={onPianoPointerMove}
            onPointerUp={onPianoPointerUp}
            onPointerLeave={onPianoPointerUp}
          />
        </div>

        {/* Grid + velocity stacked */}
        <div ref={gridAreaRef} className="pianoroll__grid-area">
          {/* Timeline ruler */}
          <canvas
            ref={rulerCanvasRef}
            className="pianoroll__ruler"
            width={gridW}
            height={RULER_H}
            style={{ width: gridW, height: RULER_H, display: 'block' }}
          />
          {/* Note grid */}
          <div className="pianoroll__grid-scroll" style={{ height: gridH }}>
            <canvas
              ref={gridCanvasRef}
              className="pianoroll__grid-canvas"
              width={gridW}
              height={gridH}
              style={{ width: gridW, height: gridH, display: 'block' }}
              onPointerDown={onGridPointerDown}
              onPointerMove={onGridPointerMove}
              onPointerUp={onGridPointerUp}
              onPointerLeave={onGridPointerUp}
              onWheel={onGridWheel}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>

          {/* Velocity lane */}
          <div className="pianoroll__velocity" style={{ height: velH }}>
            <canvas
              ref={velCanvasRef}
              className="pianoroll__velocity-canvas"
              width={gridW}
              height={velH}
              style={{ width: gridW, height: velH, display: 'block' }}
              onPointerDown={onVelPointerDown}
              onPointerMove={onVelPointerMove}
              onPointerUp={onVelPointerUp}
              onPointerLeave={onVelPointerUp}
            />
          </div>

          {/* Horizontal (time) scrollbar */}
          <div
            className="pianoroll__scrollbar-h"
            style={{ height: H_SCROLLBAR }}
            onPointerDown={onHScrollDown}
            onPointerMove={moveHScroll}
            onPointerUp={onScrollUp}
            onPointerLeave={onScrollUp}
          >
            <div
              className="pianoroll__scrollbar-h-thumb"
              style={{ left: hThumbLeft, width: hThumbW }}
            />
          </div>
        </div>

        {/* Vertical (pitch) scrollbar */}
        <div
          className="pianoroll__scrollbar-v"
          style={{ width: V_SCROLLBAR, height: gridH }}
          onPointerDown={onVScrollDown}
          onPointerMove={moveVScroll}
          onPointerUp={onScrollUp}
          onPointerLeave={onScrollUp}
        >
          <div
            className="pianoroll__scrollbar-v-thumb"
            style={{ top: vThumbTop, height: vThumbH }}
          />
        </div>
      </div>

      {showKeys && (
        <PianoKeyboard padIndex={selectedPad} bank={bank} isInScale={isInScale} />
      )}
    </div>
  );
}

// ─── Playable keyboard strip ───────────────────────────────────────────────
// A real instrument built from the selected pad's sample: plays it chromatically
// via the shared engine (any sample becomes playable), polyphonic + multi-touch
// with per-note release, velocity from finger height, and — while the transport
// is recording — writes the played notes straight into this pad's track.
const KB_OCTAVES = 2;
const KB_WHITE = [0, 2, 4, 5, 7, 9, 11];   // C D E F G A B offsets
const KB_BLACK_AFTER = [0, 1, 3, 4, 5];    // white indices a black key sits after
const KB_CONTROLS_H = 26;
const KB_KEYS_H = 104;

function PianoKeyboard({
  padIndex,
  bank,
  isInScale,
}: {
  padIndex: number;
  bank: number;
  isInScale: (n: number) => boolean;
}) {
  const [startNote, setStartNote] = useState(48);          // leftmost C = C3
  const [held, setHeld] = useState<Set<number>>(new Set());
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(1);
  const pointers = useRef<Map<number, number>>(new Map());
  const H = KB_KEYS_H;
  const numWhite = KB_OCTAVES * 7;
  const ww = w / numWhite;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setW(Math.max(1, el.getBoundingClientRect().width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const whiteKeys = useMemo(() => {
    const arr: { note: number; x: number }[] = [];
    let idx = 0;
    for (let o = 0; o < KB_OCTAVES; o++) {
      for (let wi = 0; wi < 7; wi++) {
        arr.push({ note: startNote + o * 12 + KB_WHITE[wi], x: idx * ww });
        idx++;
      }
    }
    return arr;
  }, [startNote, ww]);

  const blackKeys = useMemo(() => {
    const arr: { note: number; x: number; w: number }[] = [];
    const bw = ww * 0.62;
    for (let o = 0; o < KB_OCTAVES; o++) {
      for (const ba of KB_BLACK_AFTER) {
        const centerX = (o * 7 + ba + 1) * ww;
        arr.push({ note: startNote + o * 12 + KB_WHITE[ba] + 1, x: centerX - bw / 2, w: bw });
      }
    }
    return arr;
  }, [startNote, ww]);

  const noteAt = useCallback((x: number, y: number) => {
    if (y < H * 0.6) {
      for (const bk of blackKeys) if (x >= bk.x && x < bk.x + bk.w) return bk.note;
    }
    const wi = Math.max(0, Math.min(numWhite - 1, Math.floor(x / ww)));
    return whiteKeys[wi].note;
  }, [blackKeys, whiteKeys, ww, numWhite, H]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, H);
    for (const wk of whiteKeys) {
      const on = held.has(wk.note);
      ctx.fillStyle = on ? '#c43a2e' : (isInScale(wk.note) ? '#e8e8e4' : '#c2c2b8');
      ctx.fillRect(wk.x + 1, 0, ww - 2, H - 1);
      if (wk.note % 12 === 0) {
        ctx.fillStyle = on ? '#fff' : '#666';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`C${Math.floor(wk.note / 12) - 1}`, wk.x + ww / 2, H - 3);
      }
    }
    for (const bk of blackKeys) {
      const on = held.has(bk.note);
      ctx.fillStyle = on ? '#e0503f' : (isInScale(bk.note) ? '#1c1c22' : '#3a3a42');
      ctx.fillRect(bk.x, 0, bk.w, H * 0.6);
    }
  }, [w, H, whiteKeys, blackKeys, held, isInScale, ww]);

  useEffect(() => {
    const c = canvasRef.current;
    if (c) { c.width = w; c.height = H; }
    draw();
  }, [w, H, draw]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const velFromY = (y: number) => Math.max(1, Math.min(127, Math.round(40 + (y / H) * 87)));

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    const note = noteAt(x, y);
    const vel = velFromY(y);
    pointers.current.set(e.pointerId, note);
    engine.triggerWithNote(padIndex, vel, engine.ctx?.currentTime ?? 0, note);
    engine.recordHit(padIndex, vel, padIndex, bank, note);   // no-op unless recording live
    setHeld(new Set(pointers.current.values()));
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const { x, y } = pos(e);
    const note = noteAt(x, y);
    const prev = pointers.current.get(e.pointerId)!;
    if (note !== prev) {
      engine.releaseNote(padIndex, prev, bank);
      pointers.current.set(e.pointerId, note);
      const vel = velFromY(y);
      engine.triggerWithNote(padIndex, vel, engine.ctx?.currentTime ?? 0, note);
      engine.recordHit(padIndex, vel, padIndex, bank, note);
      setHeld(new Set(pointers.current.values()));
    }
  };

  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const note = pointers.current.get(e.pointerId);
    if (note !== undefined) engine.releaseNote(padIndex, note, bank);
    pointers.current.delete(e.pointerId);
    setHeld(new Set(pointers.current.values()));
  };

  return (
    <div className="pianoroll__keyboard" style={{ height: KB_CONTROLS_H + KB_KEYS_H }}>
      <div className="pianoroll__kb-controls" style={{ height: KB_CONTROLS_H }}>
        <button className="pianoroll__btn" type="button" onClick={() => setStartNote((n) => Math.max(0, n - 12))}>◀ OCT</button>
        <span className="pianoroll__kb-title">PLAY — draws the selected pad chromatically</span>
        <button className="pianoroll__btn" type="button" onClick={() => setStartNote((n) => Math.min(108, n + 12))}>OCT ▶</button>
      </div>
      <div ref={wrapRef} className="pianoroll__kb-keys" style={{ height: H }}>
        <canvas
          ref={canvasRef}
          width={w}
          height={H}
          style={{ width: '100%', height: H, display: 'block', touchAction: 'none' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}
