import type { StateCreator } from 'zustand';
import { engine } from '../../audio/engine';
import type { UIState } from '../store';

export type FxSlice = Pick<UIState,
  | 'flexBeat' | 'knobFXParams' | 'knobFXShiftParams' | 'knobFXRouting' | 'knobFXBypass'
  | 'inputConfig' | 'knobFX' | 'activePadFX'
  | 'setKnobFXParam' | 'setKnobFXShiftParam' | 'toggleKnobFXPad' | 'setAllKnobFXPads'
  | 'toggleKnobFXBypass' | 'setFlexBeat' | 'selectFlexBeatPad' | 'setInputConfig' | 'setKnobFX'
  | 'pressPadFX' | 'releasePadFX' | 'togglePadFXLatch'
>;

export const createFxSlice: StateCreator<UIState, [], [], FxSlice> = (set, get) => ({
  flexBeat: { mode: 'loop', quantize: true, mix: 0.75, activePad: 0 },
  knobFXParams: [0.5, 0.5, 0.5],
  knobFXShiftParams: [0.5, 0.5, 0.5],
  knobFXRouting: Array.from({ length: 16 }, () => true),
  knobFXBypass: false,
  inputConfig: {
    source: 'mic',
    monitor: false,
    threshold: -40,
    recLength: 'FREE',
    recFx: false,
  },
  knobFX: 'off',
  activePadFX: null,

  setKnobFXParam(k, v) {
    engine.setKnobFXParam(k, v);
    const params = [...get().knobFXParams] as [number, number, number];
    params[k] = v;
    set({ knobFXParams: params });
  },

  setKnobFXShiftParam(k, v) {
    engine.setKnobFXShiftParam(k, v);
    const params = [...get().knobFXShiftParams] as [number, number, number];
    params[k] = v;
    set({ knobFXShiftParams: params });
  },

  toggleKnobFXPad(i) {
    const routing = [...get().knobFXRouting];
    routing[i] = !routing[i];
    engine.setKnobFXRouting(routing, get().knobFXBypass);
    set({ knobFXRouting: routing });
  },

  setAllKnobFXPads(on) {
    const routing = Array.from({ length: 16 }, () => on);
    engine.setKnobFXRouting(routing, get().knobFXBypass);
    set({ knobFXRouting: routing });
  },

  toggleKnobFXBypass() {
    const bypass = !get().knobFXBypass;
    engine.setKnobFXRouting(get().knobFXRouting, bypass);
    set({ knobFXBypass: bypass });
  },

  setFlexBeat(patch) {
    const next = { ...get().flexBeat, ...patch };
    engine.setFlexBeat(next);
    set({ flexBeat: next });
  },

  selectFlexBeatPad(pad) {
    engine.selectFlexBeatPad(pad);
    set({ flexBeat: { ...get().flexBeat, activePad: pad } });
  },

  setInputConfig(patch) {
    const next = { ...get().inputConfig, ...patch };
    if (patch.monitor !== undefined) {
      engine.setInputMonitor(patch.monitor);
    }
    set({ inputConfig: next });
  },

  setKnobFX(id) {
    void engine.setKnobFX(id);
    set({ knobFX: id });
    for (let k = 0; k < 3; k++) {
      engine.setKnobFXParam(k as 0 | 1 | 2, get().knobFXParams[k]);
    }
  },

  pressPadFX(id, amount) {
    engine.pressPadFX(id, amount);
    set({ activePadFX: id });
  },

  releasePadFX(id) {
    engine.releasePadFX(id);
    set({ activePadFX: null });
  },

  togglePadFXLatch(id) {
    engine.togglePadFXLatch(id);
  },
});
