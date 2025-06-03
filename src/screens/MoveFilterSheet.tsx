import { useState } from 'react';
import { CategoryIcon, useModalSheet } from '../components/bits';
import { cap, roman } from '../data/format';
import { MOVE_CATEGORIES, MOVE_SORTS, type MoveFilters, type MoveSort } from '../data/moveFilter';
import { TYPE_NAMES, typeChip } from '../data/typeColors';
import { ToggleAllHeading } from './FilterSheet';

const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SORTS = Object.entries(MOVE_SORTS) as [MoveSort, string][];
const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

/** Category, generation and type filters plus the sort for the Moves reference list. */
export function MoveFilterSheet({
  value,
  countFor,
  onApply,
  onClose,
}: {
  value: MoveFilters;
  countFor: (f: MoveFilters) => number;
  onApply: (f: MoveFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const count = countFor(draft);

  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="move-filter-title">
        <div className="handle" />
        <div className="sheet-head">
          <h2 id="move-filter-title">Filter &amp; sort moves</h2>
          <button className="text-btn" onClick={() => setDraft((d) => ({ ...d, categories: [], gens: [], types: [], sort: 'name' }))}>
            Reset
          </button>
        </div>

        <ToggleAllHeading
          title="Category"
          all={draft.categories.length === MOVE_CATEGORIES.length}
          onToggle={(all) => setDraft((d) => ({ ...d, categories: all ? [] : MOVE_CATEGORIES }))}
        />
        <div className="gen-grid">
          {MOVE_CATEGORIES.map((c) => (
            <button
              key={c}
              className="gen-btn"
              aria-pressed={draft.categories.includes(c)}
              onClick={() => setDraft((d) => ({ ...d, categories: toggle(d.categories, c) }))}
            >
              <CategoryIcon category={c} decorative />
              {cap(c)}
            </button>
          ))}
        </div>

        <ToggleAllHeading
          title="Generation introduced"
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
          {TYPE_NAMES.map((t) => {
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
          {count === 0 ? 'No moves' : `Show ${count} move${count === 1 ? '' : 's'}`}
        </button>
      </section>
    </>
  );
}
