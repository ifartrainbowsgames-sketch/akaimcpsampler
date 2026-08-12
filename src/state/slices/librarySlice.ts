import type { StateCreator } from 'zustand';
import type { Project } from '../../audio/types';
import { engine } from '../../audio/engine';
import { readSample, writeSample, listSamples, deleteSample } from '../../storage/opfs';
import { getChopLoadMode } from '../../storage/preferences';
import { FACTORY_KITS, generateFactoryKit } from '../../audio/factory/kits';
import { factoryKitPadDefaults } from '../../audio/factory/catalog';
import { demoHitsToEvents, getFactoryDemo } from '../../audio/factory/demos';
import { fetchFreesoundPreview, searchFreesound, checkFreesoundProxy } from '../../library/freesound';
import { history } from '../undo';
import type { UIState } from '../store';
import { applyFactoryKitToBank, chopTypeForSeconds } from './shared';

export type LibrarySlice = Pick<UIState,
  | 'browserEntries' | 'libraryResults' | 'libraryPage' | 'libraryNumPages' | 'libraryQuery'
  | 'libraryError' | 'libraryLoading' | 'libraryProxyReady' | 'loadProjectCategory'
  | 'refreshBrowser' | 'loadBrowserSample' | 'loadFactoryKit' | 'loadFactoryKitOnly' | 'loadFactoryDemo'
  | 'addKeygroupZone' | 'updateKeygroupZone' | 'removeKeygroupZone'
  | 'searchLibrary' | 'loadLibrarySound' | 'checkLibraryProxy' | 'deleteBrowserSample' | 'setLoadProjectCategory'
>;

export const createLibrarySlice: StateCreator<UIState, [], [], LibrarySlice> = (set, get) => ({
  browserEntries: [],
  libraryResults: [],
  libraryPage: 1,
  libraryNumPages: 1,
  libraryQuery: 'kick drum',
  libraryError: null,
  libraryLoading: false,
  libraryProxyReady: false,
  loadProjectCategory: 'user',

  async refreshBrowser() {
    const ids = await listSamples();
    const { project } = get();
    const names = new Map<string, string>();
    for (const bank of project.banks) {
      for (const pad of bank) {
        if (pad.sampleId) names.set(pad.sampleId, pad.sampleName || pad.sampleId.slice(0, 8));
      }
    }
    const entries = ids.map((id) => ({ id, name: names.get(id) ?? id.slice(0, 8) }));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    set({ browserEntries: entries });
  },

  async loadBrowserSample(id) {
    const data = await readSample(id);
    if (!data) return;
    try {
      await engine.loadSample(id, data);
    } catch {
      return;
    }
    const buffer = engine.getBuffer(id);
    if (!buffer) return;
    const { selectedPad } = get();
    get().updatePad(selectedPad, {
      sampleId: id,
      sampleName: get().browserEntries.find((e) => e.id === id)?.name ?? 'Sample',
      start: 0,
      end: buffer.length,
      loopStart: 0,
      slices: [],
    });
    set({ screen: 'sample' });
  },

  async addKeygroupZone(browserId) {
    const data = await readSample(browserId);
    if (!data) return;
    try {
      await engine.loadSample(browserId, data);
    } catch {
      return;
    }
    if (!engine.getBuffer(browserId)) return;
    const { selectedPad, project, bank } = get();
    const pad = project.banks[bank][selectedPad];
    const name = get().browserEntries.find((e) => e.id === browserId)?.name ?? 'Sample';
    const zones = [
      ...(pad.zones ?? []),
      { sampleId: browserId, sampleName: name, rootNote: 60, loNote: 0, hiNote: 127, loVel: 1, hiVel: 127 },
    ];
    get().updatePad(selectedPad, { zones });
  },

  updateKeygroupZone(index, patch) {
    const { selectedPad, project, bank } = get();
    const pad = project.banks[bank][selectedPad];
    if (!pad.zones) return;
    const zones = pad.zones.map((z, i) => (i === index ? { ...z, ...patch } : z));
    get().updatePad(selectedPad, { zones });
  },

  removeKeygroupZone(index) {
    const { selectedPad, project, bank } = get();
    const pad = project.banks[bank][selectedPad];
    if (!pad.zones) return;
    const zones = pad.zones.filter((_, i) => i !== index);
    get().updatePad(selectedPad, { zones: zones.length ? zones : undefined });
  },

  async loadFactoryKit(kitId) {
    if (!engine.ctx) await engine.init();
    const ctx = engine.ctx;
    if (!ctx) return;

    const kit = await generateFactoryKit(ctx, kitId);
    if (!kit) return;

    const meta = FACTORY_KITS.find((k) => k.id === kitId);
    const padDefaults = meta ? factoryKitPadDefaults(meta) : null;

    for (let i = 0; i < 16; i++) {
      const id = crypto.randomUUID();
      const buffer = kit.buffers[i];
      engine.putBuffer(id, buffer);
      const wav = await engine.bufferToWav(buffer).arrayBuffer();
      await writeSample(id, wav);

      const label = meta?.padNames[i] ?? `Pad ${i + 1}`;
      const loopStart = padDefaults?.loop
        ? Math.floor(buffer.length * padDefaults.loopStartRatio)
        : 0;

      get().updatePad(i, {
        sampleId: id,
        sampleName: `${meta?.name ?? kit.name}-${label}`.slice(0, 24),
        start: 0,
        end: buffer.length,
        loopStart,
        loop: padDefaults?.loop ?? false,
        slices: [],
        gain: meta?.defaultGain ?? 0,
        polyphony: padDefaults?.polyphony ?? 'mono',
      });
    }

    set({ selectedPad: 0, screen: 'sample' });
    engine.selectedPad = 0;
  },

  async loadFactoryKitOnly(kitId) {
    if (!engine.ctx) await engine.init();
    const ctx = engine.ctx;
    if (!ctx) return;
    const kit = await generateFactoryKit(ctx, kitId);
    if (!kit) return;
    const meta = FACTORY_KITS.find((k) => k.id === kitId);
    const padDefaults = meta ? factoryKitPadDefaults(meta) : null;
    history.push(get().project);
    for (let i = 0; i < 16; i++) {
      const buffer = kit.buffers[i];
      if (!buffer) continue;
      const id = crypto.randomUUID();
      engine.putBuffer(id, buffer);
      const wav = await engine.bufferToWav(buffer).arrayBuffer();
      await writeSample(id, wav);
      const label = meta?.padNames[i] ?? `Pad ${i + 1}`;
      const loopStart = padDefaults?.loop
        ? Math.floor(buffer.length * padDefaults.loopStartRatio)
        : 0;
      get().updatePad(i, {
        sampleId: id,
        sampleName: `${meta?.name ?? kit.name}-${label}`.slice(0, 24),
        start: 0,
        end: buffer.length,
        loopStart,
        loop: padDefaults?.loop ?? false,
        slices: [],
        gain: meta?.defaultGain ?? 0,
        polyphony: padDefaults?.polyphony ?? 'mono',
      });
    }
    set({ screen: 'sample' });
  },

  async loadFactoryDemo(demoId) {
    const demo = getFactoryDemo(demoId);
    if (!demo) return;
    if (!engine.ctx) await engine.init();
    const ctx = engine.ctx;
    if (!ctx) return;

    history.push(get().project);
    let project = get().project;
    project = await applyFactoryKitToBank(project, 0, demo.kitId, ctx);
    if (demo.melodyKitId) {
      project = await applyFactoryKitToBank(project, 1, demo.melodyKitId, ctx);
    }

    const events = demoHitsToEvents(demo.hits);
    const sequences = project.sequences.map((row, bi) =>
      bi === 0
        ? row.map((seq, si) =>
            si === 0
              ? { ...seq, name: demo.name, bars: demo.bars, events, bpm: demo.bpm }
              : { ...seq, events: [] }
          )
        : row
    );

    const next: Project = {
      ...project,
      name: demo.name,
      bpm: demo.bpm,
      swing: demo.swing ?? project.swing,
      sequences,
      song: [],
    };

    engine.setProject(next);
    engine.setBank(0);
    engine.setSequenceSlot(0);
    engine.selectedPad = 0;
    set({
      project: next,
      bank: 0,
      seqSlot: 0,
      selectedPad: 0,
      screen: 'seq',
      queuedSeqSlot: null,
    });
    get().play(false);
  },

  async checkLibraryProxy() {
    const ready = await checkFreesoundProxy();
    set({ libraryProxyReady: ready });
  },

  async searchLibrary(query, filter = 'duration:[0 TO 8]', page = 1) {
    set({ libraryLoading: true, libraryError: null, libraryQuery: query });
    try {
      const result = await searchFreesound(query, page, filter);
      set({
        libraryResults: result.sounds,
        libraryPage: result.page,
        libraryNumPages: result.numPages,
        libraryLoading: false,
      });
    } catch (e) {
      set({
        libraryError: e instanceof Error ? e.message : 'Search failed',
        libraryLoading: false,
        libraryResults: [],
      });
    }
  },

  async loadLibrarySound(sound) {
    set({ libraryLoading: true, libraryError: null });
    try {
      const data = await fetchFreesoundPreview(sound.id, sound.previewUrl);
      const id = `fs-${sound.id}`;
      const buffer = await engine.loadSample(id, data);
      await writeSample(id, data);
      const { selectedPad } = get();
      const isLoop = sound.duration >= 6;
      get().updatePad(selectedPad, {
        sampleId: id,
        sampleName: sound.name.slice(0, 24),
        start: 0,
        end: buffer.length,
        loopStart: 0,
        loop: isLoop,
        polyphony: isLoop ? 'poly' : 'mono',
        chopType: chopTypeForSeconds(sound.duration),
        slices: [],
      });
      set({ screen: 'sample', libraryLoading: false, selectedPad });
      engine.selectedPad = selectedPad;
      if (sound.duration >= 2) {
        const chopMode = getChopLoadMode();
        if (chopMode === 'auto') {
          queueMicrotask(() => get().chopSongToPads(selectedPad));
        } else if (chopMode === null) {
          set({ pendingChopPad: selectedPad });
        }
      }
    } catch (e) {
      set({
        libraryError: e instanceof Error ? e.message : 'Load failed',
        libraryLoading: false,
      });
    }
  },

  async deleteBrowserSample(id) {
    await deleteSample(id);
    await get().refreshBrowser();
  },

  setLoadProjectCategory(c) {
    set({ loadProjectCategory: c });
  },
});
