import { useState, type CSSProperties, type ReactNode } from 'react';
import type { HintList } from '../../data/searchHints';
import { Icon } from '../Icon/Icon';
import { usePinnedSearch } from '../../hooks/usePinnedSearch';
import { useBlurOnDrag } from '../../hooks/useBlurOnDrag';
import { SearchHintSheet } from './SearchHintSheet';
import './SearchField.css';

/**
 * Search field that sits in a screen's header row, next to its title. `trailing` goes inside the
 * field on the right (after the clear button), like the Dex grid/list toggle. Scrolled away, it
 * pins at the top in a compact form, and a back-to-top arrow appears above the filter button.
 * `hints` adds the "?" that opens the list's search tips.
 */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  trailing,
  hints,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  trailing?: ReactNode;
  hints?: HintList;
}) {
  const [hintsOpen, setHintsOpen] = useState(false);
  const { slot, field, pinTop, toTop } = usePinnedSearch();
  useBlurOnDrag(field);
  // The bar stays mounted at its last height, so it can fade out under the field on unpin.
  const [barTop, setBarTop] = useState(0);
  if (pinTop != null && pinTop !== barTop) setBarTop(pinTop);
  return (
    <div className="search-slot" ref={slot}>
      <div
        className={`search-bar${pinTop == null ? '' : ' on'}`}
        style={{ '--pin-top': `${barTop}px` } as CSSProperties}
        aria-hidden="true"
      />
      <label
        ref={field}
        className={`search in-head${pinTop == null ? '' : ' pinned'}`}
        style={{ top: pinTop == null ? undefined : `calc(${pinTop}px + var(--vv-top, 0px))` }}
      >
        <Icon name="search" size={20} />
        <input
          aria-label={label}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button className="icon-btn sm" aria-label="Clear search" onClick={() => onChange('')}>
            <Icon name="close" size={18} />
          </button>
        )}
        {hints && (
          <button
            className="icon-btn sm search-help"
            aria-label="Search tips"
            aria-haspopup="dialog"
            onClick={() => setHintsOpen(true)}
          >
            <Icon name="help" size={20} />
          </button>
        )}
        {trailing}
      </label>
      {hints && hintsOpen && <SearchHintSheet list={hints} onClose={() => setHintsOpen(false)} />}
      {toTop && (
        <button
          className="to-top"
          aria-label="Back to top"
          onClick={() => {
            const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
            scrollTo({ top: 0, behavior: instant ? 'instant' : 'smooth' });
            document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
          }}
        >
          <Icon name="up" size={22} />
        </button>
      )}
    </div>
  );
}
