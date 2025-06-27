import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { loadPokedexes, loadVersions, useLoad } from '../../data/api';
import { db, type Pokedex } from '../../data/db';
import { caughtCount, dexCounts, gameDexes } from '../../data/pokedex';
import { teamMatches } from '../../data/teamSearch';
import type { Pokedexes } from '../../data/types';
import { Icon } from '../../components/Icon/Icon';
import { Loading } from '../../components/Loading/Loading';
import { SearchField } from '../../components/SearchField/SearchField';
import { TeamTabs } from '../teams/TeamTabs';
import { dexScope } from './dexScope';
import { DexArt } from './DexArt';

export function PokedexList() {
  const dexes = useLiveQuery(() => db.pokedexes.orderBy('updatedAt').reverse().toArray(), []);
  const { data: versions } = useLoad(loadVersions, 'versions');
  const { data: regional } = useLoad(loadPokedexes, 'pokedexes');
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  // Game labels come with versions.json; a search waits for them rather than missing.
  const shown =
    query && !versions
      ? undefined
      : dexes?.filter((d) => teamMatches(d.name, [dexScope(d, versions)?.label ?? ''], query));

  return (
    <>
      <header className="dex-head">
        <h1>Pokédex</h1>
        <SearchField
          label="Search Pokédexes"
          placeholder="Name or game"
          value={query}
          onChange={(q) => setParams(q ? { q } : {}, { replace: true })}
        />
      </header>
      <TeamTabs />
      <div className="list with-fab">
        {!shown && <Loading />}
        {shown && dexes?.length === 0 && (
          <p className="empty">No Pokédexes yet. Create one to track what you've seen and caught.</p>
        )}
        {dexes?.length !== 0 && shown?.length === 0 && <p className="empty">No Pokédexes match “{query}”.</p>}
        {shown?.map((d) => {
          const scope = dexScope(d, versions);
          const counter = caughtCounter(d, scope, regional);
          return (
            <Link
              key={d.id}
              to={`/teams/pokedex/${d.id}`}
              className="team-row dex-row"
              data-morph={`/teams/pokedex/${d.id}`}
              data-morph-card
            >
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
