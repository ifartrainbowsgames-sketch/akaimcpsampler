import { useEffect, useRef, useState } from 'react';
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
import { FACTORY_KITS, FACTORY_KIT_COUNT, FACTORY_DEMOS, FACTORY_DEMO_COUNT, demoDurationSec, isLongDemo } from '../audio/factory/kits';
import { LibraryScreen } from './LibraryScreen';
import { HwSlider } from '../ui/HwSlider';
import { VolumeMeter, PanMeter } from '../ui/WaveMeters';
import { resolveScreenParams } from './screenParams';
import { FLEX_BEAT_EFFECTS } from '../audio/fx/flexbeat';
import { guideClick } from '../guide/guideClick';

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
  const chopSongToPads = useStore((s) => s.chopSongToPads);
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
    let lastSample = -999;
    let lastSeq = -999;
    let lastFrame = 0;
    const loop = (t: number) => {
      if (t - lastFrame >= 32) {
        lastFrame = t;
        const frame = engine.telemetry.samplePlayhead[selectedPad];
        if (frame >= 0 && sampleLen > 0) {
          const ph = frame / sampleLen;
          if (Math.abs(ph - lastSample) > 0.003) {
            lastSample = ph;
            lastSeq = -999;
            setSamplePh(ph);
            setPlayhead(-1);
          }
        } else if (engine.telemetry.playing && screen !== 'sample') {
          const seq = engine.activeSequence();
          if (seq) {
            const total = seq.bars * 4 * 960;
            const p = engine.telemetry.positionTicks / total;
            if (Math.abs(p - lastSeq) > 0.003) {
              lastSeq = p;
              lastSample = -999;
              setPlayhead(p);
              setSamplePh(-1);
            }
          }
        } else if (lastSample !== -999 || lastSeq !== -999) {
          lastSample = -999;
          lastSeq = -999;
          setPlayhead(-1);
          setSamplePh(-1);
        }
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
    const sampleSec = buffer ? buffer.length / buffer.sampleRate : 0;
    const canChopSong = sampleSec >= 2;

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
          <label htmlFor={SAMPLE_FILE_INPUT_ID} className="lcd-btn lcd-btn--upload" onClick={(e) => {
            if (useStore.getState().guideMode) { e.preventDefault(); guideClick('lcd.upload'); }
          }}>UPLOAD</label>
          <button type="button" className="lcd-btn" onClick={() => guideClick('lcd.browse', () => setScreen('browser'))}>BROWSE</button>
          <button type="button" className="lcd-btn lcd-btn--action" onClick={() => guideClick('lcd.beats', () => setScreen('beats'))}>BEATS</button>
          <button type="button" className="lcd-btn" onClick={() => guideClick('lcd.kits', () => setScreen('kits'))}>KITS</button>
          <button type="button" className="lcd-btn" onClick={() => guideClick('lcd.loops', () => setScreen('library'))}>LOOPS</button>
        </div>

        {(chopActive || canChopSong) && (
          <div className="lcdchop">
            {canChopSong && (
              <button type="button" className="lcd-btn lcd-btn--action" onClick={() => guideClick('lcd.chopsong', () => chopSongToPads())}>
                CHOP SONG
              </button>
            )}
            {chopActive && pad.sampleId && (
              <button type="button" className="lcd-btn lcd-btn--ghost" onClick={() => guideClick('lcd.chop', () => runChop())}>CHOP</button>
            )}
            {chopActive && (
              <>
                <button type="button" className="lcd-btn lcd-btn--ghost" onClick={() => guideClick('lcd.split', () => splitSelectedSlice())}>SPLIT</button>
                <button type="button" className="lcd-btn lcd-btn--ghost" onClick={() => guideClick('lcd.split', () => mergeSelectedSlice())}>MERGE</button>
                <button type="button" className="lcd-btn lcd-btn--ghost" onClick={() => guideClick('lcd.split', () => extractSelectedSlice())}>EXTRACT</button>
                {pad.slices.length > 0 && (
                  <button type="button" className="lcd-btn lcd-btn--action" onClick={() => guideClick('lcd.topads', () => sliceAllToPads())}>TO PADS</button>
                )}
              </>
            )}
          </div>
        )}
        {buffer && (pad.start > 0 || padEnd < sampleLen) && (
          <div className="lcdchop">
            <button type="button" className="lcd-btn lcd-btn--action" onClick={trimSelected}>APPLY TRIM</button>
          </div>
        )}

        <div className="waveblock">
          <VolumeMeter gain={pad.gain} />
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
          <PanMeter pan={pad.pan} />
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
      <KRow
        params={resolveScreenParams({
          screen,
          bGroup,
          bPage,
          project,
          bank,
          selectedPad,
          pad,
          chopActive,
          selectedSlice,
          updatePad,
        })}
        onChange={(p, v) => p.set(v, updatePad, selectedPad)}
      />
    </div>
  );
}

const SCREEN_TITLES: Record<string, string> = {
  seq: 'SEQUENCE', stepedit: 'STEP EDIT', song: 'SONG',
  browser: 'BROWSER', beats: 'BEAT LIBRARY', kits: 'KITS', library: 'LOOP LIBRARY', smprec: 'SAMPLE REC',
  padfx: 'PAD FX', flexbeat: 'FLEX BEAT', knobfx: 'KNOB FX', 'knobfx-select': 'KNOB FX SELECT',
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
            Stopped: tap a pad to select seq 1–16. Playing: tap to queue — switches at loop end.
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

    case 'knobfx-select':
      return <KnobFXSelectScreen />;

    case 'padfx':
      return <PadFXScreen />;

    case 'flexbeat':
      return <FlexBeatScreen />;

    case 'browser':
      return <BrowserScreen />;

    case 'beats':
      return <BeatsScreen />;

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
  const togglePadFXLatch = useStore((s) => s.togglePadFXLatch);
  const active = useStore((s) => s.activePadFX);

  return (
    <div className="lcdpanel">
      <div className="lcdbtns">
        <button
          type="button"
          className="lcd-mini"
          onClick={() => active && togglePadFXLatch(active)}
          disabled={!active}
        >
          LATCH
        </button>
      </div>
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
      <div className="hintline">Pressure = amount. LATCH holds the active effect.</div>
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
  const levelRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inputReady) return;
    let raf = 0;
    let lastFrame = 0;
    const loop = (t: number) => {
      if (t - lastFrame >= 32) {
        lastFrame = t;
        const lv = engine.inputLevel;
        const el = levelRef.current;
        if (el) el.style.width = `${Math.round(lv * 100)}%`;
      }
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
              <i ref={levelRef} />
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
  const toggleCompressorColor = useStore((s) => s.toggleCompressorColor);
  const toggleCompressorBypass = useStore((s) => s.toggleCompressorBypass);
  const { attack: a, release: r, amount: amt, color, bypass, inBoost } = compressor;

  return (
    <div className="lcdpanel">
      <div className="lcdrow">
        <span>Color</span>
        <button type="button" className={`lcd-mini ${color ? 'on' : ''}`} onClick={() => toggleCompressorColor()}>
          {color ? 'ON' : 'OFF'}
        </button>
        <span>Bypass</span>
        <button type="button" className={`lcd-mini ${bypass ? 'on' : ''}`} onClick={() => toggleCompressorBypass()}>
          {bypass ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="lcdrow">
        <span>Attack</span>
        <input type="range" min={0} max={1000} value={a * 1000}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000;
            setCompressorSettings(v, r, amt, color, bypass, inBoost);
          }} />
        <b>{(0.1 + a * 150).toFixed(1)}ms</b>
      </div>
      <div className="lcdrow">
        <span>Release</span>
        <input type="range" min={0} max={1000} value={r * 1000}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000;
            setCompressorSettings(a, v, amt, color, bypass, inBoost);
          }} />
        <b>{Math.round(3 + r * 297)}ms</b>
      </div>
      <div className="lcdrow">
        <span>Amount</span>
        <input type="range" min={0} max={1000} value={amt * 1000}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000;
            setCompressorSettings(a, r, v, color, bypass, inBoost);
          }} />
        <b>{Math.round(amt * 100)}%</b>
      </div>
      <div className="hintline">Shift+K3 = In Boost on physical knobs. Makeup gain is automatic.</div>
    </div>
  );
}

function ProjectScreen() {
  const project = useStore((s) => s.project);
  const exportSequence = useStore((s) => s.exportSequence);
  const newProject = useStore((s) => s.newProject);
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
        <button type="button" onClick={() => newProject()}>NEW</button>
      </div>
    </div>
  );
}

function LoadProjectScreen() {
  const loadSavedProject = useStore((s) => s.loadSavedProject);
  const loadFactoryDemo = useStore((s) => s.loadFactoryDemo);
  const loadFactoryKitOnly = useStore((s) => s.loadFactoryKitOnly);
  const category = useStore((s) => s.loadProjectCategory);
  const setLoadProjectCategory = useStore((s) => s.setLoadProjectCategory);
  const setScreen = useStore((s) => s.setScreen);
  const [projects] = useState(() => listProjects());
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="lcdpanel">
      <div className="lcdbtns lcdbtns--tabs">
        {(['demos', 'kits', 'user'] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={category === c ? 'on' : ''}
            onClick={() => setLoadProjectCategory(c)}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="lcdlist browserlist kitlist">
        {category === 'demos' && (
          <div className="hintline" style={{ marginBottom: '0.3em' }}>
            Same list as Sample → BEATS. Tap LONG tab there for 16–32 bar songs.
          </div>
        )}
        {category === 'demos' && FACTORY_DEMOS.map((d) => (
          <div
            key={d.id}
            className={busy === d.id ? 'sel' : ''}
            onClick={() => {
              if (busy) return;
              setBusy(d.id);
              void loadFactoryDemo(d.id).finally(() => setBusy(null));
            }}
          >
            <b>{d.name}</b>
            <small>{d.description} — {demoDurationSec(d).toFixed(0)}s loop · {d.bars} bars @ {d.bpm} BPM</small>
          </div>
        ))}
        {category === 'kits' && FACTORY_KITS.map((k) => (
          <div key={k.id}>
            <div onClick={() => void loadFactoryKitOnly(k.id)}>
              <b>{k.name}</b>
              <small>{k.description} — samples only</small>
            </div>
          </div>
        ))}
        {category === 'user' && projects.length === 0 && <div>— no saved projects —</div>}
        {category === 'user' && projects.map((p) => (
          <div key={p.id} onClick={() => void loadSavedProject(p.id).then(() => setScreen('sample'))}>
            <b>{p.name}</b>
            <small>{new Date(p.saved).toLocaleString()}</small>
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('project')}>BACK</button>
      </div>
      <div className="hintline">
        {category === 'demos'
          ? `${FACTORY_DEMO_COUNT} beats — load → PLAY → jam on pads`
          : category === 'kits'
            ? 'Samples only — use DEMOS for full loops'
            : 'Saved projects'}
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

function BeatsScreen() {
  const loadFactoryDemo = useStore((s) => s.loadFactoryDemo);
  const setScreen = useStore((s) => s.setScreen);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'beats' | 'long' | 'melodic' | 'all'>('beats');
  const [query, setQuery] = useState('');

  const demos = FACTORY_DEMOS.filter((d) => {
    let ok = false;
    if (filter === 'all') ok = true;
    else if (filter === 'long') ok = isLongDemo(d);
    else if (filter === 'beats') ok = (d.category === 'beats' || d.category === 'full') && !isLongDemo(d);
    else if (filter === 'melodic') ok = (d.category === 'melodic' || d.category === 'full') && !isLongDemo(d);
    if (!ok) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
  });

  return (
    <div className="lcdpanel">
      <div className="libraryhdr">
        <span className="libbadge">Factory songs</span>
        <span className="libstatus">{FACTORY_DEMO_COUNT} ready-to-play loops</span>
      </div>
      <div className="lcdrow">
        <span>{demos.length} songs</span>
        <input
          type="search"
          className="kitsearch"
          placeholder="Search beats…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="kitfilters">
        {(['beats', 'long', 'melodic', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'on' : ''}
            onClick={() => setFilter(f)}
          >
            {f === 'beats' ? 'SHORT' : f.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="lcdlist browserlist kitlist">
        {demos.length === 0 && <div>— no songs match —</div>}
        {demos.map((demo) => (
          <div
            key={demo.id}
            className={busy === demo.id ? 'sel' : ''}
            onClick={() => {
              if (busy) return;
              setBusy(demo.id);
              void loadFactoryDemo(demo.id).finally(() => setBusy(null));
            }}
          >
            <b>{demo.name}</b>
            <small>
              {demo.description} — {demo.bars} bars · {demoDurationSec(demo).toFixed(0)}s
              {isLongDemo(demo) ? ' · LONG' : ''}
            </small>
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
      </div>
      <div className="hintline">
        {busy
          ? 'Loading…'
          : filter === 'long'
            ? 'LONG = 16–32 bar songs. Tap one — it loads, plays, then jam on pads.'
            : 'Tap a song — full sequence + kits load and play automatically.'}
      </div>
    </div>
  );
}

function KitsScreen() {
  const loadFactoryKit = useStore((s) => s.loadFactoryKit);
  const setScreen = useStore((s) => s.setScreen);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'drums' | 'bass' | 'perc' | 'melodic' | 'fx'>('all');
  const [query, setQuery] = useState('');

  const kits = FACTORY_KITS.filter((k) => {
    if (filter !== 'all' && k.category !== filter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return k.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q);
  });

  return (
    <div className="lcdpanel">
      <div className="lcdrow">
        <span>{kits.length} / {FACTORY_KIT_COUNT} kits</span>
        <input
          type="search"
          className="kitsearch"
          placeholder="Search kits…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="kitfilters">
        {(['all', 'drums', 'bass', 'perc', 'melodic', 'fx'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'on' : ''}
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="lcdlist browserlist kitlist">
        {kits.length === 0 && <div>— no kits match —</div>}
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
            <small>{kit.description} — one-shots only</small>
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
        <button type="button" onClick={() => setScreen('beats')}>BEATS</button>
      </div>
      <div className="hintline">
        {busy ? 'Loading…' : 'Kits = 16 pad samples. For full songs use BEATS.'}
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
  const stepErasePending = useStore((s) => s.stepErasePending);
  const confirmStepErase = useStore((s) => s.confirmStepErase);
  const cancelStepErase = useStore((s) => s.cancelStepErase);
  const seq = project.sequences[bank][seqSlot];
  const atTick = stepEditTick * project.quantize;
  const atEvents = seq.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => Math.abs(e.tick - atTick) < project.quantize / 2);
  const current = atEvents[stepEditEvent]?.e;

  const barSteps = Math.min(128, Math.max(4, seq.bars * 4));

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
          type="range" min={1} max={32} step={1} value={Math.min(32, seq.bars)}
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
      {stepErasePending !== null && (
        <div className="lcdbtns">
          <span>Erase pad {stepErasePending + 1}?</span>
          <button type="button" onClick={() => cancelStepErase()}>CANCEL</button>
          <button type="button" onClick={() => confirmStepErase()}>DO IT</button>
        </div>
      )}
      <div className="hintline">Jog = step. Shift+± = event. Shift+ERASE + pad = erase confirm.</div>
    </div>
  );
}

function FaderMenuScreen() {
  const faderParam = useStore((s) => s.faderParam);
  const faderEnabled = useStore((s) => s.faderEnabled);
  const setFaderParam = useStore((s) => s.setFaderParam);
  const toggleFaderEnabled = useStore((s) => s.toggleFaderEnabled);
  const setScreen = useStore((s) => s.setScreen);
  const params = [
    'Pad Volume', 'Pad Pan', 'Pad Tune',
    'Pad Amp Attack', 'Pad Amp Decay', 'Pad Filter Cutoff', 'Kit Volume',
  ];

  return (
    <div className="lcdpanel">
      <div className="lcdrow">
        <span>Fader</span>
        <button type="button" className={`lcd-mini ${faderEnabled ? 'on' : ''}`} onClick={() => toggleFaderEnabled()}>
          {faderEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
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
      <div className="hintline">Pan/Tune: fader LED brightest at centre. Soft takeover applies.</div>
    </div>
  );
}

function TimeCorrectScreen() {
  const timeCorrectPads = useStore((s) => s.timeCorrectPads);
  const applyTimeCorrect = useStore((s) => s.applyTimeCorrect);
  const selectAllTimeCorrectPads = useStore((s) => s.selectAllTimeCorrectPads);
  const setScreen = useStore((s) => s.setScreen);
  const selected = timeCorrectPads.filter(Boolean).length;

  return (
    <div className="lcdpanel">
      <div className="big">TIME CORRECT</div>
      <div className="lcdrow"><span>Pads selected</span><b>{selected}/16</b></div>
      <div className="hintline">Tap pads to select. K1=Grid K2=Shift K3=Swing. Shift affects Note Repeat too.</div>
      <div className="lcdbtns">
        <button type="button" onClick={() => selectAllTimeCorrectPads()}>ALL PADS</button>
        <button type="button" onClick={() => applyTimeCorrect()}>DO IT!</button>
        <button type="button" onClick={() => setScreen('seq')}>CANCEL</button>
      </div>
    </div>
  );
}

function InputConfigScreen() {
  const inputOpen = useStore((s) => s.inputOpen);
  const inputConfig = useStore((s) => s.inputConfig);
  const setInputConfig = useStore((s) => s.setInputConfig);
  const openInput = useStore((s) => s.openInput);
  const setScreen = useStore((s) => s.setScreen);

  return (
    <div className="lcdpanel">
      <div className="lcdlist">
        <div className={inputOpen ? 'sel' : ''}>Input {inputOpen ? 'enabled' : 'off'}</div>
        <div>Source: {inputConfig.source === 'mic' ? 'Microphone' : 'Resample'}</div>
        <div>Rec Length: {inputConfig.recLength}</div>
        <div>Rec FX: {inputConfig.recFx ? 'On' : 'Off'}</div>
      </div>
      <div className="lcdrow">
        <span>Source</span>
        <select
          value={inputConfig.source}
          onChange={(e) => setInputConfig({ source: e.target.value as 'mic' | 'resample' })}
        >
          <option value="mic">Mic</option>
          <option value="resample">Resample</option>
        </select>
      </div>
      <div className="lcdrow">
        <span>Monitor</span>
        <button
          type="button"
          className={`lcd-mini ${inputConfig.monitor ? 'on' : ''}`}
          onClick={() => setInputConfig({ monitor: !inputConfig.monitor })}
        >
          {inputConfig.monitor ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="lcdbtns">
        {!inputOpen && (
          <button type="button" onClick={() => void openInput()}>ENABLE</button>
        )}
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
      </div>
      <div className="hintline">K1–K3: Threshold, Rec Length, Rec FX. Threshold gates auto-record.</div>
    </div>
  );
}

function KnobFXSelectScreen() {
  const knobFXRouting = useStore((s) => s.knobFXRouting);
  const knobFXBypass = useStore((s) => s.knobFXBypass);
  const setAllKnobFXPads = useStore((s) => s.setAllKnobFXPads);
  const toggleKnobFXBypass = useStore((s) => s.toggleKnobFXBypass);
  const setScreen = useStore((s) => s.setScreen);

  return (
    <div className="lcdpanel">
      <div className="hintline">Lit pads = Knob FX affected. Tap pads to toggle.</div>
      <div className="fxgrid flexbeat-grid">
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            className={`fxpad-label ${knobFXRouting[i] ? 'on' : 'dim'}`}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setAllKnobFXPads(true)}>ALL PADS</button>
        <button type="button" className={knobFXBypass ? 'on' : ''} onClick={() => toggleKnobFXBypass()}>
          {knobFXBypass ? 'BYPASS ON' : 'BYPASS'}
        </button>
        <button type="button" onClick={() => setScreen('knobfx')}>BACK</button>
      </div>
    </div>
  );
}

function FlexBeatScreen() {
  const project = useStore((s) => s.project);
  const flexBeat = useStore((s) => s.flexBeat);
  const setScreen = useStore((s) => s.setScreen);
  const selectFlexBeatPad = useStore((s) => s.selectFlexBeatPad);
  const setFlexBeat = useStore((s) => s.setFlexBeat);

  return (
    <div className="lcdpanel flexbeat-panel">
      <div className="lcdrow">
        <span>Active</span>
        <b>{flexBeat.activePad === 0 ? 'Empty' : FLEX_BEAT_EFFECTS[flexBeat.activePad]?.name ?? '—'}</b>
      </div>
      <div className="hintline">Pad 1 = Empty. Pads 2–16 = beat FX (synced to {project.bpm} BPM). K1/K3 on knobs.</div>
      <div className="fxgrid flexbeat-grid">
        {FLEX_BEAT_EFFECTS.map((fx, i) => (
          <button
            key={fx.id}
            type="button"
            className={flexBeat.activePad === i ? 'on' : ''}
            onClick={() => selectFlexBeatPad(i)}
          >
            {i === 0 ? 'Empty' : fx.name}
          </button>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setFlexBeat({ activePad: 0 })}>EMPTY</button>
        <button type="button" onClick={() => setScreen('padfx')}>BACK</button>
      </div>
    </div>
  );
}
