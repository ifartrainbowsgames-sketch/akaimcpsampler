import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './state/store';
import { engine } from './audio/engine';
import { LCD } from './lcd/LCD';
import { Pads } from './ui/Pads';
import { Knob } from './ui/Knob';
import { Fader } from './ui/Fader';
import { PanelButton } from './ui/PanelButton';

export default function App() {
  const booted = useStore((s) => s.booted);
  const boot = useStore((s) => s.boot);

  if (!booted) return <BootScreen onStart={boot} />;
  return <Panel />;
}

/**
 * iOS requires the AudioContext to be created AND resumed inside a user
 * gesture. An explicit start screen is the reliable way to guarantee that —
 * trying to be clever about it fails on real devices.
 */
function BootScreen({ onStart }: { onStart(): Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="boot">
      <div className="bootcard">
        <h1>Sampler</h1>
        <p>16 pads, sequencer, sample import. Everything runs on your device.</p>
        <button
          type="button"
          className="bootbtn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onStart();
          }}
        >
          {busy ? 'Starting…' : 'Tap to start'}
        </button>
        <p className="bootnote">
          Tap the LCD or drop an audio file onto any pad to load it. Play with
          Z X C V / A S D F / Q W E R / 1 2 3 4.
        </p>
      </div>
    </div>
  );
}

function Panel() {
  const shift = useStore((s) => s.shift);
  const setShift = useStore((s) => s.setShift);
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const cycleB = useStore((s) => s.cycleB);
  const padModes = useStore((s) => s.padModes);
  const togglePadMode = useStore((s) => s.togglePadMode);
  const bank = useStore((s) => s.bank);
  const setBank = useStore((s) => s.setBank);
  const play = useStore((s) => s.play);
  const stop = useStore((s) => s.stop);
  const toggleRecord = useStore((s) => s.toggleRecord);
  const importSample = useStore((s) => s.importSample);
  const selectedPad = useStore((s) => s.selectedPad);
  const project = useStore((s) => s.project);
  const updatePad = useStore((s) => s.updatePad);
  const runChop = useStore((s) => s.runChop);
  const splitSelectedSlice = useStore((s) => s.splitSelectedSlice);
  const mergeSelectedSlice = useStore((s) => s.mergeSelectedSlice);
  const extractSelectedSlice = useStore((s) => s.extractSelectedSlice);
  const trimSelected = useStore((s) => s.trimSelected);
  const toggleFullLevel = useStore((s) => s.toggleFullLevel);
  const cycleLevelsType = useStore((s) => s.cycleLevelsType);
  const fullLevel = useStore((s) => s.fullLevel);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const faderParam = useStore((s) => s.faderParam);
  const exportSong = useStore((s) => s.exportSong);

  const pad = project.banks[bank][selectedPad];
  const unmuteAll = () => {
    project.banks[bank].forEach((p, i) => { if (p.muted) updatePad(i, { muted: false }); });
  };

  const [volume, setVolume] = useState(0.8);
  const [faderValue, setFaderValue] = useState(0.75);
  const [meter, setMeter] = useState(0);
  const [transport, setTransport] = useState({ playing: false, recording: false });
  const fileInput = useRef<HTMLInputElement>(null);

  // Telemetry poll. The engine never triggers a render itself.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setMeter(engine.readLevel());
      setTransport({
        playing: engine.telemetry.playing,
        recording: engine.telemetry.recording,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    engine.setMasterVolume(volume);
  }, [volume]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShift(true);
      if (e.code === 'Space') {
        e.preventDefault();
        engine.telemetry.playing ? stop() : play();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShift(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setShift, play, stop]);

  const pickFile = useCallback(() => fileInput.current?.click(), []);

  return (
    <div className={`stage ${shift ? 'shifted' : ''}`}>
      <div className="unit">
        <div className="screw tl" /><div className="screw tr" />
        <div className="screw bl" /><div className="screw br" />

        {/* ---------- black deck ---------- */}
        <div className="deck">
          <div className="deckrow1">
            <div className="logo"><b>NOVA</b><i>audio labs</i></div>
            <div className="fnrow">
              <button type="button" className="fnbtn" onClick={() => cycleB(1)}>B1</button>
              <button type="button" className="fnbtn" onClick={() => cycleB(2)}>B2</button>
              <button type="button" className="fnbtn" onClick={() => cycleB(3)}>B3</button>
            </div>
            <div className="wordmark">SP SAMPLE</div>
          </div>

          <div className="deckrow2">
            <div className="volwrap">
              <Knob value={volume} onChange={setVolume} size="md" label="MAIN VOL" />
              <div className="bankcol">
                <div className="bankltr">{String.fromCharCode(65 + bank)}</div>
                <div className="greenled" />
              </div>
            </div>

            <div className="lcdframe"><LCD onPickSample={pickFile} /></div>

            <div className="metercol">
              <div className="meterbars">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} className={meter * 8 > i ? (i > 6 ? 'hot' : 'on') : ''} />
                ))}
              </div>
              <div className="speaker" />
            </div>
          </div>
        </div>

        {/* ---------- body ---------- */}
        <div className="body">
          <div className="col left">
            <div className="sechead">MODE</div>
            <div className="grid2">
              <PanelButton label="SAMPLE" sub="INPUT CONFIG" lit={screen === 'sample'}
                onClick={() => setScreen(shift ? 'inputcfg' : 'sample')} />
              <PanelButton label="SEQ" sub="STEP EDIT" lit={screen === 'seq' || screen === 'stepedit'}
                onClick={() => setScreen(shift ? 'stepedit' : 'seq')} />
              <PanelButton label="PAD FX" sub="FLEX BEAT" colour="orange"
                lit={screen === 'padfx' || screen === 'flexbeat'}
                onClick={() => setScreen(shift ? 'flexbeat' : 'padfx')} />
              <PanelButton label="KNOB FX" sub="FX SELECT" colour="orange" lit={screen === 'knobfx'}
                onClick={() => setScreen('knobfx')} />
            </div>

            <div className="grid2 gap">
              <PanelButton label="SHIFT" lit={shift}
                onPointerDown={() => setShift(true)}
                onPointerUp={() => setShift(false)} />
              <PanelButton label="PAD BANK" onClick={() => setBank((bank + 1) % 8)} />
            </div>

            <Fader
              value={faderValue}
              label={faderParam.toUpperCase().slice(0, 10)}
              onChange={(v) => {
                setFaderValue(v);
                // The fader drives whichever parameter is assigned in the
                // Fader menu, on the currently selected pad.
                switch (faderParam) {
                  case 'Pad Volume': updatePad(selectedPad, { gain: v * 80 - 74 }); break;
                  case 'Pad Pan': updatePad(selectedPad, { pan: v * 2 - 1 }); break;
                  case 'Pad Tune': updatePad(selectedPad, { semi: Math.round(v * 48 - 24) }); break;
                  case 'Pad Filter Cutoff': updatePad(selectedPad, { cutoff: Math.round(v * 127) }); break;
                  case 'Kit Volume': engine.setKitVolume(v * 80 - 74); break;
                  default: break;
                }
              }}
            />

            <div className="grid2">
              <PanelButton label="ERASE" sub="COPY" />
              <PanelButton label="NOTE REPEAT" sub="TRIPLET" />
            </div>
          </div>

          <div className="col centre">
            <div className="kknobs">
              <div className="kspacer">K1</div>
              <div className="kspacer">K2</div>
              <div className="kspacer">K3</div>
            </div>
            <Pads />
          </div>

          <div className="col right">
            <div className="sechead">PAD PLAY</div>
            <div className="grid2">
              <PanelButton label="CHOP" sub="NOTE ON" colour="blue"
                lit={padModes.chop}
                onClick={() => shift
                  ? updatePad(selectedPad, { noteOn: !pad.noteOn })
                  : togglePadMode('chop')} />
              <PanelButton label="MUTE" sub="UNMUTE ALL" colour="blue"
                lit={padModes.mute}
                onClick={() => shift ? unmuteAll() : togglePadMode('mute')} />
              <PanelButton label="LOOP" sub="REVERSE" colour="blue"
                lit={pad.loop}
                onClick={() => shift
                  ? updatePad(selectedPad, { reverse: !pad.reverse })
                  : updatePad(selectedPad, { loop: !pad.loop })} />
              <PanelButton label="16 LEVELS" sub="TYPE" colour="blue"
                lit={padModes.levels}
                onClick={() => shift ? cycleLevelsType() : togglePadMode('levels')} />
            </div>

            {padModes.chop && (
              <div className="chopbar">
                <button type="button" onClick={runChop}>CHOP</button>
                <button type="button" onClick={splitSelectedSlice}>SPLIT</button>
                <button type="button" onClick={mergeSelectedSlice}>MERGE</button>
                <button type="button" onClick={extractSelectedSlice}>EXTRACT</button>
              </div>
            )}

            <div className="grid2 gap">
              <PanelButton label="SAMPLE SELECT" sub="SAVE SAMPLE" onClick={pickFile} />
              <PanelButton label="TAP TEMPO" sub="METRO" />
            </div>

            <div className="encblock">
              <Knob value={0.5} onChange={() => {}} size="lg" />
              <div className="micicon" aria-hidden>🎙</div>
            </div>

            <div className="grid2">
              <PanelButton label="−" sub="UNDO" onClick={undo} />
              <PanelButton label="+" sub="REDO" onClick={redo} />
            </div>

            <div className="grid2">
              <PanelButton label="SAMPLE RECORD" sub="RECALL"
                onClick={() => setScreen('smprec')} />
              <PanelButton label="SEQ RECORD" sub="RECALL"
                lit={transport.recording} onClick={toggleRecord} />
            </div>

            <div className="grid2">
              <PanelButton label="■" onClick={stop} />
              <PanelButton label="▶" sub="CONTINUE" lit={transport.playing} onClick={play} />
            </div>
          </div>
        </div>

        <div className="rest" />
      </div>

      <div className="quickrow">
        <button type="button" className={fullLevel ? 'on' : ''} onClick={toggleFullLevel}>
          FULL LEVEL
        </button>
        <button type="button" onClick={trimSelected}>TRIM SAMPLE</button>
        <button type="button" onClick={() => void exportSong()}>EXPORT WAV</button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importSample(f, selectedPad);
          e.target.value = '';
        }}
      />

      <p className="hint">
        Tap the <b>LCD</b>, drop audio on a pad, or use <b>SAMPLE SELECT</b>. <b>Space</b> plays.
        Hold <b>Shift</b> for secondary functions. Keys <b>ZXCV / ASDF / QWER / 1234</b>.
      </p>
    </div>
  );
}
