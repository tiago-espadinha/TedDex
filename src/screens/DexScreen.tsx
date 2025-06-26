import Fuse from 'fuse.js';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadIndex, loadedIndex, useLoad } from '../data/api';
import { formatNo } from '../data/format';
import { SLOTS, comparePath, parseCompare, type SlotName } from '../data/compare';
import { addToTeam, db } from '../data/db';
import {
  DEFAULT_FILTERS,
  SORT_LABELS,
  detailPath,
  isPicking,
  saveOrder,
  useDexFilters,
  type DexFilters,
  type SortKey,
} from '../data/dexState';
import { typeTint } from '../data/typeColors';
import { FUSE_OPTIONS, applyFilters, dexRows, sortValue, type DexRow } from '../data/filter';
import { Icon } from '../components/Icon';
import { CountBadge, Loading, MonName, SearchField, TypeChip, showNav, useToast } from '../components/bits';
import { MonImg } from '../components/MonImg';
import { FilterSheet } from './FilterSheet';
import { useDexForms, useDexView, useSpriteStyle } from '../data/settings';
import { useFavourites } from '../data/favourites';

const ROW_H = 118; // card 108 + gap 10
const LIST_ROW_H = 108; // row 100 + gap 8

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

/** The Dex tab's spot. In memory, so a reload or relaunch starts at the top. */
let dexScrollY = 0;

/**
 * Restores the spot once the list has its height and saves it on leaving. Rendered before the rest of the screen:
 * its effect then runs before the pinned search reads the scroll, and its cleanup before the list goes.
 */
function KeepDexScroll() {
  useLayoutEffect(() => {
    window.scrollTo({ top: dexScrollY });
    showNav();
    return () => {
      dexScrollY = window.scrollY;
    };
  }, []);
  return null;
}

export function DexScreen() {
  // Data already loaded is there in the first commit, so coming back draws the list at its spot with no empty frame.
  const { data: all, error } = useLoad(loadIndex, 'index', loadedIndex);
  const favourites = useFavourites();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [params] = useSearchParams();
  const picking = isPicking(params);
  const pickTeam = picking && params.get('pick') ? Number(params.get('pick')) : null;
  const compareSlot = SLOTS.find((s) => s === params.get('compare'));
  // Pick mode is its own search: it starts empty each time and leaves the Dex tab's filters alone.
  const dexFilters = useDexFilters();
  const pickFilters = useState<DexFilters>(DEFAULT_FILTERS);
  const [filters, setFilters] = picking ? pickFilters : dexFilters;
  const teamName = useLiveQuery(
    () => (pickTeam != null ? db.teams.get(pickTeam).then((t) => t?.name) : undefined),
    [pickTeam],
  );
  const navigate = useNavigate();
  const backToCompare = (slot?: SlotName, id?: number, form?: string) =>
    navigate(comparePath({ ...parseCompare(params), ...(slot && id ? { [slot]: { id, form } } : {}) }), {
      replace: true,
    });
  // Back goes to the screen that opened pick mode: Compare, which it replaced, or the team (afresh on a direct link).
  const back = () => {
    if (compareSlot) backToCompare();
    else if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(`/teams/${pickTeam}`, { replace: true });
  };
  const toast = useToast();
  const cols = useColumns();
  const [spriteStyle] = useSpriteStyle();
  const [view, setView] = useDexView();
  const [formKinds] = useDexForms();
  const perRow = view === 'list' ? 1 : cols;

  const rows = useMemo(() => (all ? dexRows(all, formKinds) : null), [all, formKinds]);
  const fuse = useMemo(() => (rows ? new Fuse(rows, FUSE_OPTIONS) : null), [rows]);
  const list = useMemo(
    () => (rows ? applyFilters(rows, fuse, filters, favourites) : []),
    [rows, fuse, filters, favourites],
  );
  useEffect(() => {
    if (!picking) saveOrder(list.map((m) => detailPath(m.id, m.form?.key)));
  }, [list, picking]);

  const lines = Math.ceil(list.length / perRow);
  const rowHeight = view === 'list' ? LIST_ROW_H : ROW_H;
  // The virtualizer scrolls the window to this on mount; left to default, it would take the previous screen's scroll.
  const virtual = useWindowVirtualizer({
    count: lines,
    estimateSize: () => rowHeight,
    overscan: 4,
    initialOffset: picking ? 0 : dexScrollY,
  });
  // A list that shrank while away can land short of the spot with no scroll event, leaving the virtualizer past its rows.
  useLayoutEffect(() => {
    if (virtual.scrollOffset !== window.scrollY) window.dispatchEvent(new Event('scroll'));
  }, [virtual]);
  // Row heights differ between the views: measure again when switching.
  useEffect(() => virtual.measure(), [virtual, rowHeight]);

  const activeCount =
    filters.gens.length + filters.types.length + (filters.category ? 1 : 0) + (filters.sort !== 'number' ? 1 : 0);

  async function pick(id: number, formKey?: string) {
    if (pickTeam == null) return;
    const ok = await addToTeam(pickTeam, id, formKey);
    const team = await db.teams.get(pickTeam);
    if (!ok) toast({ text: 'That team is already full' });
    navigate(`/teams/${pickTeam}`, { replace: true });
    if (ok && team) toast({ text: `Added to ${team.name}` });
  }

  const search = (
    <SearchField
      label="Search Pokémon"
      placeholder="Name or number"
      value={filters.query}
      onChange={(query) => {
        setFilters({ ...filters, query });
        window.scrollTo({ top: 0 });
      }}
      hints="dex"
      trailing={
        <button
          className="icon-btn sm view-toggle"
          aria-label="List view"
          aria-pressed={view === 'list'}
          onClick={() => setView(view === 'list' ? 'grid' : 'list')}
        >
          <Icon name="view" size={20} />
        </button>
      }
    />
  );

  // A list that depends on the favourites (the category, or the word in a search) has its height only once they load.
  const hasHeight = rows && favourites;

  return (
    <>
      {!picking && hasHeight && <KeepDexScroll />}
      {picking ? (
        <header className="topbar dex-top">
          <button className="icon-btn" aria-label="Back" onClick={back}>
            <Icon name="back" />
          </button>
          <div className="grow">
            <h1 className="team-name">{compareSlot ? 'Comparator' : 'Add Pokémon'}</h1>
            <div className="sub">
              {compareSlot ? (compareSlot === 'a' ? 'First Pokémon' : 'Second Pokémon') : teamName}
            </div>
          </div>
        </header>
      ) : (
        <header className="dex-head">
          <h1>Dex</h1>
          {search}
        </header>
      )}
      {picking && <div className="dex-search">{search}</div>}

      {error && <p className="empty">Couldn't load the dex data. {error.message}</p>}
      {!rows && !error && <Loading />}
      {rows && list.length === 0 && (
        <p className="empty">
          {filters.category === 'favourite' && !favourites?.size
            ? 'No favourites yet. Tap the heart on a Pokémon to add it.'
            : 'No Pokémon match these filters.'}
        </p>
      )}

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
                  key={detailPath(m.id, m.form?.key)}
                  mon={m}
                  art={spriteStyle === 'art'}
                  row={view === 'list'}
                  value={sortedBy(m, filters.sort)}
                  onPick={
                    compareSlot
                      ? () => backToCompare(compareSlot, m.id, m.form?.key)
                      : pickTeam != null
                        ? () => pick(m.id, m.form?.key)
                        : undefined
                  }
                />
              ))}
            </div>
          );
        })}
      </div>

      <button
        className="fab"
        aria-label={activeCount ? `Filter and sort, ${activeCount} active` : 'Filter and sort'}
        onClick={() => setSheetOpen(true)}
      >
        <Icon name="filter" size={24} />
        <CountBadge count={activeCount} held={sheetOpen} />
      </button>

      {sheetOpen && (
        <FilterSheet
          value={filters}
          countFor={(f) => (rows ? applyFilters(rows, fuse, f, favourites).length : 0)}
          onChange={(f) => {
            setFilters(f);
            window.scrollTo({ top: 0 });
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

/** Short labels for the stat sorts on a card; screen readers get the full name from `SORT_LABELS`. */
const SORT_SHORT: Partial<Record<SortKey, string>> = {
  total: 'BST',
  hp: 'HP',
  atk: 'ATT',
  def: 'DEF',
  spa: 'S.ATT',
  spd: 'S.DEF',
  spe: 'SPD',
};

/** What the card shows for the current sort, e.g. "ATT 84", or the weight icon and "90.5 kg"; nothing for number and name. */
function sortedBy(m: DexRow, sort: SortKey): ReactNode {
  const v = sortValue(m, sort);
  if (v === undefined) return undefined;
  const measure = sort === 'height' || sort === 'weight';
  return (
    <>
      <span className="sr-only">{SORT_LABELS[sort]} </span>
      {measure ? <Icon name={sort} size={14} /> : <span aria-hidden="true">{SORT_SHORT[sort]} </span>}
      {v}
      {sort === 'height' ? ' m' : sort === 'weight' ? ' kg' : ''}
    </>
  );
}

/** A species or form in the grid (card) or in list view (`row`: sprite on the left, number over name). */
function MonCard({
  mon,
  art,
  row,
  value,
  onPick,
}: {
  mon: DexRow;
  art: boolean;
  row: boolean;
  value?: ReactNode;
  onPick?: () => void;
}) {
  const mediaId = mon.form?.pokemonId ?? mon.id;
  const body = (
    <>
      <div className="no">
        {formatNo(mon.id)}
        {value && <span className="sort-val"> · {value}</span>}
      </div>
      <div className="name">
        <MonName name={mon.form?.name ?? mon.name} />
      </div>
      <div className="types">
        {mon.types.map((t) => (
          <TypeChip key={t} type={t} />
        ))}
      </div>
      <MonImg
        id={mediaId}
        speciesId={mon.id}
        alt=""
        loading="lazy"
        decoding="async"
        width={row && !art ? 96 : row ? 80 : 84}
        height={row && !art ? 96 : row ? 80 : 84}
      />
    </>
  );
  const tint = typeTint(mon.types[0]);
  const style = { backgroundColor: tint, '--card-tint': tint } as CSSProperties;
  const cls = ['mon-card', row && 'row', art && 'sprite-art'].filter(Boolean).join(' ');
  if (onPick)
    return (
      <button
        className={cls}
        style={{ ...style, border: 0, textAlign: 'left', font: 'inherit', width: '100%' }}
        onClick={onPick}
      >
        {body}
      </button>
    );
  return (
    <Link to={detailPath(mon.id, mon.form?.key)} className={cls} style={style}>
      {body}
    </Link>
  );
}
