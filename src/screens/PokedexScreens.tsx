import { useLiveQuery } from 'dexie-react-hooks';
import { memo, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadIndex, loadVersions, spriteUrl, useLoad } from '../data/api';
import { createPokedex, cycleDexState, db, renamePokedex, setPokedexGame, type Pokedex } from '../data/db';
import { formatNo } from '../data/format';
import { teamGame } from '../data/game';
import { DEX_STATE_LABELS, dexCounts, lastSpecies, nextState, type DexState } from '../data/pokedex';
import { useGame } from '../data/settings';
import type { VersionGroup } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading } from '../components/bits';
import { RenameSheet, TeamTabs } from './TeamScreens';

/**
 * The game's label and how many species the Pokédex lists; undefined until versions.json loads.
 * A game the data no longer has lists every species.
 */
function dexScope(dex: Pokedex, versions?: VersionGroup[]) {
  if (dex.game === undefined) return { label: 'Any game', last: lastSpecies() };
  if (!versions) return undefined;
  const version = versions.find((v) => v.id === dex.game);
  return version ? { label: version.label, last: lastSpecies(version.gen) } : { label: 'Unknown game', last: lastSpecies() };
}

// ---------------- saved Pokédexes ----------------
export function PokedexList() {
  const dexes = useLiveQuery(() => db.pokedexes.orderBy('updatedAt').reverse().toArray(), []);
  const { data: versions } = useLoad(loadVersions, 'versions');
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState<Pokedex>();
  const [game] = useGame();

  return (
    <>
      <header className="dex-head">
        <h1>Pokédexes</h1>
      </header>
      <TeamTabs />
      <div className="list">
        {!dexes && <Loading />}
        {dexes?.length === 0 && <p className="empty">No Pokédexes yet. Create one to track what you've seen and caught.</p>}
        {dexes?.map((d) => {
          const scope = dexScope(d, versions);
          const counts = scope && dexCounts(d.states, scope.last);
          return (
            <div key={d.id} className="team-row team-entry">
              <Link to={`/teams/pokedex/${d.id}`}>
                <span className="name">{d.name}</span>
                <span className="meta">
                  {scope?.label}
                  {counts && ` · ${counts.caught} of ${counts.total} caught`}
                </span>
              </Link>
              <button className="icon-btn" aria-label={`Rename ${d.name}`} onClick={() => setRenaming(d)}>
                <Icon name="pencil" size={20} />
              </button>
            </div>
          );
        })}
        <button className="add-slot" onClick={async () => navigate(`/teams/pokedex/${await createPokedex(teamGame(game))}`)}>
          <Icon name="plus" size={18} /> New Pokédex
        </button>
      </div>
      {renaming && (
        <RenameSheet noun="Pokédex" name={renaming.name} onSave={(name) => renamePokedex(renaming.id, name)} onClose={() => setRenaming(undefined)} />
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
        <Link to="/teams/pokedex" className="icon-btn" aria-label="Back to Pokédexes">
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
              <option value="">Any game</option>
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
