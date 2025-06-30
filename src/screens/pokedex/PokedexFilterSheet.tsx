import { useModalSheet } from '../../hooks/useModalSheet';
import { useLiveDraft } from '../../hooks/useLiveDraft';
import { Icon, type IconName } from '../../components/Icon/Icon';
import { DEX_STATE_LABELS, type DexFilters, type DexState } from '../../data/pokedex';
import { TYPE_NAMES, typeChip } from '../../data/typeColors';
import { ToggleAllHeading } from '../dex/FilterSheet';
import './PokedexFilterSheet.css';

const STATES: DexState[] = [0, 1, 2, 3];
const STATE_ICONS: IconName[] = ['close', 'eye', 'ball', 'star'];
const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

/** State and type filters for a Pokédex page; both any-of, the search stays in the header. */
export function PokedexFilterSheet({
  value,
  countFor,
  onChange,
  onClose,
}: {
  value: DexFilters;
  countFor: (f: DexFilters) => number;
  /** Called on every change: the sheet applies its filters live. */
  onChange: (f: DexFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useLiveDraft(value, onChange);
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const count = countFor(draft);

  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section
        ref={sheet}
        tabIndex={-1}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dex-filter-title"
      >
        <div className="handle" />
        <div className="sheet-head">
          <h2 id="dex-filter-title">Filter Pokémon</h2>
          <button className="text-btn" onClick={() => setDraft((d) => ({ ...d, states: [], types: [] }))}>
            Reset
          </button>
        </div>

        <ToggleAllHeading
          title="State"
          all={draft.states.length === STATES.length}
          onToggle={(all) => setDraft((d) => ({ ...d, states: all ? [] : STATES }))}
        />
        <div className="sort-grid dex-states">
          {STATES.map((s) => (
            <button
              key={s}
              className="gen-btn"
              aria-pressed={draft.states.includes(s)}
              onClick={() => setDraft((d) => ({ ...d, states: toggle(d.states, s).sort() }))}
            >
              <Icon name={STATE_ICONS[s]} size={16} />
              {DEX_STATE_LABELS[s]}
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
                style={{
                  borderColor: c,
                  backgroundColor: on ? c : undefined,
                  color: on ? 'var(--on-type)' : 'var(--ink)',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="sheet-foot">
          <button className="primary-btn" onClick={() => close()}>
            {count === 0 ? 'No Pokémon' : `Show ${count} Pokémon`}
          </button>
        </div>
      </section>
    </>
  );
}
