import Fuse from 'fuse.js';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadIndex, loadVersions, useLoad } from '../data/api';
import { formatNo } from '../data/format';
import { SLOTS, comparePath, parseCompare, type SlotName } from '../data/compare';
import { addToTeam, db } from '../data/db';
import { DEFAULT_FILTERS, SORT_LABELS, detailPath, isPicking, saveOrder, useDexFilters, type DexFilters, type SortKey } from '../data/dexState';
import { typeTint } from '../data/typeColors';
import { FUSE_OPTIONS, applyFilters, dexRows, sortValue, type DexRow } from '../data/filter';
import { Icon } from '../components/Icon';
import { Loading, MonName, SearchField, TypeChip, useToast } from '../components/bits';
import { MonImg } from '../components/MonImg';
import { FilterSheet } from './FilterSheet';
import { useDexForms, useDexView, useGame, useSpriteStyle } from '../data/settings';
import { lastSpecies } from '../data/pokedex';
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

export function DexScreen() {
  const { data: all, error } = useLoad(loadIndex, 'index');
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
  const teamName = useLiveQuery(() => (pickTeam != null ? db.teams.get(pickTeam).then((t) => t?.name) : undefined), [pickTeam]);
  const navigate = useNavigate();
  const backToCompare = (slot?: SlotName, id?: number, form?: string) =>
    navigate(comparePath({ ...parseCompare(params), ...(slot && id ? { [slot]: { id, form } } : {}) }), { replace: true });
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
  // A chosen game limits the list to the species up to its generation, until the filter sheet's Game toggle lifts it (`liftedGame`).
  // Without the versions file the list shows unlimited rather than loading forever.
  const [game] = useGame();
  const { data: versions, error: versionsError } = useLoad(loadVersions, 'versions');
  const limit = game === 'latest' ? undefined : versions?.find((v) => v.id === game);
  const upTo = (f: DexFilters) => (limit && f.liftedGame !== limit.id ? lastSpecies(limit.gen) : undefined);
  const waiting = game !== 'latest' && !versions && !versionsError;

  const rows = useMemo(() => (all && !waiting ? dexRows(all, formKinds) : null), [all, waiting, formKinds]);
  const fuse = useMemo(() => (rows ? new Fuse(rows, FUSE_OPTIONS) : null), [rows]);
  const limitTo = upTo(filters);
  const list = useMemo(() => (rows ? applyFilters(rows, fuse, filters, limitTo, favourites) : []), [rows, fuse, filters, limitTo, favourites]);
  useEffect(() => {
    if (!picking) saveOrder(list.map((m) => detailPath(m.id, m.form?.key)));
  }, [list, picking]);

  const lines = Math.ceil(list.length / perRow);
  const rowHeight = view === 'list' ? LIST_ROW_H : ROW_H;
  const virtual = useWindowVirtualizer({ count: lines, estimateSize: () => rowHeight, overscan: 4 });
  // Row heights differ between the views: measure again when switching.
  useEffect(() => virtual.measure(), [virtual, rowHeight]);

  const activeCount = (limitTo ? 1 : 0) + filters.gens.length + filters.types.length + (filters.category ? 1 : 0) + (filters.sort !== 'number' ? 1 : 0);

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
  );

  return (
    <>
      {picking ? (
        <header className="topbar dex-top">
          <button className="icon-btn" aria-label="Back" onClick={back}>
            <Icon name="back" />
          </button>
          <div className="grow">
            <h1 className="team-name">{compareSlot ? 'Comparator' : 'Add Pokémon'}</h1>
            <div className="sub">{compareSlot ? (compareSlot === 'a' ? 'First Pokémon' : 'Second Pokémon') : teamName}</div>
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
          {filters.category === 'favourite' && !favourites?.size ? 'No favourites yet. Tap the heart on a Pokémon to add it.' : 'No Pokémon match these filters.'}
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
        {activeCount > 0 && (
          <span className="badge" aria-hidden="true">
            {activeCount}
          </span>
        )}
      </button>

      {sheetOpen && (
        <FilterSheet
          value={filters}
          game={limit}
          countFor={(f) => (rows ? applyFilters(rows, fuse, f, upTo(f), favourites).length : 0)}
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

/** Short labels for the stat sorts on a card; screen readers get the full name from `SORT_LABELS`. */
const SORT_SHORT: Partial<Record<SortKey, string>> = { total: 'BST', hp: 'HP', atk: 'ATT', def: 'DEF', spa: 'S.ATT', spd: 'S.DEF', spe: 'SPD' };

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
function MonCard({ mon, art, row, value, onPick }: { mon: DexRow; art: boolean; row: boolean; value?: ReactNode; onPick?: () => void }) {
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
  const style = { backgroundColor: typeTint(mon.types[0]) };
  const cls = ['mon-card', row && 'row', art && 'sprite-art'].filter(Boolean).join(' ');
  if (onPick)
    return (
      <button className={cls} style={{ ...style, border: 0, textAlign: 'left', font: 'inherit', width: '100%' }} onClick={onPick}>
        {body}
      </button>
    );
  return (
    <Link to={detailPath(mon.id, mon.form?.key)} className={cls} style={style}>
      {body}
    </Link>
  );
}
