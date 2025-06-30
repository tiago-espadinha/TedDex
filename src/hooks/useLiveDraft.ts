import { useState } from 'react';

/**
 * A filter sheet's choices, applied as they change: the sheet shows `draft`, and each
 * `update` reaches `onChange` at once, so closing the sheet any way keeps them.
 */
export function useLiveDraft<T>(value: T, onChange: (next: T) => void) {
  const [draft, setDraft] = useState(value);
  const update = (change: (d: T) => T) => {
    const next = change(draft);
    setDraft(next);
    onChange(next);
  };
  return [draft, update] as const;
}
