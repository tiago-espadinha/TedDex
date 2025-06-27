import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadIndex, loadPokedexes, loadVersions, useLoad } from '../../data/api';
import { db, renamePokedex, type Pokedex } from '../../data/db';
import {
  activeDexFilters,
  caughtCount,
  customView,
  dexFilterParams,
  dexViews,
  filterDexCells,
  gameDexes,
  readDexFilters,
  type DexFilters,
} from '../../data/pokedex';
import { Icon } from '../../components/Icon/Icon';
import { CountBadge } from '../../components/CountBadge/CountBadge';
import { Loading } from '../../components/Loading/Loading';
import { SearchField } from '../../components/SearchField/SearchField';
import { Segmented } from '../../components/Segmented/Segmented';
import { playAnim } from '../../components/playAnim';
import { PokedexFilterSheet } from './PokedexFilterSheet';
import { DeleteSheet } from '../teams/DeleteSheet';
import { RenameSheet } from '../teams/RenameSheet';
import { dexScope } from './dexScope';
import { DexGrid } from './DexGrid';

export function PokedexScreen() {
  const id = Number(useParams().id);
  const dex = useLiveQuery(() => db.pokedexes.get(id).then((d) => d ?? null), [id]);
  const { data: versions } = useLoad(loadVersions, 'versions');
  const { data: regional } = useLoad(loadPokedexes, 'pokedexes');
  const { data: index } = useLoad(loadIndex, 'index');
  const species = useMemo(() => new Map((index ?? []).map((m) => [m.id, m])), [index]);
  const [params, setParams] = useSearchParams();
  const filters = readDexFilters(params);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The state filter reads the states as they were when the view or filters last changed, so a tapped cell stays
  // put instead of leaving the grid under the finger.
  const filterKey = params.toString();
  const [snapshot, setSnapshot] = useState<{ key: string; states: Pokedex['states'] }>();
  if (dex && snapshot?.key !== filterKey) setSnapshot({ key: filterKey, states: dex.states });

  if (dex === undefined) return <Loading />;
  if (!dex) return <p className="empty">This Pokédex no longer exists.</p>;
  const scope = dexScope(dex, versions);
  const views = dex.species
    ? [customView(dex.species)]
    : scope && regional
      ? dexViews(scope.known ? gameDexes(regional, dex.game!) : [], scope.last)
      : undefined;
  const view = views?.find((v) => v.key === params.get('dex')) ?? views?.[0];
  const caught =
    view &&
    caughtCount(
      dex.states,
      view.cells.map((c) => c.id),
    );
  const setView = (key: string) =>
    setParams({ ...(key !== views![0].key && { dex: key }), ...dexFilterParams(filters) }, { replace: true });
  const setFilters = (f: DexFilters) =>
    setParams({ ...(params.has('dex') && { dex: params.get('dex')! }), ...dexFilterParams(f) }, { replace: true });
  const shown = view && index && filterDexCells(view.cells, snapshot?.states ?? dex.states, species, filters);
  const active = activeDexFilters(filters);

  return (
    <>
      <header className="topbar dex-top" data-morph={`/teams/pokedex/${id}`} data-morph-card>
        <Link to="/teams/pokedex" className="icon-btn" aria-label="Back to Pokédex">
          <Icon name="back" />
        </Link>
        <div className="grow dex-title">
          <h1 className="team-name">
            <button aria-label={`Rename Pokédex ${dex.name}`} onClick={() => setRenaming(true)}>
              <span>{dex.name}</span>
            </button>
          </h1>
          {scope && <div className="sub">{scope.label}</div>}
        </div>
        {view && caught !== undefined && (
          <span className="caught" role="status">
            <Icon name="ball" size={16} />
            <span aria-hidden="true">
              <b>{caught}</b>/{view.cells.length}
            </span>
            <span className="sr-only">
              {caught} of {view.cells.length} caught
            </span>
          </span>
        )}
        {dex.species && (
          <Link to={`/teams/pokedex/${id}/edit`} className="icon-btn" aria-label="Edit Pokémon list">
            <Icon name="pencil" />
          </Link>
        )}
        <button
          className="icon-btn"
          aria-label="Delete Pokédex"
          aria-haspopup="dialog"
          onClick={(e) => {
            playAnim(e.currentTarget, 'bin');
            setDeleting(true);
          }}
        >
          <Icon name="trash" />
        </button>
      </header>

      {views && views.length > 1 && (
        <div className="dex-switch">
          <Segmented aria-label="Pokédex">
            {views.map((v) => (
              <button key={v.key} role="radio" aria-checked={v === view} onClick={() => setView(v.key)}>
                {v.label}
              </button>
            ))}
          </Segmented>
        </div>
      )}
      <div className="dex-search">
        <SearchField
          label="Search Pokémon"
          placeholder="Name or number"
          value={filters.query}
          onChange={(query) => setFilters({ ...filters, query })}
        />
      </div>
      {!shown ? (
        <Loading />
      ) : (
        <DexGrid
          dexId={id}
          states={dex.states}
          cells={shown}
          digits={view.key === 'national' || view.key === 'custom' ? 4 : 3}
          species={species}
        />
      )}
      <button
        className="fab"
        aria-label={active ? `Filter, ${active} active` : 'Filter'}
        onClick={() => setSheetOpen(true)}
      >
        <Icon name="filter" size={24} />
        <CountBadge count={active} held={sheetOpen} />
      </button>
      {sheetOpen && view && (
        <PokedexFilterSheet
          value={filters}
          countFor={(f) => filterDexCells(view.cells, dex.states, species, f).length}
          onChange={setFilters}
          onClose={() => setSheetOpen(false)}
        />
      )}
      {renaming && (
        <RenameSheet
          noun="Pokédex"
          name={dex.name}
          onSave={(name) => renamePokedex(id, name)}
          onClose={() => setRenaming(false)}
        />
      )}
      {deleting && (
        <DeleteSheet
          name={dex.name}
          lost={`Its seen and caught records${dex.species ? ' and its Pokémon list' : ''} go with it.`}
          onDelete={() =>
            db.pokedexes.delete(id).then(
              () => navigate('/teams/pokedex', { replace: true }),
              () => setDeleting(false),
            )
          }
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}
