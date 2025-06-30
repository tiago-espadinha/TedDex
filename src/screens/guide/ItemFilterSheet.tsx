import { useModalSheet } from '../../hooks/useModalSheet';
import { useLiveDraft } from '../../hooks/useLiveDraft';
import { roman } from '../../data/format';
import { ITEM_CATEGORIES } from '../../data/itemCategories';
import type { ItemFilters } from '../../data/itemFilter';
import { ToggleAllHeading } from '../dex/FilterSheet';

const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

/** Category and generation filters for the Items reference list. */
export function ItemFilterSheet({
  value,
  countFor,
  onChange,
  onClose,
}: {
  value: ItemFilters;
  countFor: (f: ItemFilters) => number;
  /** Called on every change: the sheet applies its filters live. */
  onChange: (f: ItemFilters) => void;
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
        aria-labelledby="item-filter-title"
      >
        <div className="handle" />
        <div className="sheet-head">
          <h2 id="item-filter-title">Filter items</h2>
          <button className="text-btn" onClick={() => setDraft((d) => ({ ...d, categories: [], gens: [] }))}>
            Reset
          </button>
        </div>

        <ToggleAllHeading
          title="Category"
          all={draft.categories.length === ITEM_CATEGORIES.length}
          onToggle={(all) => setDraft((d) => ({ ...d, categories: all ? [] : [...ITEM_CATEGORIES] }))}
        />
        <div className="cat-grid">
          {ITEM_CATEGORIES.map((c) => (
            <button
              key={c}
              className="gen-btn"
              aria-pressed={draft.categories.includes(c)}
              // Kept in ITEM_CATEGORIES order so the URL and the chips read the same way every time.
              onClick={() =>
                setDraft((d) => {
                  const next = toggle(d.categories, c);
                  return { ...d, categories: ITEM_CATEGORIES.filter((x) => next.includes(x)) };
                })
              }
            >
              {c}
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

        <div className="sheet-foot">
          <button className="primary-btn" onClick={() => close()}>
            {count === 0 ? 'No items' : `Show ${count} item${count === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </>
  );
}
