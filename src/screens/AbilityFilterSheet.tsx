import { useModalSheet } from '../components/bits';
import { useLiveDraft } from '../components/useLiveDraft';
import type { AbilityFilters } from '../data/abilityFilter';
import { roman } from '../data/format';
import { ToggleAllHeading } from './FilterSheet';

const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

/** Generation filter for the Abilities reference list; `gens` are the generations that introduced any ability. */
export function AbilityFilterSheet({
  value,
  gens,
  countFor,
  onChange,
  onClose,
}: {
  value: AbilityFilters;
  gens: number[];
  countFor: (f: AbilityFilters) => number;
  /** Called on every change: the sheet applies its filters live. */
  onChange: (f: AbilityFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useLiveDraft(value, onChange);
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const count = countFor(draft);

  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="ability-filter-title">
        <div className="handle" />
        <div className="sheet-head">
          <h2 id="ability-filter-title">Filter abilities</h2>
          <button className="text-btn" onClick={() => setDraft((d) => ({ ...d, gens: [] }))}>
            Reset
          </button>
        </div>

        <ToggleAllHeading
          title="Generation introduced"
          all={gens.every((g) => draft.gens.includes(g))}
          onToggle={(all) => setDraft((d) => ({ ...d, gens: all ? [] : gens }))}
        />
        <div className="gen-grid">
          {gens.map((g) => (
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

        <div className="sheet-foot">
          <button className="primary-btn" onClick={() => close()}>
            {count === 0 ? 'No abilities' : `Show ${count} abilit${count === 1 ? 'y' : 'ies'}`}
          </button>
        </div>
      </section>
    </>
  );
}
