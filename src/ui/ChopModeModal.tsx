import { setChopLoadMode, type ChopLoadMode } from '../storage/preferences';

interface Props {
  onChoose(mode: ChopLoadMode): void;
}

/** Ask once how samples should be chopped after load. */
export function ChopModeModal({ onChoose }: Props) {
  const pick = (mode: ChopLoadMode) => {
    setChopLoadMode(mode);
    onChoose(mode);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Chop mode">
      <div className="modal-card">
        <h2>After loading a sample</h2>
        <p>Choose how chopping works. You can change this later in Project settings.</p>
        <div className="modal-actions">
          <button type="button" className="modal-btn primary" onClick={() => pick('auto')}>
            Auto chop
            <span>Slice the sample and spread slices across pads 1–16</span>
          </button>
          <button type="button" className="modal-btn" onClick={() => pick('manual')}>
            Manual
            <span>Load only — press CHOP when you are ready</span>
          </button>
        </div>
      </div>
    </div>
  );
}
