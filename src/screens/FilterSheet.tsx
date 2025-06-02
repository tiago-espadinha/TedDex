import { useState } from 'react';
import { useModalSheet } from '../components/bits';
import { CATEGORY_LABELS, DEFAULT_FILTERS, SORT_LABELS, type DexFilters, type SortKey } from '../data/dexState';
import { TYPE_NAMES, typeChip } from '../data/typeColors';
import type { Category, TypeName } from '../data/types';
import { roman } from '../data/format';

const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SORTS = Object.entries(SORT_LABELS) as [SortKey, string][];
const CATEGORIES = Object.entries(CATEGORY_LABELS) as [Category, string][];

/** Adds `x` to the list, or takes it out if it is there. */
const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

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
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const count = countFor(draft);

  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title">
        <div className="handle" />
        <div className="sheet-head">
          <h2 id="filter-title">Filter &amp; sort</h2>
          <button className="text-btn" onClick={() => setDraft((d) => ({ ...DEFAULT_FILTERS, query: d.query }))}>
            Reset
          </button>
        </div>

        <ToggleAllHeading
          title="Generation"
          all={draft.gens.length === GENS.length}
          onToggle={(all) => setDraft((d) => ({ ...d, gens: all ? [] : GENS }))}
        />
        <div className="gen-grid">
          {GENS.map((g) => (
            <button
              key={g}
              className="gen-btn"
              aria-pressed={draft.gens.includes(g)}
              onClick={() => setDraft((d) => ({ ...d, gens: toggle(d.gens, g).sort() }))}
            >
              Gen {roman(g)}
            </button>
          ))}
        </div>

        <ToggleAllHeading
          title="Type"
          all={draft.types.length === TYPE_NAMES.length}
          onToggle={(all) => setDraft((d) => ({ ...d, types: all ? [] : [...TYPE_NAMES] }))}
        />
        <div className="type-grid">
          {TYPE_NAMES.map((t: TypeName) => {
            const on = draft.types.includes(t);
            const c = typeChip(t);
            return (
              <button
                key={t}
                className="type-toggle"
                aria-pressed={on}
                onClick={() => setDraft((d) => ({ ...d, types: toggle(d.types, t) }))}
                style={{ borderColor: c, backgroundColor: on ? c : undefined, color: on ? 'var(--on-type)' : 'var(--ink)' }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <p className="hint">Shows Pokémon with any of the chosen types.</p>

        <h3 id="filter-category">Category</h3>
        <div className="cat-grid" role="group" aria-labelledby="filter-category">
          {CATEGORIES.map(([c, label]) => (
            <button
              key={c}
              className="gen-btn"
              aria-pressed={draft.category === c}
              onClick={() => setDraft((d) => ({ ...d, category: d.category === c ? null : c }))}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint">One at a time; tap it again to clear.</p>

        <h3>Sort by</h3>
        <div className="sort-grid" role="radiogroup" aria-label="Sort by">
          {SORTS.map(([key, label]) => (
            <button key={key} className="gen-btn" role="radio" aria-checked={draft.sort === key} onClick={() => setDraft((d) => ({ ...d, sort: key }))}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ height: 24 }} />
        <button className="primary-btn" onClick={() => close(() => onApply(draft))} disabled={count === 0}>
          {count === 0 ? 'No results' : `Show ${count} result${count === 1 ? '' : 's'}`}
        </button>
      </section>
    </>
  );
}

/** A section heading that selects every option, or clears them when all are selected. */
export function ToggleAllHeading({ title, all, onToggle }: { title: string; all: boolean; onToggle: (all: boolean) => void }) {
  return (
    <h3>
      <button className="head-toggle" aria-pressed={all} onClick={() => onToggle(all)}>
        {title}
        <span className="act">{all ? 'Clear' : 'Select all'}</span>
      </button>
    </h3>
  );
}
