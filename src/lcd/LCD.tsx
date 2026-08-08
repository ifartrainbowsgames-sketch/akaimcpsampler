import { useEffect, useState } from 'react';
import { saveProject } from '../storage/projects';
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
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (engine.telemetry.playing) {
        const seq = engine.activeSequence();
        if (seq) {
          const total = seq.bars * 4 * 960;
          setPlayhead(engine.telemetry.positionTicks / total);
        }
      } else {
        setPlayhead(-1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

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
          <span>
            {String.fromCharCode(65 + bank)}
            {String(selectedPad + 1).padStart(2, '0')}
          </span>
          <span className="sname">{pad.sampleName || '(empty)'}</span>
          <label htmlFor={SAMPLE_FILE_INPUT_ID} className="lcd-btn" title="Import audio file">
            {buffer ? 'REPLACE' : 'LOAD'}
          </label>
          {chopActive && pad.slices.length > 0 && (
            <button type="button" className="lcd-btn lcd-btn--action" onClick={sliceAllToPads}>
              TO PADS
            </button>
          )}
          {chopActive && (
            <>
              <button type="button" className="lcd-btn lcd-btn--ghost" onClick={splitSelectedSlice}>SPLIT</button>
              <button type="button" className="lcd-btn lcd-btn--ghost" onClick={mergeSelectedSlice}>MERGE</button>
              <button type="button" className="lcd-btn lcd-btn--ghost" onClick={extractSelectedSlice}>EXTRACT</button>
            </>
          )}
          {chopActive && pad.sampleId && (
            <button type="button" className="lcd-btn lcd-btn--ghost" onClick={runChop}>
              CHOP
            </button>
          )}
          {buffer && (pad.start > 0 || padEnd < sampleLen) && (
            <button type="button" className="lcd-btn lcd-btn--action" onClick={trimSelected}>
              APPLY TRIM
            </button>
          )}
          <span className="chips">
            {pad.noteOn && <i className="chip">♪</i>}
            {pad.loop && <i className="chip">⟳</i>}
            {pad.reverse && <i className="chip">←</i>}
            {chopActive && pad.slices.length > 0 && (
              <i className="chip">{selectedSlice + 1}/{pad.slices.length}</i>
            )}
          </span>
        </div>

        <div className="waveblock">
          <div className="lcdmeters" aria-hidden>
            <MeterBar value={Math.max(0, (pad.gain + 74) / 80)} label="VOL" />
            <MeterBar value={(pad.pan + 1) / 2} label="PAN" />
          </div>
          <div className="lanes lanes--dual">
            <div className="lane lane--overview">
              <Waveform
                buffer={buffer}
                start={pad.start}
                end={padEnd}
                loopStart={pad.loopStart}
                slices={pad.slices}
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
                playhead={playhead}
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
                <span className="lcd-load-cta" aria-hidden>
                  TAP LOAD OR DROP AUDIO
                </span>
              )}
            </div>
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
  browser: 'BROWSER', smprec: 'SAMPLE REC',
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
        return (
          <label key={i} className="footcell">
            <span>{p?.name ?? '—'}</span>
            {p && (
              <input
                className="footslider"
                type="range"
                min={0}
                max={1000}
                value={Math.round(p.norm * 1000)}
                onChange={(e) => onChange(p, Number(e.target.value) / 1000)}
                aria-label={p.name}
              />
            )}
          </label>
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
    case 'seq':
      return (
        <div className="lcdpanel">
          <div className="big">{project.bpm.toFixed(1)} BPM</div>
          <Row label="Swing">
            <input
              type="range" min={50} max={75} step={0.5}
              value={project.swing}
              onChange={(e) => updateProject({ swing: Number(e.target.value) })}
            />
            <b>{project.swing.toFixed(1)}%</b>
          </Row>
          <Row label="Tempo">
            <input
              type="range" min={40} max={200} step={0.5}
              value={project.bpm}
              onChange={(e) => updateProject({ bpm: Number(e.target.value) })}
            />
            <b>{project.bpm.toFixed(1)}</b>
          </Row>
          <div className="hintline">
            50 straight · 54 loose · 62 hip-hop · 66.7 triplet
          </div>
        </div>
      );

    case 'project':
      return <ProjectScreen />;

    case 'knobfx':
      return <KnobFXScreen />;

    case 'padfx':
      return <PadFXScreen />;

    case 'flexbeat':
      return <FlexBeatScreen />;

    case 'browser':
      return <BrowserScreen />;

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
  const seqSlot = useStore((s) => s.seqSlot);

  return (
    <div className="lcdpanel">
      <div className="lcdlist songlist">
        {project.song.length === 0 && <div>— empty —</div>}
        {project.song.map((step, i) => (
          <div key={i} onClick={() => removeSongStep(i)}>
            {String(i + 1).padStart(2, '0')}  {project.sequences[step.bank][step.slot].name}
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => addSongStep(bank, seqSlot)}>INSERT</button>
        <button type="button" onClick={() => void exportSong()}>EXPORT</button>
      </div>
      <div className="hintline">Tap a step to remove it.</div>
    </div>
  );
}

function RecordScreen() {
  const inputOpen = useStore((s) => s.inputOpen);
  const openInput = useStore((s) => s.openInput);
  const startSampleRecord = useStore((s) => s.startSampleRecord);
  const stopSampleRecord = useStore((s) => s.stopSampleRecord);
  const [rec, setRec] = useState(false);

  return (
    <div className="lcdpanel">
      {!inputOpen ? (
        <>
          <div className="pending">Microphone not enabled.</div>
          <div className="lcdbtns">
            <button type="button" onClick={() => void openInput()}>ENABLE INPUT</button>
          </div>
        </>
      ) : (
        <>
          <div className="big" style={{ color: rec ? '#CE3A2E' : undefined }}>
            {rec ? '● REC' : 'READY'}
          </div>
          <div className="lcdbtns">
            <button
              type="button"
              onClick={() => {
                if (rec) { void stopSampleRecord(); setRec(false); }
                else { startSampleRecord(); setRec(true); }
              }}
            >
              {rec ? 'STOP' : 'RECORD'}
            </button>
            <button type="button" onClick={() => engine.markRecordChop()} disabled={!rec}>
              CHOP POINT
            </button>
          </div>
          <div className="hintline">
            Tap CHOP POINT while recording to slice as you go.
          </div>
        </>
      )}
    </div>
  );
}

function MidiScreen() {
  const midiConnected = useStore((s) => s.midiConnected);
  const connectMidi = useStore((s) => s.connectMidi);
  return (
    <div className="lcdpanel">
      <div className="lcdlist">
        <div className={midiConnected ? 'sel' : ''}>
          MIDI  {midiConnected ? 'CONNECTED' : 'not connected'}
        </div>
        <div>Pads map from C1 (note 36)</div>
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => void connectMidi()}>CONNECT</button>
      </div>
    </div>
  );
}

function CompressorScreen() {
  const [a, setA] = useState(0.1);
  const [r, setR] = useState(0.35);
  const [amt, setAmt] = useState(0.3);
  const apply = (na: number, nr: number, nAmt: number) =>
    engine.setCompressor(0.1 + na * 150, 3 + nr * 297, nAmt * 100);

  return (
    <div className="lcdpanel">
      <div className="lcdrow">
        <span>Attack</span>
        <input type="range" min={0} max={1000} value={a * 1000}
          onChange={(e) => { const v = Number(e.target.value) / 1000; setA(v); apply(v, r, amt); }} />
        <b>{(0.1 + a * 150).toFixed(1)}ms</b>
      </div>
      <div className="lcdrow">
        <span>Release</span>
        <input type="range" min={0} max={1000} value={r * 1000}
          onChange={(e) => { const v = Number(e.target.value) / 1000; setR(v); apply(a, v, amt); }} />
        <b>{Math.round(3 + r * 297)}ms</b>
      </div>
      <div className="lcdrow">
        <span>Amount</span>
        <input type="range" min={0} max={1000} value={amt * 1000}
          onChange={(e) => { const v = Number(e.target.value) / 1000; setAmt(v); apply(a, r, v); }} />
        <b>{Math.round(amt * 100)}%</b>
      </div>
      <div className="hintline">Makeup gain is derived automatically.</div>
    </div>
  );
}

function ProjectScreen() {
  const project = useStore((s) => s.project);
  const exportSequence = useStore((s) => s.exportSequence);
  return (
    <div className="lcdpanel">
      <div className="lcdlist">
        <div className="sel">{project.name}</div>
        <div>{project.banks.flat().filter((p) => p.sampleId).length} samples loaded</div>
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => saveProject(project)}>SAVE</button>
        <button type="button" onClick={() => void exportSequence()}>EXPORT SEQ</button>
      </div>
    </div>
  );
}

function MeterBar({ value, label }: { value: number; label: string }) {
  const n = Math.max(0, Math.min(1, value));
  return (
    <div className="lcdmeter">
      <div className="lcdmeter__track">
        <i style={{ height: `${Math.round(n * 100)}%` }} />
      </div>
      <span>{label}</span>
    </div>
  );
}

function BrowserScreen() {
  const entries = useStore((s) => s.browserEntries);
  const loadBrowserSample = useStore((s) => s.loadBrowserSample);
  const setScreen = useStore((s) => s.setScreen);
  const [sel, setSel] = useState(0);

  return (
    <div className="lcdpanel">
      <div className="lcdlist browserlist">
        {entries.length === 0 && <div>— no samples in storage —</div>}
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
      </div>
      <div className="hintline">Tap to preview · LOAD assigns to current pad.</div>
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
      <div className="hintline">Use the fader to nudge the selected event.</div>
    </div>
  );
}

function FaderMenuScreen() {
  const faderParam = useStore((s) => s.faderParam);
  const cycleFaderParam = useStore((s) => s.cycleFaderParam);
  const setScreen = useStore((s) => s.setScreen);
  const params = [
    'Pad Volume', 'Pad Pan', 'Pad Tune', 'Pad Filter Cutoff', 'Kit Volume',
  ];

  return (
    <div className="lcdpanel">
      <div className="lcdlist">
        {params.map((p) => (
          <div key={p} className={p === faderParam ? 'sel' : ''} onClick={cycleFaderParam}>
            {p}
          </div>
        ))}
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
      </div>
      <div className="hintline">Current: {faderParam}</div>
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
  const pad = project.banks[bank][selectedPad];

  return (
    <div className="lcdpanel">
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
        <b>{pad.warpMode === 'pitch' ? 'Pitch' : 'Stretch'}</b>
      </div>
      <div className="lcdrow">
        <span>Beats</span>
        <input
          type="range" min={1} max={16} value={pad.beats}
          onChange={(e) => updatePad(selectedPad, { beats: Number(e.target.value) })}
        />
        <b>{pad.beats}</b>
      </div>
      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('padfx')}>BACK</button>
      </div>
    </div>
  );
}
