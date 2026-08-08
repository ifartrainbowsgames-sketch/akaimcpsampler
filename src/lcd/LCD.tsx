import { useEffect, useState } from 'react';
import { saveProject, listProjects } from '../storage/projects';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { Waveform } from '../ui/Waveform';
import { WaveformSurface } from '../ui/WaveformSurface';
import { type KParam } from './pages';
import { resolveSamplePage, sampleTabLabel } from './samplePage';
import { KNOB_FX } from '../audio/fx/knobfx';
import { PAD_FX } from '../audio/fx/padfx';
import { SAMPLE_FILE_INPUT_ID } from '../sampleInput';
import { TICKS_PER_16TH } from '../audio/types';
import { FACTORY_KITS as FACTORY_KIT_LIST } from '../audio/factory/kits';
import { LibraryScreen } from './LibraryScreen';
import { HwSlider } from '../ui/HwSlider';

/**
 * The LCD is a screen router with a mode stack, so menus opened via Shift+Pad
 * return to whatever was underneath. Every screen declares its title, B-button
 * labels and K1-K3 parameters in one place rather than scattering them through
 * components.
 */
export function LCD() {
  const screen = useStore((s) => s.screen);
  const bGroup = useStore((s) => s.bGroup);
  const bPage = useStore((s) => s.bPage);
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const selectedPad = useStore((s) => s.selectedPad);
  const updatePad = useStore((s) => s.updatePad);
  const chopActive = useStore((s) => s.padModes.chop);
  const selectedSlice = useStore((s) => s.selectedSlice);
  const runChop = useStore((s) => s.runChop);
  const sliceAllToPads = useStore((s) => s.sliceAllToPads);
  const splitSelectedSlice = useStore((s) => s.splitSelectedSlice);
  const mergeSelectedSlice = useStore((s) => s.mergeSelectedSlice);
  const extractSelectedSlice = useStore((s) => s.extractSelectedSlice);
  const setBGroup = useStore((s) => s.setBGroup);
  const trimSelected = useStore((s) => s.trimSelected);
  const setTrimRegion = useStore((s) => s.setTrimRegion);
  const previewAtFrame = useStore((s) => s.previewAtFrame);
  const addManualChopPoint = useStore((s) => s.addManualChopPoint);
  const waveformZoom = useStore((s) => s.waveformZoom);
  const refreshBrowser = useStore((s) => s.refreshBrowser);
  const setScreen = useStore((s) => s.setScreen);

  const pad = project.banks[bank][selectedPad];
  const buffer = engine.getBuffer(pad.sampleId);
  const sampleLen = buffer?.length ?? 0;
  const padEnd = pad.end || sampleLen;
  const viewLen = waveformZoom > 1 ? Math.floor(sampleLen / waveformZoom) : sampleLen;
  const viewStart = waveformZoom > 1
    ? Math.max(0, Math.min(pad.start, sampleLen - viewLen))
    : 0;

  useEffect(() => {
    if (screen === 'browser') void refreshBrowser();
  }, [screen, refreshBrowser]);

  const [playhead, setPlayhead] = useState(-1);
  const [samplePh, setSamplePh] = useState(-1);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const frame = engine.telemetry.samplePlayhead[selectedPad];
      if (frame >= 0 && sampleLen > 0) {
        setSamplePh(frame / sampleLen);
        setPlayhead(-1);
      } else if (engine.telemetry.playing && screen !== 'sample') {
        const seq = engine.activeSequence();
        if (seq) {
          const total = seq.bars * 4 * 960;
          setPlayhead(engine.telemetry.positionTicks / total);
        }
        setSamplePh(-1);
      } else {
        setPlayhead(-1);
        setSamplePh(-1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [selectedPad, sampleLen, screen]);

  if (screen === 'sample') {
    const { params } = resolveSamplePage(
      bGroup, bPage, chopActive, selectedSlice, pad, project,
    );

    return (
      <div className="lcd">
        <div className="tabs">
          {TAB_INDICES.map((i) => (
            <button
              key={i}
              type="button"
              className={i === bGroup - 1 ? 'on' : ''}
              onClick={() => setBGroup((i + 1) as 1 | 2 | 3)}
            >
              {sampleTabLabel(i, chopActive && i === 0)}
            </button>
          ))}
        </div>

        <div className="infoline">
          <span className="padid">
            {String.fromCharCode(65 + bank)}
            {String(selectedPad + 1).padStart(2, '0')}
          </span>
          <span className="sname">{pad.sampleName || '(empty)'}</span>
          <span className="chips">
            {pad.noteOn && <i className="chip">♪</i>}
            {pad.loop && <i className="chip">⟳</i>}
            {pad.reverse && <i className="chip">←</i>}
            {chopActive && pad.slices.length > 0 && (
              <i className="chip">{selectedSlice + 1}/{pad.slices.length}</i>
            )}
          </span>
        </div>

        <div className="lcdmenu">
          <label htmlFor={SAMPLE_FILE_INPUT_ID} className="lcd-btn lcd-btn--upload">UPLOAD</label>
          <button type="button" className="lcd-btn" onClick={() => setScreen('browser')}>BROWSE</button>
          <button type="button" className="lcd-btn" onClick={() => setScreen('kits')}>KITS</button>
          <button type="button" className="lcd-btn lcd-btn--action" onClick={() => setScreen('library')}>FREESOUND</button>
        </div>

        {chopActive && (
          <div className="lcdchop">
            {pad.sampleId && (
              <button type="button" className="lcd-btn lcd-btn--ghost" onClick={runChop}>CHOP</button>
            )}
            <button type="button" className="lcd-btn lcd-btn--ghost" onClick={splitSelectedSlice}>SPLIT</button>
            <button type="button" className="lcd-btn lcd-btn--ghost" onClick={mergeSelectedSlice}>MERGE</button>
            <button type="button" className="lcd-btn lcd-btn--ghost" onClick={extractSelectedSlice}>EXTRACT</button>
            {pad.slices.length > 0 && (
              <button type="button" className="lcd-btn lcd-btn--action" onClick={sliceAllToPads}>TO PADS</button>
            )}
            {buffer && (pad.start > 0 || padEnd < sampleLen) && (
              <button type="button" className="lcd-btn lcd-btn--action" onClick={trimSelected}>APPLY TRIM</button>
            )}
          </div>
        )}

        <div className="lanes lanes--dual">
          <div className="lane lane--overview">
            <Waveform
              buffer={buffer}
              start={pad.start}
              end={padEnd}
              loopStart={pad.loopStart}
              slices={pad.slices}
              playhead={samplePh >= 0 ? samplePh : undefined}
              zoomWindow={waveformZoom > 1 ? { start: viewStart, len: viewLen } : undefined}
            />
          </div>
          <div className="lane lane--detail">
            <WaveformSurface
              buffer={buffer}
              start={pad.start}
              end={padEnd}
              loopStart={pad.loopStart}
              slices={pad.slices}
              playhead={
                samplePh >= 0
                  ? Math.max(0, Math.min(1, (samplePh * sampleLen - viewStart) / viewLen))
                  : playhead
              }
              zoom={waveformZoom}
              chopActive={chopActive && pad.chopType === 'manual'}
              onTrim={(s, e, l) => setTrimRegion(s, e, l)}
              onPreview={(norm) => {
                const frame = viewStart + norm * viewLen;
                previewAtFrame(frame);
              }}
              onSliceTap={addManualChopPoint}
            />
            {!buffer && (
              <label htmlFor={SAMPLE_FILE_INPUT_ID} className="lcd-load-cta">
                TAP TO LOAD
              </label>
            )}
          </div>
        </div>

        <Footline params={params} onChange={(p, v) => p.set(v, updatePad, selectedPad)} />
      </div>
    );
  }

  return (
    <div className="lcd">
      <div className="tabs">
        <div className="on">{SCREEN_TITLES[screen] ?? screen}</div>
      </div>
      <div className="lanes">
        <ScreenBody screen={screen} />
      </div>
      <KRow params={[]} onChange={() => {}} />
    </div>
  );
}

const SCREEN_TITLES: Record<string, string> = {
  seq: 'SEQUENCE', stepedit: 'STEP EDIT', song: 'SONG',
  browser: 'BROWSER', kits: 'KITS', library: 'FREESOUND', smprec: 'SAMPLE REC',
  padfx: 'PAD FX', flexbeat: 'FLEX BEAT', knobfx: 'KNOB FX',
  comp: 'COMPRESSOR', inputcfg: 'INPUT CONFIG', fadermenu: 'FADER',
  timecorr: 'TIME CORRECT', midi: 'MIDI CONFIG', project: 'PROJECT',
};

const TAB_INDICES = [0, 1, 2];

function Footline({
  params,
  onChange,
}: {
  params: KParam[];
  onChange(p: KParam, v: number): void;
}) {
  return (
    <div className="footline">
      {[0, 1, 2].map((i) => {
        const p = params[i];
        return p ? (
          <HwSlider
            key={i}
            label={p.name}
            value={p.norm}
            onChange={(v) => onChange(p, v)}
          />
        ) : (
          <div key={i} className="footcell">
            <span>—</span>
            <div className="hwslider hwslider--empty" />
          </div>
        );
      })}
    </div>
  );
}

function KRow({
  params,
  onChange,
}: {
  params: KParam[];
  onChange(p: KParam, v: number): void;
}) {
  return (
    <div className="krow">
      {[0, 1, 2].map((i) => {
        const p = params[i];
        return (
          <div className="kcell" key={i}>
            <div className="kname">{p?.name ?? '—'}</div>
            <div className="kval">{p ? p.display : '—'}</div>
            {p && (
              <input
                className="kslider"
                type="range"
                min={0}
                max={1000}
                value={Math.round(p.norm * 1000)}
                onChange={(e) => onChange(p, Number(e.target.value) / 1000)}
                aria-label={p.name}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScreenBody({ screen }: { screen: string }) {
  const project = useStore((s) => s.project);
  const updateProject = useStore((s) => s.updateProject);

  switch (screen) {
    case 'seq': {
      const seqSlot = useStore.getState().seqSlot;
      const bank = useStore.getState().bank;
      const seq = project.sequences[bank][seqSlot];
      const countIn = project.countIn;
      const metro = project.metronome;
      return (
        <div className="lcdpanel">
          <div className="big">Seq {seqSlot + 1}: {seq.name}</div>
          <div className="lcdrow"><span>Events</span><b>{seq.events.length}</b></div>
          <div className="lcdrow"><span>Length</span><b>{seq.bars} bars</b></div>
          <Row label="Tempo">
            <input
              type="range" min={40} max={200} step={0.5}
              value={project.bpm}
              onChange={(e) => updateProject({ bpm: Number(e.target.value) })}
            />
            <b>{project.bpm.toFixed(1)}</b>
          </Row>
          <Row label="Swing">
            <input
              type="range" min={50} max={75} step={0.5}
              value={project.swing}
              onChange={(e) => updateProject({ swing: Number(e.target.value) })}
            />
            <b>{project.swing.toFixed(1)}%</b>
          </Row>
          <div className="lcdrow">
            <span>Metro</span>
            <b>{metro.toUpperCase()}</b>
            <button type="button" className="lcd-mini" onClick={() => useStore.getState().toggleMetronome()}>⇄</button>
          </div>
          <div className="lcdrow">
            <span>Count-in</span>
            <b>{countIn ? '1 bar' : 'Off'}</b>
          </div>
          <div className="hintline">
            Tap a pad to pick seq 1–16 (when stopped). SEQ RECORD arms + starts transport.
          </div>
        </div>
      );
    }

    case 'project':
      return <ProjectScreen />;

    case 'loadproj':
      return <LoadProjectScreen />;

    case 'knobfx':
      return <KnobFXScreen />;

    case 'padfx':
      return <PadFXScreen />;

    case 'flexbeat':
      return <FlexBeatScreen />;

    case 'browser':
      return <BrowserScreen />;

    case 'kits':
      return <KitsScreen />;

    case 'library':
      return <LibraryScreen />;

    case 'stepedit':
      return <StepEditScreen />;

    case 'fadermenu':
      return <FaderMenuScreen />;

    case 'timecorr':
      return <TimeCorrectScreen />;

    case 'inputcfg':
      return <InputConfigScreen />;

    case 'song':
      return <SongScreen />;

    case 'smprec':
      return <RecordScreen />;

    case 'midi':
      return <MidiScreen />;

    case 'comp':
      return <CompressorScreen />;

    default:
      return (
        <div className="lcdpanel">
          <div className="pending">
            {SCREEN_TITLES[screen] ?? screen} — not yet implemented
          </div>
          <div className="hintline">See BUILD_PLAN.md Appendix A for the spec.</div>
        </div>
      );
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lcdrow">
      <span>{label}</span>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ screens */

function KnobFXScreen() {
  const knobFX = useStore((s) => s.knobFX);
  const setKnobFX = useStore((s) => s.setKnobFX);
  const def = KNOB_FX.find((f) => f.id === knobFX) ?? KNOB_FX[0];

  return (
    <div className="lcdpanel">
      <div className="lcdselect">
        <select value={knobFX} onChange={(e) => setKnobFX(e.target.value as never)}>
          {KNOB_FX.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>
      {[0, 1, 2].map((k) => (
        <div className="lcdrow" key={k}>
          <span>{def.params[k]}</span>
          <input
            type="range" min={0} max={1000} defaultValue={500}
            disabled={def.params[k] === '—'}
            onChange={(e) => engine.setKnobFXParam(k as 0 | 1 | 2, Number(e.target.value) / 1000)}
          />
        </div>
      ))}
      <div className="hintline">Applied to the master bus.</div>
    </div>
  );
}

function PadFXScreen() {
  const pressPadFX = useStore((s) => s.pressPadFX);
  const releasePadFX = useStore((s) => s.releasePadFX);
  const active = useStore((s) => s.activePadFX);

  return (
    <div className="fxgrid">
      {PAD_FX.map((f) => (
        <button
          key={f.id}
          type="button"
          className={active === f.id ? 'on' : ''}
          onPointerDown={(e) => {
            const amt = e.pressure > 0 && e.pressure < 1 ? e.pressure : 0.75;
            pressPadFX(f.id, amt);
          }}
          onPointerMove={(e) => {
            if (active === f.id && e.pressure > 0) pressPadFX(f.id, e.pressure);
          }}
          onPointerUp={() => releasePadFX(f.id)}
          onPointerLeave={() => active === f.id && releasePadFX(f.id)}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}

function SongScreen() {
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const addSongStep = useStore((s) => s.addSongStep);
  const removeSongStep = useStore((s) => s.removeSongStep);
  const exportSong = useStore((s) => s.exportSong);
  const playSong = useStore((s) => s.playSong);
  const seqSlot = useStore((s) => s.seqSlot);

  return (
    <div className="lcdpanel">
      <div className="lcdlist songlist">
        {project.song.length === 0 && <div>— empty — INSERT current seq</div>}
        {project.song.map((step, i) => (
          <div key={i} onClick={() => removeSongStep(i)}>
            {String(i + 1).padStart(2, '0')}  {project.sequences[step.bank][step.slot].name}
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => addSongStep(bank, seqSlot)}>INSERT</button>
        <button type="button" onClick={() => playSong()} disabled={!project.song.length}>PLAY</button>
        <button type="button" onClick={() => void exportSong()}>EXPORT</button>
      </div>
      <div className="hintline">PLAY chains sequences. Tap a step to remove.</div>
    </div>
  );
}

function RecordScreen() {
  const recordError = useStore((s) => s.recordError);
  const openInput = useStore((s) => s.openInput);
  const startSampleRecord = useStore((s) => s.startSampleRecord);
  const stopSampleRecord = useStore((s) => s.stopSampleRecord);
  const inputReady = useStore((s) => s.inputOpen);
  const [rec, setRec] = useState(false);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inputReady) return;
    let raf = 0;
    const loop = () => {
      setLevel(engine.inputLevel);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inputReady]);

  return (
    <div className="lcdpanel">
      {recordError && (
        <div className="pending" style={{ color: '#CE3A2E' }}>{recordError}</div>
      )}
      {!inputReady ? (
        <>
          <div className="pending">Allow microphone access to record samples.</div>
          <div className="lcdbtns">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void openInput().finally(() => setBusy(false));
              }}
            >
              {busy ? '…' : 'ENABLE INPUT'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="big" style={{ color: rec ? '#CE3A2E' : undefined }}>
            {rec ? '● REC' : 'READY'}
          </div>
          <div className="lcdrow">
            <span>Input</span>
            <div className="recmeter">
              <i style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>
          <div className="lcdbtns">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (rec) {
                  setBusy(true);
                  void stopSampleRecord()
                    .then((ok) => { if (ok) setRec(false); })
                    .finally(() => setBusy(false));
                } else {
                  setBusy(true);
                  void startSampleRecord()
                    .then((ok) => { if (ok) setRec(true); })
                    .finally(() => setBusy(false));
                }
              }}
            >
              {rec ? 'STOP' : 'RECORD'}
            </button>
            <button type="button" onClick={() => engine.markRecordChop()} disabled={!rec}>
              CHOP POINT
            </button>
          </div>
          <div className="hintline">
            Speak or play into the mic — the meter should move. Tap STOP to load the sample on a pad.
          </div>
        </>
      )}
    </div>
  );
}

function MidiScreen() {
  const midiConnected = useStore((s) => s.midiConnected);
  const connectMidi = useStore((s) => s.connectMidi);
  const midiConfig = useStore((s) => s.midiConfig);
  const setMidiConfig = useStore((s) => s.setMidiConfig);
  const inputs = useStore((s) => s.midiInputs);
  const outputs = useStore((s) => s.midiOutputs);

  const toggle = (key: keyof typeof midiConfig) => {
    const v = midiConfig[key];
    if (typeof v === 'boolean') setMidiConfig({ ...midiConfig, [key]: !v });
  };

  return (
    <div className="lcdpanel">
      <div className="lcdlist">
        <div className={midiConnected ? 'sel' : ''}>
          MIDI  {midiConnected ? 'CONNECTED' : 'not connected'}
        </div>
        <div>Inputs: {inputs.length ? inputs.join(', ') : '—'}</div>
        <div>Outputs: {outputs.length ? outputs.join(', ') : '—'}</div>
      </div>
      <div className="lcdrow">
        <span>In Ch</span>
        <select
          value={String(midiConfig.inChannel)}
          onChange={(e) => {
            const v = e.target.value;
            setMidiConfig({
              ...midiConfig,
              inChannel: v === 'all' ? 'all' : Number(v),
            });
          }}
        >
          <option value="all">ALL</option>
          {Array.from({ length: 16 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
      </div>
      <div className="lcdrow">
        <span>Out Ch</span>
        <select
          value={midiConfig.outChannel}
          onChange={(e) => setMidiConfig({ ...midiConfig, outChannel: Number(e.target.value) })}
        >
          {Array.from({ length: 16 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
      </div>
      {([
        ['padMidiIn', 'Pad MIDI In'],
        ['padMidiOut', 'Pad MIDI Out'],
        ['syncOut', 'MIDI Clock Out'],
        ['syncIn', 'MIDI Clock In'],
        ['thru', 'MIDI Thru'],
      ] as const).map(([key, label]) => (
        <div className="lcdrow" key={key}>
          <span>{label}</span>
          <button type="button" className={`lcd-mini ${midiConfig[key] ? 'on' : ''}`} onClick={() => toggle(key)}>
            {midiConfig[key] ? 'ON' : 'OFF'}
          </button>
        </div>
      ))}
      <div className="lcdbtns">
        <button type="button" onClick={() => void connectMidi()}>CONNECT</button>
      </div>
      <div className="hintline">Pads map from C1 (note 36). Settings persist on this device.</div>
    </div>
  );
}

function CompressorScreen() {
  const compressor = useStore((s) => s.compressor);
  const setCompressorSettings = useStore((s) => s.setCompressorSettings);
  const { attack: a, release: r, amount: amt } = compressor;

  return (
    <div className="lcdpanel">
      <div className="lcdrow">
        <span>Attack</span>
        <input type="range" min={0} max={1000} value={a * 1000}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000;
            setCompressorSettings(v, r, amt);
          }} />
        <b>{(0.1 + a * 150).toFixed(1)}ms</b>
      </div>
      <div className="lcdrow">
        <span>Release</span>
        <input type="range" min={0} max={1000} value={r * 1000}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000;
            setCompressorSettings(a, v, amt);
          }} />
        <b>{Math.round(3 + r * 297)}ms</b>
      </div>
      <div className="lcdrow">
        <span>Amount</span>
        <input type="range" min={0} max={1000} value={amt * 1000}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000;
            setCompressorSettings(a, r, v);
          }} />
        <b>{Math.round(amt * 100)}%</b>
      </div>
      <div className="hintline">Makeup gain is derived automatically.</div>
    </div>
  );
}

function ProjectScreen() {
  const project = useStore((s) => s.project);
  const exportSequence = useStore((s) => s.exportSequence);
  const setScreen = useStore((s) => s.setScreen);
  return (
    <div className="lcdpanel">
      <div className="lcdlist">
        <div className="sel">{project.name}</div>
        <div>{project.banks.flat().filter((p) => p.sampleId).length} samples loaded</div>
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => saveProject(project)}>SAVE</button>
        <button type="button" onClick={() => setScreen('loadproj')}>LOAD</button>
        <button type="button" onClick={() => void exportSequence()}>EXPORT SEQ</button>
      </div>
    </div>
  );
}

function LoadProjectScreen() {
  const loadSavedProject = useStore((s) => s.loadSavedProject);
  const setScreen = useStore((s) => s.setScreen);
  const [projects] = useState(() => listProjects());

  return (
    <div className="lcdpanel">
      <div className="lcdlist browserlist">
        {projects.length === 0 && <div>— no saved projects —</div>}
        {projects.map((p) => (
          <div key={p.id} onClick={() => void loadSavedProject(p.id).then(() => setScreen('sample'))}>
            <b>{p.name}</b>
            <small>{new Date(p.saved).toLocaleString()}</small>
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('project')}>BACK</button>
      </div>
    </div>
  );
}

function BrowserScreen() {
  const entries = useStore((s) => s.browserEntries);
  const loadBrowserSample = useStore((s) => s.loadBrowserSample);
  const deleteBrowserSample = useStore((s) => s.deleteBrowserSample);
  const setScreen = useStore((s) => s.setScreen);
  const [sel, setSel] = useState(0);

  return (
    <div className="lcdpanel">
      <div className="hintline" style={{ marginTop: 0 }}>
        Your uploads — stored on this device (OPFS).
      </div>
      <div className="lcdlist browserlist">
        {entries.length === 0 && <div>— no uploads yet — tap UPLOAD on Sample screen</div>}
        {entries.map((e) => (
          <div
            key={e.id}
            className={entries[sel]?.id === e.id ? 'sel' : ''}
            onClick={() => {
              setSel(entries.indexOf(e));
              void loadBrowserSample(e.id);
            }}
          >
            {e.name}
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
        <button
          type="button"
          onClick={() => entries[sel] && void loadBrowserSample(entries[sel].id)}
          disabled={!entries[sel]}
        >
          LOAD
        </button>
        <button
          type="button"
          onClick={() => entries[sel] && void deleteBrowserSample(entries[sel].id)}
          disabled={!entries[sel]}
        >
          DELETE
        </button>
      </div>
      <div className="hintline">Tap to load to the current pad.</div>
    </div>
  );
}

function KitsScreen() {
  const loadFactoryKit = useStore((s) => s.loadFactoryKit);
  const setScreen = useStore((s) => s.setScreen);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'drums' | 'bass' | 'other'>('all');

  const kits = FACTORY_KIT_LIST.filter((k) => {
    if (filter === 'all') return true;
    if (filter === 'drums') return k.category === 'drums';
    if (filter === 'bass') return k.category === 'bass';
    return k.category === 'perc' || k.category === 'synth' || k.category === 'fx';
  });

  return (
    <div className="lcdpanel">
      <div className="kitfilters">
        {(['all', 'drums', 'bass', 'other'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'on' : ''}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'ALL' : f === 'other' ? 'FX/SYN' : f.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="lcdlist browserlist">
        {kits.map((kit) => (
          <div
            key={kit.id}
            className={busy === kit.id ? 'sel' : ''}
            onClick={() => {
              if (busy) return;
              setBusy(kit.id);
              void loadFactoryKit(kit.id).finally(() => setBusy(null));
            }}
          >
            <b>{kit.name}</b>
            <small>{kit.description}</small>
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
      </div>
      <div className="hintline">
        {busy ? 'Loading kit…' : 'Loads all 16 pads on the current bank.'}
      </div>
    </div>
  );
}

function StepEditScreen() {
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const seqSlot = useStore((s) => s.seqSlot);
  const updateProject = useStore((s) => s.updateProject);
  const stepEditTick = useStore((s) => s.stepEditTick);
  const stepEditEvent = useStore((s) => s.stepEditEvent);
  const setStepEditTick = useStore((s) => s.setStepEditTick);
  const setStepEditEvent = useStore((s) => s.setStepEditEvent);
  const eraseStepEvent = useStore((s) => s.eraseStepEvent);
  const seq = project.sequences[bank][seqSlot];
  const atTick = stepEditTick * project.quantize;
  const atEvents = seq.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => Math.abs(e.tick - atTick) < project.quantize / 2);
  const current = atEvents[stepEditEvent]?.e;

  const barSteps = Math.min(16, Math.max(4, seq.bars * 4));

  return (
    <div className="lcdpanel">
      <div className="stepgrid">
        {Array.from({ length: barSteps }, (_, i) => (
          <button
            key={i}
            type="button"
            className={i === stepEditTick ? 'on' : ''}
            onClick={() => setStepEditTick(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="lcdlist">
        {atEvents.length === 0 && <div>— no events on this step —</div>}
        {atEvents.map(({ e, i }) => (
          <div
            key={i}
            className={i === stepEditEvent ? 'sel' : ''}
            onClick={() => setStepEditEvent(i)}
          >
            Pad {e.pad + 1}  vel {e.velocity}
          </div>
        ))}
      </div>
      <div className="lcdrow">
        <span>Length</span>
        <input
          type="range" min={1} max={16} step={1} value={seq.bars}
          onChange={(e) => {
            const bars = Number(e.target.value);
            const banks = project.sequences.map((row, bi) =>
              bi === bank
                ? row.map((s, si) => (si === seqSlot ? { ...s, bars } : s))
                : row
            );
            updateProject({ sequences: banks });
          }}
        />
        <b>{seq.bars}b</b>
      </div>
      <div className="lcdrow">
        <span>Q</span>
        <input
          type="range" min={0} max={5} step={1}
          value={[TICKS_PER_16TH, TICKS_PER_16TH / 2, TICKS_PER_16TH / 4, TICKS_PER_16TH / 8, TICKS_PER_16TH / 16, TICKS_PER_16TH / 32].indexOf(project.quantize)}
          onChange={(e) => {
            const divs = [TICKS_PER_16TH, TICKS_PER_16TH / 2, TICKS_PER_16TH / 4, TICKS_PER_16TH / 8, TICKS_PER_16TH / 16, TICKS_PER_16TH / 32];
            updateProject({ quantize: divs[Number(e.target.value)] ?? TICKS_PER_16TH });
          }}
        />
        <b>1/{16 / (project.quantize / (TICKS_PER_16TH / 16))}</b>
      </div>
      {current && (
        <div className="lcdrow">
          <span>Vel</span>
          <input
            type="range" min={1} max={127} value={current.velocity}
            onChange={(e) => {
              const vel = Number(e.target.value);
              const events = seq.events.map((ev) =>
                ev === current ? { ...ev, velocity: vel } : ev
              );
              const banks = project.sequences.map((row, bi) =>
                bi === bank
                  ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s))
                  : row
              );
              updateProject({ sequences: banks });
            }}
          />
          <b>{current.velocity}</b>
        </div>
      )}
      <div className="lcdbtns">
        <button type="button" onClick={eraseStepEvent} disabled={!current}>ERASE</button>
      </div>
      <div className="hintline">Pad = select event. Shift+ERASE mode + pad = erase. Fader nudges timing.</div>
    </div>
  );
}

function FaderMenuScreen() {
  const faderParam = useStore((s) => s.faderParam);
  const setFaderParam = useStore((s) => s.setFaderParam);
  const setScreen = useStore((s) => s.setScreen);
  const params = [
    'Pad Volume', 'Pad Pan', 'Pad Tune', 'Pad Filter Cutoff', 'Kit Volume',
  ];

  return (
    <div className="lcdpanel">
      <div className="lcdlist">
        {params.map((p) => (
          <div
            key={p}
            className={p === faderParam ? 'sel' : ''}
            onClick={() => { setFaderParam(p); setScreen('sample'); }}
          >
            {p}
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
      </div>
      <div className="hintline">Tap to assign the fader.</div>
    </div>
  );
}

function TimeCorrectScreen() {
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const seqSlot = useStore((s) => s.seqSlot);
  const updateProject = useStore((s) => s.updateProject);
  const setScreen = useStore((s) => s.setScreen);
  const seq = project.sequences[bank][seqSlot];

  const quantizeAll = () => {
    const events = seq.events.map((e) => ({
      ...e,
      tick: Math.round(e.tick / project.quantize) * project.quantize,
    }));
    const banks = project.sequences.map((row, bi) =>
      bi === bank
        ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s))
        : row
    );
    updateProject({ sequences: banks });
  };

  return (
    <div className="lcdpanel">
      <div className="big">TIME CORRECT</div>
      <div className="lcdrow">
        <span>Grid</span>
        <input
          type="range" min={0} max={5} step={1}
          value={[TICKS_PER_16TH, TICKS_PER_16TH / 2, TICKS_PER_16TH / 4, TICKS_PER_16TH / 8, TICKS_PER_16TH / 16, TICKS_PER_16TH / 32].indexOf(project.quantize)}
          onChange={(e) => {
            const divs = [TICKS_PER_16TH, TICKS_PER_16TH / 2, TICKS_PER_16TH / 4, TICKS_PER_16TH / 8, TICKS_PER_16TH / 16, TICKS_PER_16TH / 32];
            updateProject({ quantize: divs[Number(e.target.value)] ?? TICKS_PER_16TH });
          }}
        />
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={quantizeAll}>QUANTIZE SEQ</button>
        <button type="button" onClick={() => setScreen('seq')}>BACK</button>
      </div>
      <div className="hintline">Snaps all events to the current Q grid.</div>
    </div>
  );
}

function InputConfigScreen() {
  const inputOpen = useStore((s) => s.inputOpen);
  const openInput = useStore((s) => s.openInput);
  const setScreen = useStore((s) => s.setScreen);
  const [monitor, setMonitor] = useState(false);

  return (
    <div className="lcdpanel">
      <div className="lcdlist">
        <div className={inputOpen ? 'sel' : ''}>Input {inputOpen ? 'enabled' : 'off'}</div>
        <div>Source: Microphone</div>
      </div>
      <div className="lcdrow">
        <span>Monitor</span>
        <input
          type="range" min={0} max={1} step={1}
          value={monitor ? 1 : 0}
          onChange={(e) => {
            const on = Number(e.target.value) === 1;
            setMonitor(on);
            engine.setInputMonitor(on);
          }}
        />
        <b>{monitor ? 'ON' : 'OFF'}</b>
      </div>
      <div className="lcdbtns">
        {!inputOpen && (
          <button type="button" onClick={() => void openInput()}>ENABLE</button>
        )}
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
      </div>
    </div>
  );
}

function FlexBeatScreen() {
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const selectedPad = useStore((s) => s.selectedPad);
  const updatePad = useStore((s) => s.updatePad);
  const setScreen = useStore((s) => s.setScreen);
  const pressPadFX = useStore((s) => s.pressPadFX);
  const releasePadFX = useStore((s) => s.releasePadFX);
  const active = useStore((s) => s.activePadFX);
  const pad = project.banks[bank][selectedPad];

  const FLEX_FX: { id: import('../audio/fx/padfx').PadFXId; name: string }[] = [
    { id: 'beatRepeat', name: 'Beat Rpt' },
    { id: 'halfSpeed', name: 'Half Spd' },
    { id: 'granular', name: 'Granular' },
    { id: 'revStepper', name: 'Rev Step' },
    { id: 'delay', name: 'Delay' },
    { id: 'reverb', name: 'Reverb' },
    { id: 'lofi', name: 'Lo-Fi' },
    { id: 'ringMod', name: 'Ring Mod' },
    { id: 'chorus', name: 'Chorus' },
    { id: 'flanger', name: 'Flanger' },
    { id: 'phaser', name: 'Phaser' },
    { id: 'lpFilter', name: 'LP Filt' },
    { id: 'hpFilter', name: 'HP Filt' },
    { id: 'comb', name: 'Comb' },
    { id: 'color', name: 'Color' },
  ];

  return (
    <div className="lcdpanel flexbeat-panel">
      <div className="lcdrow">
        <span>Warp</span>
        <select
          value={String(pad.warpAmount)}
          onChange={(e) => {
            const v = e.target.value;
            updatePad(selectedPad, {
              warpAmount: v === 'off' || v === 'seq' ? v : Number(v),
            });
          }}
        >
          <option value="off">Off</option>
          <option value="50">50%</option>
          <option value="100">100%</option>
          <option value="200">200%</option>
          <option value="seq">Seq</option>
        </select>
      </div>
      <div className="lcdrow">
        <span>Mode</span>
        <button
          type="button"
          className="lcd-mini"
          onClick={() => updatePad(selectedPad, {
            warpMode: pad.warpMode === 'pitch' ? 'stretch' : 'pitch',
          })}
        >
          {pad.warpMode === 'pitch' ? 'PITCH' : 'STRETCH'}
        </button>
        <span>Beats {pad.beats}</span>
      </div>
      <div className="hintline">Master beat FX — hold to engage (synced to {project.bpm} BPM)</div>
      <div className="fxgrid flexbeat-grid">
        {FLEX_FX.map((f) => (
          <button
            key={f.id}
            type="button"
            className={active === f.id ? 'on' : ''}
            onPointerDown={() => pressPadFX(f.id, 0.8)}
            onPointerUp={() => releasePadFX(f.id)}
            onPointerLeave={() => active === f.id && releasePadFX(f.id)}
          >
            {f.name}
          </button>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('padfx')}>BACK</button>
      </div>
    </div>
  );
}
