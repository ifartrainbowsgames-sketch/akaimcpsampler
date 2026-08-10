import { useStore } from '../state/store';
import { Knob } from './Knob';
import { resolveScreenParams } from '../lcd/screenParams';
import { KnobAssignPicker } from './KnobAssignPicker';

/** Physical K1–K3 knobs above the pad grid — active on all LCD screens. */
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
  const shift = useStore((s) => s.shift);
  const knobAssign = useStore((s) => s.knobAssign);
  const openKnobAssignPicker = useStore((s) => s.openKnobAssignPicker);

  const pad = project.banks[bank][selectedPad];
  const params = resolveScreenParams({
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
  });

  const useSoftTakeover = screen !== 'sample';

  return (
    <div className={`kknobs${params.length === 0 ? ' kknobs--idle' : ''}`}>
      {([0, 1, 2] as const).map((i) => {
        const p = params[i];
        const assigned = knobAssign[i] !== null;
        return (
          <div className="kwrap" key={i}>
            {p && p.name !== '—' ? (
              <Knob
                value={p.norm}
                onChange={(v) => p.set(v, updatePad, selectedPad)}
                size="sm"
                sensitivity={340}
                softTakeover={useSoftTakeover}
                guideId="knobs"
              />
            ) : (
              <div className="knob knob-k knob-k--dim" />
            )}
            <button
              type="button"
              className={`klabel klabel--assign${assigned ? ' klabel--assigned' : ''}`}
              onClick={() => openKnobAssignPicker(i)}
              aria-label={`Assign K${i + 1}`}
              title="Tap to assign this knob to any parameter"
            >
              {shift && screen === 'comp' && i === 2 ? 'S-K3' : `K${i + 1}`}
              {assigned && <span className="klabel__dot" aria-hidden="true" />}
            </button>
          </div>
        );
      })}
      <KnobAssignPicker />
    </div>
  );
}
