import { useState } from 'react';
import { CategoryIcon, useModalSheet } from '../components/bits';
import { Icon } from '../components/Icon';
import { cap } from '../data/format';
import { NO_MOVE_FILTERS, type MoveChoiceFilters } from '../data/memberOptions';
import { MOVE_CATEGORIES } from '../data/moveFilter';
import { TYPE_NAMES, typeChip } from '../data/typeColors';
import type { LearnMethod, VersionGroup } from '../data/types';
import { ToggleAllHeading } from './FilterSheet';

const METHODS: [LearnMethod, string][] = [
  ['level', 'Level up'],
  ['machine', 'TM/HM'],
  ['tutor', 'Tutor'],
  ['egg', 'Egg'],
];
const ALL_METHODS = METHODS.map(([m]) => m);
const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

/** Game, learn method, category and type filters for the member editor's move picker. `games` are the species' games. */
export function MoveChoiceFilterSheet({
  value,
  games,
  countFor,
  onApply,
  onClose,
}: {
  value: MoveChoiceFilters;
  games: VersionGroup[];
  countFor: (f: MoveChoiceFilters) => number;
  onApply: (f: MoveChoiceFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const count = countFor(draft);

  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="move-choice-filter-title">
        <div className="handle" />
        <div className="sheet-head">
          <h2 id="move-choice-filter-title">Filter moves</h2>
          <button className="text-btn" onClick={() => setDraft(NO_MOVE_FILTERS)}>
            Reset
          </button>
        </div>

        <h3>Learnable in</h3>
        <label className="game-select">
          <span className="sr-only">Game</span>
          <select
            value={draft.game ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, game: e.target.value ? Number(e.target.value) : undefined }))}
          >
            <option value="">Any game</option>
            {games.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <Icon name="next" size={18} />
        </label>

        <ToggleAllHeading
          title="Learn method"
          all={draft.methods.length === ALL_METHODS.length}
          onToggle={(all) => setDraft((d) => ({ ...d, methods: all ? [] : ALL_METHODS }))}
        />
        <div className="gen-grid">
          {METHODS.map(([m, label]) => (
            <button key={m} className="gen-btn" aria-pressed={draft.methods.includes(m)} onClick={() => setDraft((d) => ({ ...d, methods: toggle(d.methods, m) }))}>
              {label}
            </button>
          ))}
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

        <div style={{ height: 24 }} />
        <button className="primary-btn" onClick={() => close(() => onApply(draft))} disabled={count === 0}>
          {count === 0 ? 'No moves' : `Show ${count} move${count === 1 ? '' : 's'}`}
        </button>
      </section>
    </>
  );
}
