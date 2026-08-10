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
        <p>Choose how long samples are handled. Auto chop works great for songs and loops from LOOPS.</p>
        <div className="modal-actions">
          <button type="button" className="modal-btn primary" onClick={() => pick('auto')}>
            Auto chop
            <span>Split long audio into 16 pads (CHOP SONG)</span>
          </button>
          <button type="button" className="modal-btn" onClick={() => pick('manual')}>
            Manual
            <span>Load only — use CHOP SONG on the LCD when ready</span>
          </button>
        </div>
      </div>
    </div>
  );
}
