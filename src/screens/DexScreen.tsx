import Fuse from 'fuse.js';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { artworkUrl, loadIndex, spriteUrl, useLoad } from '../data/api';
import { cap, formatNo, roman } from '../data/format';
import { addToTeam, db } from '../data/db';
import { CATEGORY_LABELS, SORT_LABELS, saveOrder, useDexFilters, type SortKey } from '../data/dexState';
import { typeTint } from '../data/typeColors';
import type { IndexEntry } from '../data/types';
import { FUSE_OPTIONS, applyFilters, sortValue } from '../data/filter';
import { Icon } from '../components/Icon';
import { Loading, SearchField, TypeChip, useToast } from '../components/bits';
import { FilterSheet } from './FilterSheet';
import { useDexView, useSpriteStyle } from '../data/settings';

const ROW_H = 118; // card 108 + gap 10
const LIST_ROW_H = 72; // row 64 + gap 8

function useColumns() {
  const get = () => (window.innerWidth >= 600 ? 3 : 2);
  const [cols, setCols] = useState(get);
  useEffect(() => {
    const on = () => setCols(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return cols;
}

export function DexScreen() {
  const { data: all, error } = useLoad(loadIndex, 'index');
  const [filters, setFilters] = useDexFilters();
  const [sheetOpen, setSheetOpen] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);
  const [params] = useSearchParams();
  const pickTeam = params.get('pick') ? Number(params.get('pick')) : null;
  const navigate = useNavigate();
  const toast = useToast();
  const cols = useColumns();
  const [spriteStyle] = useSpriteStyle();
  const [view, setView] = useDexView();
  const perRow = view === 'list' ? 1 : cols;

  const fuse = useMemo(() => (all ? new Fuse(all, FUSE_OPTIONS) : null), [all]);
  const list = useMemo(() => (all ? applyFilters(all, fuse, filters) : []), [all, fuse, filters]);
  useEffect(() => saveOrder(list.map((m) => m.id)), [list]);

  const rows = Math.ceil(list.length / perRow);
  const rowHeight = view === 'list' ? LIST_ROW_H : ROW_H;
  const virtual = useWindowVirtualizer({ count: rows, estimateSize: () => rowHeight, overscan: 4 });
  // Row heights differ between the views: measure again when switching.
  useEffect(() => virtual.measure(), [virtual, rowHeight]);

  const activeCount = filters.gens.length + filters.types.length + (filters.category ? 1 : 0) + (filters.sort !== 'number' ? 1 : 0);

  async function pick(id: number) {
    if (pickTeam == null) return;
    const ok = await addToTeam(pickTeam, id);
    const team = await db.teams.get(pickTeam);
    if (!ok) toast({ text: 'That team is already full' });
    navigate(`/teams/${pickTeam}`, { replace: true });
    if (ok && team) toast({ text: `Added to ${team.name}` });
  }

  const chips = [
    filters.gens.length > 0 && (filters.gens.length > 3 ? `${filters.gens.length} gens` : `Gen ${filters.gens.map(roman).join(', ')}`),
    filters.types.length > 0 && (filters.types.length > 2 ? `${filters.types.length} types` : filters.types.map(cap).join(' or ')),
    filters.sort !== 'number' && `Sort: ${SORT_LABELS[filters.sort]}`,
  ].filter((c): c is string => !!c);

  return (
    <>
      <header className="dex-head">
        <h1>Dex</h1>
        <SearchField
          label="Search Pokémon"
          placeholder="Name, number, type"
          value={filters.query}
          onChange={(query) => setFilters({ ...filters, query })}
          trailing={
            <button
              className="icon-btn sm"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView(view === 'list' ? 'grid' : 'list')}
            >
              <Icon name={view === 'list' ? 'grid' : 'list'} size={20} />
            </button>
          }
        />
      </header>

      {(chips.length > 0 || filters.category) && (
        <div className="chip-row">
          {filters.category && (
            <button
              className="filter-chip on removable"
              aria-label={`Remove ${CATEGORY_LABELS[filters.category]} filter`}
              onClick={() => {
                setFilters({ ...filters, category: null });
                // The chip (and maybe its row) unmounts: keep focus on the screen.
                fab.current?.focus();
              }}
            >
              {CATEGORY_LABELS[filters.category]}
              <Icon name="close" size={16} />
            </button>
          )}
          {chips.map((c) => (
            <button key={c} className="filter-chip on" onClick={() => setSheetOpen(true)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {pickTeam != null && (
        <div className="pick-banner">
          Tap a Pokémon to add it
          <button onClick={() => navigate(`/teams/${pickTeam}`, { replace: true })}>Cancel</button>
        </div>
      )}

      {error && <p className="empty">Couldn't load the dex data. {error.message}</p>}
      {!all && !error && <Loading />}
      {all && list.length === 0 && <p className="empty">No Pokémon match these filters.</p>}

      <div className="dex-list" style={{ height: virtual.getTotalSize(), position: 'relative' }}>
        {virtual.getVirtualItems().map((row) => {
          const items = list.slice(row.index * perRow, row.index * perRow + perRow);
          return (
            <div
              key={row.key}
              className={view === 'list' ? 'list-row' : 'grid-row'}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${row.start}px)` }}
            >
              {items.map((m) => (
                <MonCard
                  key={m.id}
                  mon={m}
                  art={spriteStyle === 'art'}
                  row={view === 'list'}
                  value={sortedBy(m, filters.sort)}
                  onPick={pickTeam != null ? () => pick(m.id) : undefined}
                />
              ))}
            </div>
          );
        })}
      </div>

      <button
        ref={fab}
        className="fab"
        aria-label={activeCount ? `Filter and sort, ${activeCount} active` : 'Filter and sort'}
        onClick={() => setSheetOpen(true)}
      >
        <Icon name="filter" size={24} />
        {activeCount > 0 && (
          <span className="badge" aria-hidden="true">
            {activeCount}
          </span>
        )}
      </button>

      {sheetOpen && (
        <FilterSheet
          value={filters}
          countFor={(f) => (all ? applyFilters(all, fuse, f).length : 0)}
          onApply={(f) => {
            setFilters(f);
            setSheetOpen(false);
            window.scrollTo({ top: 0 });
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

/** What the card shows for the current sort, e.g. "Attack 84" or "90.5 kg"; nothing for number and name. */
function sortedBy(m: IndexEntry, sort: SortKey): string | undefined {
  const v = sortValue(m, sort);
  if (v === undefined) return undefined;
  if (sort === 'height') return `${v} m`;
  if (sort === 'weight') return `${v} kg`;
  return `${SORT_LABELS[sort]} ${v}`;
}

/** A species in the grid (card) or in list view (`row`: sprite on the left, one line). */
function MonCard({ mon, art, row, value, onPick }: { mon: IndexEntry; art: boolean; row: boolean; value?: string; onPick?: () => void }) {
  const body = (
    <>
      <div className="no">
        {formatNo(mon.id)}
        {value && <span className="sort-val"> · {value}</span>}
      </div>
      <div className="name">{mon.name}</div>
      <div className="types">
        {mon.types.map((t) => (
          <TypeChip key={t} type={t} />
        ))}
      </div>
      <img
        src={art ? artworkUrl(mon.id) : spriteUrl(mon.id)}
        onError={(e) => {
          // Artwork that was never viewed isn't cached offline: show the precached sprite instead.
          const sprite = spriteUrl(mon.id);
          if (!e.currentTarget.src.endsWith(sprite)) e.currentTarget.src = sprite;
        }}
        alt=""
        loading="lazy"
        decoding="async"
        width={row ? 56 : 84}
        height={row ? 56 : 84}
      />
    </>
  );
  const style = { backgroundColor: typeTint(mon.types[0]) };
  const cls = ['mon-card', row && 'row', art && 'sprite-art'].filter(Boolean).join(' ');
  if (onPick)
    return (
      <button className={cls} style={{ ...style, border: 0, textAlign: 'left', font: 'inherit', width: '100%' }} onClick={onPick}>
        {body}
      </button>
    );
  return (
    <Link to={`/pokemon/${mon.id}`} className={cls} style={style}>
      {body}
    </Link>
  );
}
