import { CategoryIcon, useModalSheet } from '../components/bits';
import { useLiveDraft } from '../components/useLiveDraft';
import { GameTrigger, type GameChoice } from '../components/GamePicker';
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

/** Game, learn method, category and type filters for the member editor's move picker. `onGame` swaps it for the game sheet; `onReset` is for what the draft doesn't hold, Any game. */
export function MoveChoiceFilterSheet({
  value,
  game,
  versions,
  shows,
  onGame,
  onReset,
  countFor,
  onChange,
  onClose,
}: {
  value: MoveChoiceFilters;
  game: GameChoice;
  versions: VersionGroup[];
  shows?: number;
  onGame: () => void;
  onReset: () => void;
  countFor: (f: MoveChoiceFilters) => number;
  /** Called on every change: the sheet applies its filters live. */
  onChange: (f: MoveChoiceFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useLiveDraft(value, onChange);
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const count = countFor(draft);

  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="move-choice-filter-title">
        <div className="handle" />
        <div className="sheet-head">
          <h2 id="move-choice-filter-title">Filter moves</h2>
          <button
            className="text-btn"
            onClick={() => {
              setDraft(() => NO_MOVE_FILTERS);
              onReset();
            }}
          >
            Reset
          </button>
        </div>

        <h3>Learnable in</h3>
        <GameTrigger value={game} versions={versions} shows={shows} autoFocus onClick={() => close(onGame)} />

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

        <div className="sheet-foot">
          <button className="primary-btn" onClick={() => close()}>
            {count === 0 ? 'No moves' : `Show ${count} move${count === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </>
  );
}
