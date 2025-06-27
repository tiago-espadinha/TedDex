import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { loadAbilities, loadItemReference, loadMoves, useLoad } from '../../data/api';
import {
  abilityFilterParams,
  activeAbilityFilters,
  filterAbilities,
  readAbilityFilters,
} from '../../data/abilityFilter';
import { activeItemFilters, filterItems, itemFilterParams, readItemFilters } from '../../data/itemFilter';
import { activeMoveFilters, filterMoves, moveFilterParams, readMoveFilters } from '../../data/moveFilter';
import { typeTint } from '../../data/typeColors';
import { Icon } from '../../components/Icon/Icon';
import { CountBadge } from '../../components/CountBadge/CountBadge';
import { Loading } from '../../components/Loading/Loading';
import { SearchField } from '../../components/SearchField/SearchField';
import { MoveHead } from '../detail/MovesTab';
import { AbilityFilterSheet } from './AbilityFilterSheet';
import { ItemFilterSheet } from './ItemFilterSheet';
import { MoveFilterSheet } from './MoveFilterSheet';
import { kindOf, type ListKind, type Entry, type MoveEntry, type ItemEntry } from './guideEntries';
import { EntryBody } from './EntryBody';
import './SearchList.css';

async function loadEntries(kind: ListKind): Promise<Entry[]> {
  switch (kind) {
    case 'moves':
      return Object.entries(await loadMoves()).map(([id, move]) => ({ id, name: move.name, move }));
    case 'abilities':
      return Object.entries(await loadAbilities()).map(([id, a]) => ({ id, name: a.name, sub: a.effect, gen: a.gen }));
    case 'items':
      return Object.entries(await loadItemReference()).map(([id, item]) => ({ id, name: item.name, item }));
  }
}

export function SearchList() {
  const k = kindOf(useParams().kind);
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const { data, error } = useLoad(() => (k ? loadEntries(k.kind as ListKind) : Promise.resolve([])), k?.kind);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Moves, items and abilities also filter (moves sort too) in a sheet; their filters live in the URL next to the query.
  const moveFilters = useMemo(() => (k?.kind === 'moves' ? readMoveFilters(params) : undefined), [k?.kind, params]);
  const itemFilters = useMemo(() => (k?.kind === 'items' ? readItemFilters(params) : undefined), [k?.kind, params]);
  const abilityFilters = useMemo(
    () => (k?.kind === 'abilities' ? readAbilityFilters(params) : undefined),
    [k?.kind, params],
  );
  const moves = useMemo(() => (data ?? []).filter((e): e is MoveEntry => !!e.move), [data]);
  const items = useMemo(() => (data ?? []).filter((e): e is ItemEntry => !!e.item), [data]);
  // Only the generations that introduced an ability (III onwards) get a button in the sheet.
  const abilityGens = useMemo(() => [...new Set((data ?? []).map((e) => e.gen ?? 0))].filter(Boolean).sort(), [data]);
  const hasSheet = !!(moveFilters || itemFilters || abilityFilters);
  const shown = useMemo(() => {
    if (moveFilters) return filterMoves(moves, moveFilters);
    if (itemFilters) return filterItems(items, itemFilters);
    return filterAbilities(data ?? [], abilityFilters ?? { query, gens: [] });
  }, [data, moves, items, moveFilters, itemFilters, abilityFilters, query]);
  const setParam = (key: string, value: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const setQuery = (q: string) => setParam('q', q);

  if (!k) return <p className="empty">Page not found.</p>;
  const filtered = moveFilters
    ? activeMoveFilters(moveFilters)
    : itemFilters
      ? activeItemFilters(itemFilters)
      : abilityFilters
        ? activeAbilityFilters(abilityFilters)
        : 0;
  const applyFilters = (next: Record<string, string>) => {
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <header className="topbar">
        <Link to="/reference" className="icon-btn" aria-label="Back to Guide">
          <Icon name="back" />
        </Link>
        <div className="head-title">
          <h1>{k.title}</h1>
          {data && (
            <div className="sub">
              {filtered || query ? `${shown.length} of ${data.length}` : `${data.length} in the data`}
            </div>
          )}
        </div>
        <SearchField
          label={`Search ${k.title.toLowerCase()}`}
          placeholder="Search"
          value={query}
          onChange={setQuery}
          hints={k.kind === 'moves' || k.kind === 'items' ? k.kind : undefined}
        />
      </header>
      {error && (
        <p className="empty">
          Couldn't load {k.title.toLowerCase()}. {error.message}
        </p>
      )}
      {!data && !error && <Loading />}
      {data && !shown.length && (
        <p className="empty">
          {filtered
            ? `No ${k.title.toLowerCase()} match these filters.`
            : `No ${k.title.toLowerCase()} match “${query}”.`}
        </p>
      )}
      {shown.length > 0 && k.kind === 'moves' && <MoveHead />}
      {shown.length > 0 && (
        <ul className={`ref-list${hasSheet ? ' with-fab' : ''}${k.kind === 'moves' ? ' move-table' : ''}`}>
          {shown.map((e) => (
            <li key={e.id}>
              <Link
                to={`/reference/${k.kind}/${e.id}`}
                className={e.type ? 'move-row tinted' : 'move-row'}
                style={e.type && { backgroundColor: typeTint(e.type) }}
                data-morph={e.type ? undefined : `/reference/${k.kind}/${e.id}`}
              >
                <EntryBody entry={e} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hasSheet && (
        <>
          <button
            className="fab"
            aria-label={filtered ? `Filter and sort, ${filtered} active` : 'Filter and sort'}
            onClick={() => setSheetOpen(true)}
          >
            <Icon name="filter" size={24} />
            <CountBadge count={filtered} held={sheetOpen} />
          </button>
          {sheetOpen && moveFilters && (
            <MoveFilterSheet
              value={moveFilters}
              countFor={(f) => filterMoves(moves, f).length}
              onChange={(f) => applyFilters(moveFilterParams(f))}
              onClose={() => setSheetOpen(false)}
            />
          )}
          {sheetOpen && itemFilters && (
            <ItemFilterSheet
              value={itemFilters}
              countFor={(f) => filterItems(items, f).length}
              onChange={(f) => applyFilters(itemFilterParams(f))}
              onClose={() => setSheetOpen(false)}
            />
          )}
          {sheetOpen && abilityFilters && (
            <AbilityFilterSheet
              value={abilityFilters}
              gens={abilityGens}
              countFor={(f) => filterAbilities(data ?? [], f).length}
              onChange={(f) => applyFilters(abilityFilterParams(f))}
              onClose={() => setSheetOpen(false)}
            />
          )}
        </>
      )}
    </>
  );
}
