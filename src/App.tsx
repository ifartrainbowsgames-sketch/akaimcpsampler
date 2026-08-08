import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { engine } from './audio/engine';
import { LCD } from './lcd/LCD';
import { Pads } from './ui/Pads';
import { ParamKnobs } from './ui/ParamKnobs';
import { Knob } from './ui/Knob';
import { JogWheel } from './ui/JogWheel';
import { Fader } from './ui/Fader';
import { PanelButton } from './ui/PanelButton';
import { ChopModeModal } from './ui/ChopModeModal';
import { UpdateBanner } from './ui/UpdateBanner';
import { SAMPLE_FILE_INPUT_ID } from './sampleInput';
import { APP_VERSION } from './version';
import { AkaiLogo, MpcWordmark } from './ui/AkaiLogo';
import type { ChopLoadMode } from './storage/preferences';

export default function App() {
  const booted = useStore((s) => s.booted);
  const boot = useStore((s) => s.boot);

  if (!booted) return <BootScreen onStart={boot} />;
  return <Panel />;
}

function BootScreen({ onStart }: { onStart(): Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="boot">
      <div className="bootcard">
        <div className="bootlogo">
          <AkaiLogo className="akailogo" />
        </div>
        <h1>MPC SAMPLE</h1>
        <p>16-pad sampler and sequencer. Everything runs on your device.</p>
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
          Select a pad, tap <b>UPLOAD</b> or <b>KITS</b> on the LCD, then play.
        </p>
        <p className="bootver">v{APP_VERSION}</p>
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
  const cycleLevelsType = useStore((s) => s.cycleLevelsType);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const faderParam = useStore((s) => s.faderParam);
  const pendingChopPad = useStore((s) => s.pendingChopPad);
  const resolveChopChoice = useStore((s) => s.resolveChopChoice);
  const setWaveformZoom = useStore((s) => s.setWaveformZoom);
  const nudgeStepEvent = useStore((s) => s.nudgeStepEvent);

  const pad = project.banks[bank][selectedPad];
  const unmuteAll = () => {
    project.banks[bank].forEach((p, i) => { if (p.muted) updatePad(i, { muted: false }); });
  };

  const [volume, setVolume] = useState(0.8);
  const [faderValue, setFaderValue] = useState(0.75);
  const [jog, setJog] = useState(0.5);
  const [meter, setMeter] = useState(0);
  const [transport, setTransport] = useState({ playing: false, recording: false });

  useEffect(() => {
    setWaveformZoom(1 + jog * 15);
  }, [jog, setWaveformZoom]);

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

  const onChopChoice = (mode: ChopLoadMode) => resolveChopChoice(mode);

  return (
    <div className={`stage ${shift ? 'shifted' : ''}`}>
      <UpdateBanner />
      {pendingChopPad !== null && <ChopModeModal onChoose={onChopChoice} />}

      <div className="unit">
        <div className="screw tl" /><div className="screw tr" />
        <div className="screw bl" /><div className="screw br" />

        <div className="deck">
          <div className="deckrow1">
            <div className="logo"><AkaiLogo className="akailogo akailogo--deck" /></div>
            <div className="fnrow">
              <button type="button" className="fnbtn" aria-label="B1" onClick={() => cycleB(1)} />
              <button type="button" className="fnbtn" aria-label="B2" onClick={() => cycleB(2)} />
              <button type="button" className="fnbtn" aria-label="B3" onClick={() => cycleB(3)} />
            </div>
            <div className="wordmark"><MpcWordmark /></div>
          </div>

          <div className="deckrow2">
            <div className="volwrap">
              <div className="volstack">
                <Knob value={volume} onChange={setVolume} size="md" sensitivity={320} variant="volume" />
                <div className="vollabel">MAIN<br />VOLUME</div>
              </div>
              <div className="bankcol">
                <div className="bankltr">{String.fromCharCode(65 + bank)}</div>
                <div className="greenled" />
              </div>
            </div>

            <div className="lcdframe"><LCD /></div>

            <div className="speakercol">
              <div className={`speaker ${meter > 0.05 ? 'speaker--on' : ''}`} />
            </div>
          </div>
        </div>

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
                onPointerUp={() => setShift(false)}
                onPointerLeave={() => setShift(false)} />
              <PanelButton label="PAD BANK" onClick={() => setBank((bank + 1) % 8)} />
            </div>

            <Fader
              value={faderValue}
              label={faderParam.toUpperCase().slice(0, 10)}
              onChange={(v) => {
                setFaderValue(v);
                if (screen === 'stepedit') {
                  const delta = Math.round((v - 0.5) * 48);
                  if (delta !== 0) nudgeStepEvent(delta);
                  return;
                }
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
            <ParamKnobs />
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
              <div className="chopbar chopbar--compact">
                <span className="chopbar__hint">Chop controls on LCD</span>
              </div>
            )}

            <div className="grid2 gap">
              <PanelButton label="SAMPLE SELECT" sub="FREESOUND"
                onClick={() => setScreen(shift ? 'project' : 'library')} />
              <PanelButton label="TAP TEMPO" sub="METRO" />
            </div>

            <div className="encblock">
              <JogWheel value={jog} onChange={setJog} label="JOG" />
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

            <div className="grid2 transport">
              <button type="button" className="pb tp stop" onClick={stop} aria-label="Stop">
                <span className="cap" />
                <span className="sub">&nbsp;</span>
              </button>
              <button type="button" className={`pb tp play ${transport.playing ? 'lit' : ''}`} onClick={play} aria-label="Play">
                <span className="cap" />
                <span className="sub">CONTINUE</span>
              </button>
            </div>
          </div>
        </div>

        <div className="rest" />
      </div>

      <input
        id={SAMPLE_FILE_INPUT_ID}
        className="file-input-sr"
        type="file"
        accept="audio/*,.mp3,.wav,.aiff,.m4a,.ogg,.flac"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importSample(f, selectedPad);
          e.target.value = '';
        }}
      />
    </div>
  );
}
