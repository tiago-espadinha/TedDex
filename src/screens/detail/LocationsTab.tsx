import { loadGames, loadLocations, loadVersions, useLoad } from '../../data/api';
import { knownGame, shownGame } from '../../data/game';
import { gameColors } from '../../data/gameColors';
import { encountersInGroup, locationsOfForm } from '../../data/locations';
import { useGame } from '../../data/settings';
import type { SpeciesDetail } from '../../data/types';
import { GamePicker, NotInGame } from '../../components/GamePicker/GamePicker';
import { Loading } from '../../components/Loading/Loading';
import './LocationsTab.css';

const loadAll = (id: number) => Promise.all([loadLocations(id), loadGames(), loadVersions()]);

/** `mon` is the species as shown in form `formKey` (its name); the rows are that form's. */
export function LocationsTab({ mon, formKey }: { mon: SpeciesDetail; formKey: string }) {
  const { data, error } = useLoad(() => loadAll(mon.id), `${mon.id}`);
  const [stored] = useGame();

  if (error) {
    return (
      <div className="section">
        <h2>Locations</h2>
        <p className="hint">Couldn't load locations. {error.message}</p>
      </div>
    );
  }
  if (!data) return <Loading minHeight={160} />;

  const [all, allGames, versions] = data;
  const locations = locationsOfForm(all, formKey);
  const groups = versions.filter((vg) => allGames.some((g) => g.group === vg.id && locations.games[g.id]));
  const chosen = knownGame(stored, versions);
  const group = shownGame(
    groups.map((g) => g.id),
    chosen,
  );
  if (group === undefined) {
    return (
      <div className="section">
        <h2>Locations</h2>
        <GamePicker versions={versions} describedBy="loc-missing" />
        {chosen === 'latest' ? (
          <p id="loc-missing" className="hint game-fallback">
            No way to get {mon.name} is on record.
          </p>
        ) : (
          <NotInGame id="loc-missing" name={mon.name} versions={versions} />
        )}
      </div>
    );
  }

  return (
    <div className="section">
      <h2>Locations</h2>
      <GamePicker versions={versions} shows={group} />

      <div className="move-group loc-group">
        <ul>
          {encountersInGroup(
            locations,
            allGames.filter((g) => g.group === group),
          ).map((e, i) => (
            <li key={i} className="move-row loc-row">
              <span className="body">
                <span className="name">
                  {e.area}
                  {e.versions.length > 0 && <span className="sr-only">, only in </span>}
                  {e.versions.map((v, j) => (
                    <span key={v} className="ver" style={{ backgroundColor: gameColors(v)[0] }}>
                      {j > 0 && <span className="sr-only">, </span>}
                      {v}
                    </span>
                  ))}
                </span>
                {e.method && (
                  <span className="meta">
                    <span>{e.method}</span>
                    <span>{e.levels}</span>
                    {e.chance && <span>{e.chance}</span>}
                  </span>
                )}
                {(e.form || e.note) && <span className="note">{[e.form, e.note].filter(Boolean).join(' · ')}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
