import { useStore } from '../state/store';
import { Knob } from './Knob';
import { resolveSamplePage } from '../lcd/samplePage';

/** Physical K1–K3 knobs above the pad grid — matches the hardware photo. */
export function ParamKnobs() {
  const screen = useStore((s) => s.screen);
  const bGroup = useStore((s) => s.bGroup);
  const bPage = useStore((s) => s.bPage);
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const selectedPad = useStore((s) => s.selectedPad);
  const updatePad = useStore((s) => s.updatePad);
  const chopActive = useStore((s) => s.padModes.chop);
  const selectedSlice = useStore((s) => s.selectedSlice);

  if (screen !== 'sample') {
    return (
      <div className="kknobs kknobs--idle">
        <div className="kwrap"><div className="knob knob-k knob-k--dim" /><div className="klabel">K1</div></div>
        <div className="kwrap"><div className="knob knob-k knob-k--dim" /><div className="klabel">K2</div></div>
        <div className="kwrap"><div className="knob knob-k knob-k--dim" /><div className="klabel">K3</div></div>
      </div>
    );
  }

  const pad = project.banks[bank][selectedPad];
  const { params } = resolveSamplePage(
    bGroup, bPage, chopActive, selectedSlice, pad, project,
  );

  return (
    <div className="kknobs">
      {[0, 1, 2].map((i) => {
        const p = params[i];
        return (
          <div className="kwrap" key={i}>
            {p ? (
              <Knob
                value={p.norm}
                onChange={(v) => p.set(v, updatePad, selectedPad)}
                size="sm"
                sensitivity={340}
              />
            ) : (
              <div className="knob knob-k knob-k--dim" />
            )}
            <div className="klabel">K{i + 1}</div>
          </div>
        );
      })}
    </div>
  );
}
