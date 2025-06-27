import { useId, useState } from 'react';
import { NAME_LENGTH, NICKNAME_LENGTH } from '../../data/db';
import { cap } from '../../data/format';
import { useModalSheet } from '../../hooks/useModalSheet';

/**
 * A centred dialog that renames a team or Pokédex (up to NAME_LENGTH characters, counted as code points), or sets a member's
 * nickname; `onSave` runs only when the name changed. `nickname` titles it "Nickname", takes up to NICKNAME_LENGTH
 * characters and lets it be emptied to clear it.
 */
export function RenameSheet({
  noun,
  name: current,
  nickname,
  onSave,
  onClose,
}: {
  noun: string;
  name: string;
  nickname?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose, { drag: false });
  const [name, setName] = useState(current);
  const headingId = useId();
  const limit = nickname ? NICKNAME_LENGTH : NAME_LENGTH;
  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section
        ref={sheet}
        tabIndex={-1}
        className="sheet dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() !== current) onSave(name);
            close();
          }}
        >
          <div className="sheet-head">
            <h2 id={headingId}>{nickname ? 'Nickname' : `Rename ${noun}`}</h2>
            <button type="button" className="text-btn" onClick={() => close()}>
              Cancel
            </button>
          </div>
          <label className="search rename-field">
            <span className="sr-only">{nickname ? `Nickname for ${noun}` : `${cap(noun)} name`}</span>
            <input
              data-autofocus
              value={name}
              placeholder={nickname ? noun : undefined}
              autoComplete="off"
              enterKeyHint="done"
              // A longer name is refused rather than cut, so the caret, emoji and IME input stay whole.
              onChange={(e) => [...e.target.value].length <= limit && setName(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p className="hint">
            Up to {limit} characters.{nickname && ' Leave it empty to clear it.'}
          </p>
          <button className="primary-btn" disabled={!nickname && !name.trim()}>
            Save
          </button>
        </form>
      </section>
    </>
  );
}
