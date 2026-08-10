/** Computer keyboard → MIDI note (before octave/transpose mapping in engine). */
export const COMPUTER_KEY_MAP: Record<string, number> = {
  a: 60, // C4
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
};

export const PIANO_SHORTCUTS = {
  octaveDown: ['z', 'Z'],
  octaveUp: ['x', 'X'],
  sustain: [' '],
};

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
