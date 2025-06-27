import { useId } from 'react';
import { useModalSheet } from '../../hooks/useModalSheet';
import './DeleteSheet.css';

/** Asks before deleting `name`; `lost` says what goes with it. Cancel takes focus, so Enter alone can't delete. */
export function DeleteSheet({
  name,
  lost,
  onDelete,
  onClose,
}: {
  name: string;
  lost: string;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose, { drag: false });
  const headingId = useId();
  const textId = useId();
  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section
        ref={sheet}
        tabIndex={-1}
        className="sheet dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={textId}
      >
        <div className="sheet-head">
          <h2 id={headingId} className="confirm-title">
            Delete {name}?
          </h2>
        </div>
        <p id={textId} className="confirm-text">
          {lost} This can't be undone.
        </p>
        <div className="confirm-actions">
          <button className="primary-btn cancel" data-autofocus onClick={() => close()}>
            Cancel
          </button>
          <button className="primary-btn danger" onClick={() => close(onDelete)}>
            Delete
          </button>
        </div>
      </section>
    </>
  );
}
