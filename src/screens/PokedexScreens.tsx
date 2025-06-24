import { useLiveQuery } from 'dexie-react-hooks';
import { memo, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { dexSpriteUrl, loadIndex, loadPokedexes, loadVersions, useLoad } from '../data/api';
import { createPokedex, cycleDexState, db, renamePokedex, type Pokedex } from '../data/db';
import { formatNo } from '../data/format';
import { bandStyle } from '../data/gameColors';
import {
  DEX_STATE_LABELS,
  activeDexFilters,
  caughtCount,
  customView,
  dexCounts,
  dexFilterParams,
  dexViews,
  filterDexCells,
  gameDexes,
  lastSpecies,
  nextState,
  readDexFilters,
  type DexCell,
  type DexFilters,
  type DexState,
} from '../data/pokedex';
import { teamMatches } from '../data/teamSearch';
import type { IndexEntry, Pokedexes, VersionGroup } from '../data/types';
import { Icon } from '../components/Icon';
import { CountBadge, Loading, MonName, SearchField, Segmented, playAnim } from '../components/bits';
import { MonImg } from '../components/MonImg';
import { PokedexFilterSheet } from './PokedexFilterSheet';
import { DeleteSheet, RenameSheet, TeamTabs } from './TeamScreens';

/**
 * The game's label and how many species the Pokédex lists; undefined until versions.json loads.
 * A game the data no longer has lists every species; a custom Pokédex lists its own.
 */
function dexScope(dex: Pokedex, versions?: VersionGroup[]) {
  if (dex.species) return { label: 'Custom', last: lastSpecies(), known: false };
  if (dex.game === undefined) return { label: 'National', last: lastSpecies(), known: false };
  if (!versions) return undefined;
  const version = versions.find((v) => v.id === dex.game);
  return version ? { label: version.label, last: lastSpecies(version.gen), known: true } : { label: 'Unknown game', last: lastSpecies(), known: false };
}

// ---------------- saved Pokédexes ----------------
export function PokedexList() {
  const dexes = useLiveQuery(() => db.pokedexes.orderBy('updatedAt').reverse().toArray(), []);
  const { data: versions } = useLoad(loadVersions, 'versions');
  const { data: regional } = useLoad(loadPokedexes, 'pokedexes');
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  // Game labels come with versions.json; a search waits for them rather than missing.
  const shown = query && !versions ? undefined : dexes?.filter((d) => teamMatches(d.name, [dexScope(d, versions)?.label ?? ''], query));

  return (
    <>
      <header className="dex-head">
        <h1>Pokédex</h1>
        <SearchField label="Search Pokédexes" placeholder="Name or game" value={query} onChange={(q) => setParams(q ? { q } : {}, { replace: true })} />
      </header>
      <TeamTabs />
      <div className="list with-fab">
        {!shown && <Loading />}
        {shown && dexes?.length === 0 && <p className="empty">No Pokédexes yet. Create one to track what you've seen and caught.</p>}
        {dexes?.length !== 0 && shown?.length === 0 && <p className="empty">No Pokédexes match “{query}”.</p>}
        {shown?.map((d) => {
          const scope = dexScope(d, versions);
          const counter = caughtCounter(d, scope, regional);
          return (
            <Link key={d.id} to={`/teams/pokedex/${d.id}`} className="team-row dex-row" data-morph={`/teams/pokedex/${d.id}`} data-morph-card>
              <DexArt game={scope?.known ? d.game : undefined} />
              <span className="head">
                <span className="name">{d.name}</span>
                <span className="meta">{scope?.label}</span>
              </span>
              {counter && (
                <span className="caught">
                  <Icon name="ball" size={16} />
                  <span aria-hidden="true">
                    <b>{counter.caught}</b>/{counter.total}
                  </span>
                  <span className="sr-only">
                    {counter.caught} of {counter.total} caught
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <Link className="fab" to="/teams/pokedex/new" aria-label="New Pokédex">
        <Icon name="plus" size={24} />
      </Link>
    </>
  );
}

/**
 * What a list row counts: caught of the game's first regional dex, of the national dex for any game (or a game
 * the data no longer has), or of a custom Pokédex's species; undefined until the data loads.
 */
function caughtCounter(dex: Pokedex, scope: ReturnType<typeof dexScope>, regional?: Pokedexes) {
  if (dex.species) return { caught: caughtCount(dex.states, dex.species), total: dex.species.length };
  if (!scope) return undefined;
  const national = { caught: dexCounts(dex.states, scope.last).caught, total: scope.last };
  if (!scope.known) return national;
  if (!regional) return undefined;
  const species = gameDexes(regional, dex.game!)[0]?.species;
  return species ? { caught: caughtCount(dex.states, species), total: species.length } : national;
}

/** A game's Pokédex art; the national dex gets the Pokédex icon. */
function DexArt({ game }: { game?: number }) {
  return (
    <span className="dex-art" aria-hidden="true">
      {game !== undefined ? <img src={dexSpriteUrl(game)} alt="" width={80} height={80} /> : <Icon name="dex" size={40} />}
    </span>
  );
}

// ---------------- new Pokédex ----------------
/**
 * The national dex, custom, then every game with its regional dex sizes; a pick creates the Pokédex and opens it.
 * Custom opens the species picker in this screen's place, so the new Pokédex replaces it in turn.
 */
export function NewPokedex() {
  const { data: versions } = useLoad(loadVersions, 'versions');
  const { data: regional } = useLoad(loadPokedexes, 'pokedexes');
  const navigate = useNavigate();
  // A second tap while the first Pokédex is being saved would create another.
  const [busy, setBusy] = useState(false);
  const create = async (game?: number) => {
    setBusy(true);
    navigate(`/teams/pokedex/${await createPokedex(game)}`, { replace: true });
  };

  return (
    <>
      <header className="topbar">
        <Link to="/teams/pokedex" className="icon-btn" aria-label="Back to Pokédex">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>New Pokédex</h1>
          <div className="sub">Pick a game</div>
        </div>
      </header>
      {!versions || !regional ? (
        <Loading />
      ) : (
        <ul className="list dex-games">
          <li>
            <button className="team-row dex-row" disabled={busy} onClick={() => create()}>
              <DexArt />
              <span className="head">
                <span className="name">National</span>
                <span className="meta">{lastSpecies()} Pokémon, every game</span>
              </span>
            </button>
          </li>
          <li>
            <Link className="team-row dex-row" to="/teams/pokedex/new/custom" replace>
              <DexArt />
              <span className="head">
                <span className="name">Custom</span>
                <span className="meta">Pick any Pokémon</span>
              </span>
            </Link>
          </li>
          {versions.map((v) => {
            const dexes = gameDexes(regional, v.id);
            return (
              <li key={v.id}>
                <button
                  className="team-row dex-row game-band"
                  style={bandStyle(v.label)}
                  disabled={busy}
                  aria-label={`${v.label}: ${dexes.map((d) => `${d.name} ${d.species.length}`).join(', ')}`}
                  onClick={() => create(v.id)}
                >
                  <DexArt game={v.id} />
                  <span className="head">
                    <span className="name">{v.label}</span>
                    <span className="meta">{dexes.map((d) => d.species.length).join(' · ')}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ---------------- one Pokédex ----------------
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
  const views = dex.species ? [customView(dex.species)] : scope && regional ? dexViews(scope.known ? gameDexes(regional, dex.game!) : [], scope.last) : undefined;
  const view = views?.find((v) => v.key === params.get('dex')) ?? views?.[0];
  const caught = view && caughtCount(dex.states, view.cells.map((c) => c.id));
  const setView = (key: string) => setParams({ ...(key !== views![0].key && { dex: key }), ...dexFilterParams(filters) }, { replace: true });
  const setFilters = (f: DexFilters) => setParams({ ...(params.has('dex') && { dex: params.get('dex')! }), ...dexFilterParams(f) }, { replace: true });
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
      {!shown ? <Loading /> : <DexGrid dexId={id} states={dex.states} cells={shown} digits={view.key === 'national' || view.key === 'custom' ? 4 : 3} species={species} />}
      <button className="fab" aria-label={active ? `Filter, ${active} active` : 'Filter'} onClick={() => setSheetOpen(true)}>
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
      {renaming && <RenameSheet noun="Pokédex" name={dex.name} onSave={(name) => renamePokedex(id, name)} onClose={() => setRenaming(false)} />}
      {deleting && (
        <DeleteSheet
          name={dex.name}
          lost={`Its seen and caught records${dex.species ? ' and its Pokémon list' : ''} go with it.`}
          onDelete={() => db.pokedexes.delete(id).then(() => navigate('/teams/pokedex', { replace: true }), () => setDeleting(false))}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}

/** The cells shown, numbered with `digits` digits (3 in a regional dex, as in the games); a tap moves one to its next state. */
function DexGrid({
  dexId,
  states,
  cells,
  digits,
  species,
}: {
  dexId: number;
  states: Pokedex['states'];
  cells: DexCell[];
  digits: number;
  species: Map<number, IndexEntry>;
}) {
  const cycle = useCallback((speciesId: number) => cycleDexState(dexId, speciesId), [dexId]);
  if (!cells.length) return <p className="empty">No Pokémon match.</p>;
  return (
    <ul className="dex-grid" aria-label="Pokémon, tap to change state">
      {cells.map(({ id, no }) => (
        <DexCellButton key={id} id={id} no={formatNo(no, digits)} name={species.get(id)?.name ?? formatNo(id)} state={states[id] ?? 0} onTap={cycle} />
      ))}
    </ul>
  );
}

/** Not-seen cells show the number in the view, the others the name; shiny cells show the shiny image. */
const DexCellButton = memo(function DexCellButton({ id, no, name, state, onTap }: { id: number; no: string; name: string; state: DexState; onTap: (id: number) => void }) {
  return (
    <li>
      <button
        className={`dex-cell s${state}`}
        aria-label={`${state ? `${no} ${name}` : no}, ${DEX_STATE_LABELS[state].toLowerCase()}. Tap for ${DEX_STATE_LABELS[nextState(state)].toLowerCase()}`}
        onClick={(e) => {
          playAnim(e.currentTarget, 'cell');
          onTap(id);
        }}
      >
        <MonImg id={id} shiny={state === 3} alt="" loading="lazy" width={72} height={72} />
        <span className="no">{state ? <MonName name={name} /> : no}</span>
        {state >= 2 && (
          <span className="badge">
            <Icon name={state === 3 ? 'star' : 'ball'} size={16} />
          </span>
        )}
      </button>
    </li>
  );
});
