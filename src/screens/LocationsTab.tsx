import { useState } from 'react';
import { loadGames, loadLocations, useLoad } from '../data/api';
import { encountersIn } from '../data/locations';
import type { SpeciesDetail } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading } from '../components/bits';

const loadAll = (id: number) => Promise.all([loadLocations(id), loadGames()]);

const COVERAGE = 'Encounter data covers Red, Blue and Yellow to Sword and Shield. Brilliant Diamond, Shining Pearl, Legends: Arceus and Scarlet and Violet are not included.';

export function LocationsTab({ mon }: { mon: SpeciesDetail }) {
  const { data, error } = useLoad(() => loadAll(mon.id), mon.id);
  const [pick, setPick] = useState<number>();

  if (error) {
    return (
      <div className="section">
        <p className="empty">Couldn't load locations. {error.message}</p>
      </div>
    );
  }
  if (!data) return <Loading minHeight={320} />;

  const [locations, allGames] = data;
  const games = allGames.filter((g) => locations.games[g.id]);
  if (!games.length) {
    return (
      <div className="section">
        <p className="empty">{mon.name} has no wild encounters, gifts or in-game trades on record.</p>
        <p className="hint">{COVERAGE}</p>
      </div>
    );
  }

  const game = pick ?? games[games.length - 1].id;

  return (
    <div className="section">
      <label className="game-select">
        <span className="k">Game</span>
        <select value={game} onChange={(e) => setPick(Number(e.target.value))}>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <Icon name="next" size={18} />
      </label>

      <div className="move-group">
        <ul>
          {encountersIn(locations, game).map((e, i) => (
            <li key={i} className="move-row loc-row">
              <span className="body">
                <span className="name">{e.area}</span>
                <span className="meta">
                  <span>{e.method}</span>
                  <span>{e.levels}</span>
                  {e.chance && <span>{e.chance}</span>}
                </span>
                {(e.form || e.note) && <span className="note">{[e.form, e.note].filter(Boolean).join(' · ')}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="hint">{COVERAGE}</p>
    </div>
  );
}
