import type { StateCreator } from 'zustand';
import { TICKS_PER_16TH } from '../../audio/types';
import type { SeqEvent } from '../../audio/types';
import type { UIState } from '../store';

export type ChannelRackSlice = Pick<UIState,
  | 'toggleStep' | 'setStepVelocity' | 'clearChannel'
>;

const TOL = TICKS_PER_16TH / 2;

/**
 * Channel-rack step grid maps 1:1 onto the active pattern's events: a "step"
 * for pad P at index S is an event at tick `S * TICKS_PER_16TH` with `pad === P`
 * and no pitch offset (drum-machine semantics). All edits go through the same
 * immutable `sequences` update the rest of the app uses.
 */
export const createChannelRackSlice: StateCreator<UIState, [], [], ChannelRackSlice> = (_set, get) => {
  /** Write new events into the active (bank, slot) sequence, immutably. */
  const writeEvents = (events: SeqEvent[]) => {
    const { project, bank, seqSlot } = get();
    const banks = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences: banks });
  };

  const insertSorted = (events: SeqEvent[], ev: SeqEvent): SeqEvent[] => {
    const next = [...events];
    const i = next.findIndex((e) => e.tick > ev.tick);
    if (i === -1) next.push(ev);
    else next.splice(i, 0, ev);
    return next;
  };

  return {
    toggleStep(pad, step, velocity = 100) {
      const { project, bank, seqSlot } = get();
      const seq = project.sequences[bank][seqSlot];
      const tick = step * TICKS_PER_16TH;
      const isOn = seq.events.some(
        (e) => e.pad === pad && (e.note === undefined || e.note === 60) && Math.abs(e.tick - tick) < TOL
      );
      if (isOn) {
        writeEvents(
          seq.events.filter(
            (e) => !(e.pad === pad && (e.note === undefined || e.note === 60) && Math.abs(e.tick - tick) < TOL)
          )
        );
      } else {
        writeEvents(insertSorted(seq.events, { tick, pad, bank, velocity, duration: TICKS_PER_16TH }));
      }
    },

    setStepVelocity(pad, step, velocity) {
      const { project, bank, seqSlot } = get();
      const seq = project.sequences[bank][seqSlot];
      const tick = step * TICKS_PER_16TH;
      const v = Math.max(1, Math.min(127, Math.round(velocity)));
      const matches = seq.events.filter(
        (e) => e.pad === pad && (e.note === undefined || e.note === 60) && Math.abs(e.tick - tick) < TOL
      );
      if (matches.length === 0) {
        // Dragging velocity on an empty step turns it on at that level.
        writeEvents(insertSorted(seq.events, { tick, pad, bank, velocity: v, duration: TICKS_PER_16TH }));
      } else {
        writeEvents(
          seq.events.map((e) =>
            e.pad === pad && (e.note === undefined || e.note === 60) && Math.abs(e.tick - tick) < TOL
              ? { ...e, velocity: v }
              : e
          )
        );
      }
    },

    clearChannel(pad) {
      const { project, bank, seqSlot } = get();
      const seq = project.sequences[bank][seqSlot];
      writeEvents(seq.events.filter((e) => e.pad !== pad));
    },
  };
};
