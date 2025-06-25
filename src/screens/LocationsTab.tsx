import { loadGames, loadLearnsets, loadLocations, loadVersions, useLoad } from '../data/api';
import { knownGame, shownGame } from '../data/game';
import { gameColors } from '../data/gameColors';
import { encountersInGroup, locationsOfForm } from '../data/locations';
import { useGame } from '../data/settings';
import type { SpeciesDetail } from '../data/types';
import { GamePicker } from '../components/GamePicker';
import { Loading } from '../components/bits';

const loadAll = (id: number, formKey: string) => Promise.all([loadLocations(id), loadGames(), loadVersions(), loadLearnsets(id, formKey)]);

/** `mon` is the species as shown in form `formKey` (its name); the rows are that form's. */
export function LocationsTab({ mon, formKey }: { mon: SpeciesDetail; formKey: string }) {
  const { data, error } = useLoad(() => loadAll(mon.id, formKey), `${mon.id}|${formKey}`);
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

  const [all, allGames, versions, learnsets] = data;
  const locations = locationsOfForm(all, formKey);
  const groups = versions.filter((vg) => allGames.some((g) => g.group === vg.id && locations.games[g.id]));
  const chosen = knownGame(stored, versions);
  const group = shownGame(
    groups.map((g) => g.id),
    chosen,
  );
  if (group === undefined) {
    const label = versions.find((v) => v.id === chosen)?.label;
    return (
      <div className="section">
        <h2>Locations</h2>
        <GamePicker versions={versions} describedBy="loc-missing" />
        <p id="loc-missing" className="hint game-fallback">
          {chosen === 'latest'
            ? `${mon.name} has no wild encounters, gifts or in-game trades on record.`
            : !learnsets[chosen]
              ? `${mon.name} isn't in ${label}.`
              : allGames.some((g) => g.group === chosen)
                ? `${mon.name} has no encounters in ${label}.`
                : `Encounter data doesn't cover ${label}.`}
        </p>
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
    </div>
  );
}
