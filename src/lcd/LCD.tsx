import { useEffect, useState } from 'react';
import { saveProject } from '../storage/projects';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { Waveform } from '../ui/Waveform';
import { PAGE_GROUPS, type KParam } from './pages';
import { chopPage } from './chopPage';
import { KNOB_FX } from '../audio/fx/knobfx';
import { PAD_FX } from '../audio/fx/padfx';
import { SAMPLE_FILE_INPUT_ID } from '../sampleInput';

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

  const pad = project.banks[bank][selectedPad];
  const buffer = engine.getBuffer(pad.sampleId);

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
    const group = PAGE_GROUPS[bGroup - 1];
    let page = group[bPage[bGroup - 1] % group.length];

    // Chop replaces the Trim page while it's active — the other page groups
    // are untouched.
    if (chopActive && bGroup === 1 && page.title === 'Trim') {
      page = chopPage(selectedSlice);
    }
    const params = page.params(pad, project);

    return (
      <div className="lcd">
        <div className="tabs">
          {PAGE_GROUPS.map((g, i) => {
            const p = g[bPage[i] % g.length];
            const title = chopActive && i === 0 && p.title === 'Trim' ? 'Chop' : p.title;
            return (
              <div key={i} className={i === bGroup - 1 ? 'on' : ''}>
                {title}
              </div>
            );
          })}
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
          {chopActive && pad.sampleId && (
            <button type="button" className="lcd-btn lcd-btn--ghost" onClick={runChop}>
              CHOP
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

        <div className="lanes">
          <Waveform
            buffer={buffer}
            start={pad.start}
            end={pad.end || (buffer?.length ?? 0)}
            loopStart={pad.loopStart}
            slices={pad.slices}
            playhead={playhead}
          />
          {!buffer && (
            <span className="lcd-load-cta" aria-hidden>
              LOAD A SAMPLE
            </span>
          )}
        </div>

        <KRow params={params} onChange={(p, v) => p.set(v, updatePad, selectedPad)} />
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
    case 'flexbeat':
      return <PadFXScreen />;

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
