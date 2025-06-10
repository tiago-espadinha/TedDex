import { useLiveQuery } from 'dexie-react-hooks';
import { memo, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { dexSpriteUrl, loadIndex, loadPokedexes, loadVersions, spriteUrl, useLoad } from '../data/api';
import { createPokedex, cycleDexState, db, renamePokedex, setPokedexGame, type Pokedex } from '../data/db';
import { formatNo } from '../data/format';
import { DEX_STATE_LABELS, caughtCount, dexCounts, gameDexes, lastSpecies, nextState, type DexState } from '../data/pokedex';
import { teamMatches } from '../data/teamSearch';
import type { Pokedexes, VersionGroup } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, SearchField } from '../components/bits';
import { RenameSheet, TeamTabs } from './TeamScreens';

/**
 * The game's label and how many species the Pokédex lists; undefined until versions.json loads.
 * A game the data no longer has lists every species.
 */
function dexScope(dex: Pokedex, versions?: VersionGroup[]) {
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
            <Link key={d.id} to={`/teams/pokedex/${d.id}`} className="team-row dex-row">
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
 * What a list row counts: caught of the game's first regional dex, or of the national dex for any game (or a game
 * the data no longer has); undefined until the data loads.
 */
function caughtCounter(dex: Pokedex, scope: ReturnType<typeof dexScope>, regional?: Pokedexes) {
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
/** The national dex, then every game with its regional dex sizes; a pick creates the Pokédex and opens it. */
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
          {versions.map((v) => {
            const dexes = gameDexes(regional, v.id);
            return (
              <li key={v.id}>
                <button
                  className="team-row dex-row"
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
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);

  if (dex === undefined) return <Loading />;
  if (!dex) return <p className="empty">This Pokédex no longer exists.</p>;
  const scope = dexScope(dex, versions);

  return (
    <>
      <header className="topbar">
        <Link to="/teams/pokedex" className="icon-btn" aria-label="Back to Pokédex">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1 className="team-name">{dex.name}</h1>
          {scope && (
            <div className="sub">
              {scope.label} · {scope.last} Pokémon
            </div>
          )}
        </div>
        <button className="icon-btn" aria-label="Rename Pokédex" onClick={() => setRenaming(true)}>
          <Icon name="pencil" />
        </button>
        <button
          className="icon-btn"
          aria-label={confirmDelete ? 'Confirm delete Pokédex' : 'Delete Pokédex'}
          style={confirmDelete ? { color: 'var(--danger)' } : undefined}
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            await db.pokedexes.delete(id);
            navigate('/teams/pokedex', { replace: true });
          }}
        >
          <Icon name="trash" />
        </button>
      </header>
      <div role="status">
        {confirmDelete && (
          <p className="hint" style={{ padding: '0 20px' }}>
            Tap the bin again to delete this Pokédex.
          </p>
        )}
      </div>

      <div className="list">
        {versions && (
          <label className="game-select team-game">
            <span className="k">Game</span>
            <select value={dex.game ?? ''} onChange={(e) => setPokedexGame(id, e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">National</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <Icon name="next" size={18} />
          </label>
        )}
        {scope && <DexCounts states={dex.states} last={scope.last} />}
      </div>
      {scope ? <DexGrid dexId={id} states={dex.states} last={scope.last} /> : <Loading />}
      {renaming && <RenameSheet noun="Pokédex" name={dex.name} onSave={(name) => renamePokedex(id, name)} onClose={() => setRenaming(false)} />}
    </>
  );
}

function DexCounts({ states, last }: { states: Pokedex['states']; last: number }) {
  const counts = dexCounts(states, last);
  return (
    <div className="dex-counts">
      <div className="dex-count">
        <b>{counts.seen}</b> <Icon name="eye" size={14} /> Seen
      </div>
      <div className="dex-count">
        <b>{counts.caught}</b> <Icon name="ball" size={14} /> Caught
      </div>
      <div className="dex-count">
        <b>{counts.shiny}</b> <Icon name="star" size={14} /> Shiny
      </div>
    </div>
  );
}

/** Species 1 to `last`; a tap moves one to its next state. */
function DexGrid({ dexId, states, last }: { dexId: number; states: Pokedex['states']; last: number }) {
  const { data: index } = useLoad(loadIndex, 'index');
  const names = useMemo(() => new Map((index ?? []).map((m) => [m.id, m.name])), [index]);
  const cycle = useCallback((speciesId: number) => cycleDexState(dexId, speciesId), [dexId]);
  if (!index) return <Loading />;
  return (
    <ul className="dex-grid" aria-label="Pokémon, tap to change state">
      {Array.from({ length: last }, (_, i) => (
        <DexCell key={i + 1} id={i + 1} name={names.get(i + 1) ?? formatNo(i + 1)} state={states[i + 1] ?? 0} onTap={cycle} />
      ))}
    </ul>
  );
}

const DexCell = memo(function DexCell({ id, name, state, onTap }: { id: number; name: string; state: DexState; onTap: (id: number) => void }) {
  return (
    <li>
      <button
        className={`dex-cell s${state}`}
        aria-label={`${name}, ${DEX_STATE_LABELS[state].toLowerCase()}. Tap for ${DEX_STATE_LABELS[nextState(state)].toLowerCase()}`}
        onClick={() => onTap(id)}
      >
        <img src={spriteUrl(id)} alt="" loading="lazy" width={56} height={56} />
        <span className="no">{formatNo(id)}</span>
        {state >= 2 && (
          <span className="badge">
            <Icon name={state === 3 ? 'star' : 'ball'} size={16} />
          </span>
        )}
      </button>
    </li>
  );
});
