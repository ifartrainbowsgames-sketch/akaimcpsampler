import { createPortal } from 'react-dom';
import { useStore } from '../state/store';
import { ASSIGNABLE_PARAMS } from '../lcd/assignableParams';
import { PAGE_GROUPS } from '../lcd/pages';

/** Q-Link style picker: Shift + tap a K-knob opens this to freely assign it. */
export function KnobAssignPicker() {
  const slot = useStore((s) => s.knobAssignPicker);
  const closeKnobAssignPicker = useStore((s) => s.closeKnobAssignPicker);
  const setKnobAssign = useStore((s) => s.setKnobAssign);
  const knobAssign = useStore((s) => s.knobAssign);
  const project = useStore((s) => s.project);
  const bank = useStore((s) => s.bank);
  const selectedPad = useStore((s) => s.selectedPad);

  if (slot === null) return null;
  const pad = project.banks[bank][selectedPad];

  const groups = new Map<string, { id: string; name: string }[]>();
  for (const ref of ASSIGNABLE_PARAMS) {
    const page = PAGE_GROUPS[ref.groupIndex][ref.pageIndex];
    const kparam = page.params(pad, project)[ref.paramIndex];
    if (!kparam || kparam.name === '—') continue;
    const list = groups.get(ref.pageTitle) ?? [];
    list.push({ id: ref.id, name: kparam.name });
    groups.set(ref.pageTitle, list);
  }

  const current = knobAssign[slot];

  return createPortal(
    <>
      <div className="qlink-scrim" onClick={closeKnobAssignPicker} aria-hidden="true" />
      <div className="qlink-picker" role="dialog" aria-modal="true" aria-label={`Assign K${slot + 1}`}>
        <div className="qlink-picker__head">
          <span>ASSIGN K{slot + 1}</span>
          <button type="button" className="qlink-picker__close" onClick={closeKnobAssignPicker} aria-label="Close">
            ✕
          </button>
        </div>
        <button
          type="button"
          className="qlink-picker__clear"
          onClick={() => setKnobAssign(slot, null)}
          disabled={current === null}
        >
          CLEAR — use screen default
        </button>
        <div className="qlink-picker__list">
          {[...groups.entries()].map(([pageTitle, items]) => (
            <div key={pageTitle} className="qlink-picker__group">
              <div className="qlink-picker__group-title">{pageTitle}</div>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`qlink-picker__item${current === item.id ? ' qlink-picker__item--on' : ''}`}
                  onClick={() => setKnobAssign(slot, item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
