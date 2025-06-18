import { loadGames, loadLocations, loadVersions, useLoad } from '../data/api';
import { resolveGame } from '../data/game';
import { bandStyle, gameColors } from '../data/gameColors';
import { encountersInGroup, locationsOfForm } from '../data/locations';
import { useGame } from '../data/settings';
import type { SpeciesDetail } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading } from '../components/bits';

const loadAll = (id: number) => Promise.all([loadLocations(id), loadGames(), loadVersions()]);

/** `mon` is the species as shown in form `formKey` (its name); the rows are that form's. */
export function LocationsTab({ mon, formKey }: { mon: SpeciesDetail; formKey: string }) {
  const { data, error } = useLoad(() => loadAll(mon.id), mon.id);
  const [chosen, setChosen] = useGame();

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
  const shown = resolveGame(
    groups.map((g) => g.id),
    chosen,
  );
  if (!shown) {
    return (
      <div className="section">
        <h2>Locations</h2>
        <p className="hint">{mon.name} has no wild encounters, gifts or in-game trades on record.</p>
      </div>
    );
  }

  const label = (id: number) => versions.find((v) => v.id === id)?.label ?? 'the chosen game';
  const { missed } = shown;
  const fallback =
    missed !== undefined &&
    `${allGames.some((g) => g.group === missed) ? `${mon.name} has no encounters in ${label(missed)}` : `Encounter data doesn't cover ${label(missed)}`}. Showing ${label(shown.group)}.`;

  return (
    <div className="section">
      <h2>Locations</h2>
      <label className="game-select game-band" style={bandStyle(label(shown.group))}>
        <span className="k">Game</span>
        <select
          value={shown.group}
          onChange={(e) => setChosen(Number(e.target.value))}
          aria-describedby={fallback ? 'loc-fallback' : undefined}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <Icon name="next" size={18} />
      </label>
      {fallback && (
        <p id="loc-fallback" className="hint game-fallback">
          {fallback}
        </p>
      )}

      <div className="move-group loc-group">
        <ul>
          {encountersInGroup(
            locations,
            allGames.filter((g) => g.group === shown.group),
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
