import { useEffect, useState } from 'react';
import { DEFAULT_FILTERS, type DexFilters, type SortKey } from '../data/dexState';
import { TYPE_COLORS } from '../data/typeColors';
import type { TypeName } from '../data/types';
import { roman } from '../data/format';

const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TYPES = Object.keys(TYPE_COLORS) as TypeName[];
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'number', label: 'Number' },
  { key: 'name', label: 'Name' },
  { key: 'total', label: 'Base total' },
];

export function FilterSheet({
  value,
  countFor,
  onApply,
  onClose,
}: {
  value: DexFilters;
  countFor: (f: DexFilters) => number;
  onApply: (f: DexFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const toggleGen = (g: number) =>
    setDraft({ ...draft, gens: draft.gens.includes(g) ? draft.gens.filter((x) => x !== g) : [...draft.gens, g].sort() });
  const toggleType = (t: TypeName) => {
    if (draft.types.includes(t)) setDraft({ ...draft, types: draft.types.filter((x) => x !== t) });
    else if (draft.types.length < 2) setDraft({ ...draft, types: [...draft.types, t] });
  };

  const count = countFor(draft);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Filter and sort">
        <div className="handle" />
        <div className="sheet-head">
          <h2>Filter &amp; sort</h2>
          <button className="text-btn" onClick={() => setDraft({ ...DEFAULT_FILTERS, query: draft.query })}>
            Reset
          </button>
        </div>

        <h3>Generation</h3>
        <div className="gen-row">
          {GENS.map((g) => (
            <button key={g} className="gen-btn" aria-pressed={draft.gens.includes(g)} onClick={() => toggleGen(g)}>
              {roman(g)}
            </button>
          ))}
        </div>

        <h3>
          Type <span style={{ fontWeight: 600, textTransform: 'none' }}>· {draft.types.length} of 2</span>
        </h3>
        <div className="type-grid">
          {TYPES.map((t) => {
            const on = draft.types.includes(t);
            const c = TYPE_COLORS[t].chip;
            return (
              <button
                key={t}
                className="type-toggle"
                aria-pressed={on}
                disabled={!on && draft.types.length >= 2}
                onClick={() => toggleType(t)}
                style={{ borderColor: c, background: on ? c : undefined, color: on ? 'var(--on-type)' : c }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <p className="hint">Pick two types to find that exact dual-type combination.</p>

        <h3>Sort by</h3>
        <div className="segmented" role="radiogroup" aria-label="Sort by">
          {SORTS.map((s) => (
            <button key={s.key} role="radio" aria-checked={draft.sort === s.key} onClick={() => setDraft({ ...draft, sort: s.key })}>
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ height: 24 }} />
        <button className="primary-btn" onClick={() => onApply(draft)} disabled={count === 0}>
          {count === 0 ? 'No results' : `Show ${count} result${count === 1 ? '' : 's'}`}
        </button>
      </section>
    </>
  );
}
