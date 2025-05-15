import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { defensiveMultipliers, loadIndex, loadTypes, spriteUrl, useLoad } from '../data/api';
import { TEAM_SIZE, createTeam, db, removeFromTeam } from '../data/db';
import { cap, formatMultiplier, formatNo } from '../data/format';
import { TYPE_COLORS } from '../data/typeColors';
import type { IndexEntry, TypeName } from '../data/types';
import { Icon } from '../components/Icon';
import { TypeChip } from '../components/bits';

function useSpeciesMap() {
  const { data } = useLoad(loadIndex, 'index');
  return useMemo(() => new Map((data ?? []).map((m) => [m.id, m])), [data]);
}

// ---------------- saved teams ----------------
export function TeamsScreen() {
  const teams = useLiveQuery(() => db.teams.orderBy('updatedAt').reverse().toArray(), []);
  const species = useSpeciesMap();
  const navigate = useNavigate();

  return (
    <>
      <header className="dex-head">
        <h1>Teams</h1>
      </header>
      <div className="list">
        {teams?.length === 0 && <p className="empty">No teams yet. Create one, or tap + on any Pokémon.</p>}
        {teams?.map((t) => (
          <Link key={t.id} to={`/teams/${t.id}`} className="team-row">
            <div>
              <div className="name">{t.name}</div>
              <div className="meta">
                {t.members.length} of {TEAM_SIZE}
              </div>
            </div>
            <div className="minis" aria-hidden="true">
              {t.members.map((m, i) => (
                <img key={i} src={spriteUrl(m.speciesId)} alt="" title={species.get(m.speciesId)?.name} />
              ))}
            </div>
          </Link>
        ))}
        <button className="add-slot" onClick={async () => navigate(`/teams/${await createTeam()}`)}>
          <Icon name="plus" size={18} /> New team
        </button>
      </div>
    </>
  );
}

// ---------------- team editor ----------------
export function TeamEditor() {
  const id = Number(useParams().id);
  const team = useLiveQuery(() => db.teams.get(id), [id]);
  const species = useSpeciesMap();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (team === undefined) return null;
  if (team === null || !team) return <p className="empty">This team no longer exists.</p>;

  const empty = TEAM_SIZE - team.members.length;

  return (
    <>
      <header className="topbar">
        <Link to="/teams" className="icon-btn" aria-label="Back to teams">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <label className="sr-only" htmlFor="team-name">
            Team name
          </label>
          <input
            id="team-name"
            className="name-input"
            defaultValue={team.name}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== team.name) db.teams.update(id, { name, updatedAt: Date.now() });
            }}
          />
          <div className="sub">
            {team.members.length} of {TEAM_SIZE}
          </div>
        </div>
        <button
          className="icon-btn"
          aria-label={confirmDelete ? 'Confirm delete team' : 'Delete team'}
          style={confirmDelete ? { color: 'var(--danger)' } : undefined}
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            await db.teams.delete(id);
            navigate('/teams', { replace: true });
          }}
        >
          <Icon name="trash" />
        </button>
      </header>
      {confirmDelete && (
        <p className="hint" style={{ padding: '0 20px' }}>
          Tap the bin again to delete this team.
        </p>
      )}

      <div className="list">
        {team.members.map((m, i) => {
          const mon = species.get(m.speciesId);
          return (
            <div key={`${m.speciesId}-${i}`} className="slot" style={{ background: mon ? TYPE_COLORS[mon.types[0]].tint : 'var(--surface)' }}>
              <Link to={`/pokemon/${m.speciesId}`}>
                <img src={spriteUrl(m.speciesId)} alt="" width={64} height={64} />
                <div style={{ minWidth: 0 }}>
                  <div className="name">{mon?.name ?? formatNo(m.speciesId)}</div>
                  <div className="chips">{mon?.types.map((t) => <TypeChip key={t} type={t} />)}</div>
                  <div className="meta">Moveset editing: phase 2</div>
                </div>
              </Link>
              <button className="icon-btn" aria-label={`Remove ${mon?.name ?? 'member'}`} onClick={() => removeFromTeam(id, i)}>
                <Icon name="close" size={20} />
              </button>
            </div>
          );
        })}
        {empty > 0 && (
          <div className="add-grid">
            {Array.from({ length: Math.min(empty, 2) }, (_, i) => (
              <Link key={i} to={`/?pick=${id}`} className="add-slot">
                <Icon name="plus" size={18} /> Add Pokémon
              </Link>
            ))}
          </div>
        )}
      </div>

      {team.members.length > 0 && (
        <div className="bottom-cta">
          <Link to={`/teams/${id}/coverage`} className="primary-btn">
            <Icon name="shield" size={20} /> Analyse coverage
          </Link>
        </div>
      )}
    </>
  );
}

// ---------------- coverage ----------------
export function CoverageScreen() {
  const id = Number(useParams().id);
  const team = useLiveQuery(() => db.teams.get(id), [id]);
  const species = useSpeciesMap();
  const { data: typeData } = useLoad(loadTypes, 'types');

  const members = (team?.members ?? []).map((m) => species.get(m.speciesId)).filter((m): m is IndexEntry => !!m);
  if (!team || !typeData || !members.length) return null;

  const rows = typeData.types.map((atk) => {
    const mults = members.map((m) => defensiveMultipliers(m.types, typeData)[atk]);
    return { atk, mults, weak: mults.filter((x) => x > 1).length, resist: mults.filter((x) => x < 1).length };
  });
  // Most members weak to it; ties broken by fewer members resisting it.
  const threat = rows.reduce((a, b) => (b.weak > a.weak || (b.weak === a.weak && b.resist < a.resist) ? b : a));
  const hit = typeData.types.filter((def) =>
    members.some((m) => m.types.some((atk: TypeName) => (typeData.matrix[atk]?.[def] ?? 1) > 1)),
  ).length;

  return (
    <>
      <header className="topbar">
        <Link to={`/teams/${id}`} className="icon-btn" aria-label="Back to team">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>Coverage</h1>
          <div className="sub">
            {team.name} · {members.length} member{members.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <div className="summary">
        <div className="tile" style={{ background: 'var(--weak-bg)' }}>
          <div className="k" style={{ color: 'var(--weak-ink)' }}>
            BIGGEST THREAT
          </div>
          <div className="v">
            {threat.weak ? `${cap(threat.atk)} · ${threat.weak} of ${members.length} weak` : 'No shared weakness'}
          </div>
        </div>
        <div className="tile" style={{ background: 'var(--resist-bg)' }}>
          <div className="k" style={{ color: 'var(--resist-ink)' }}>
            STAB COVERAGE
          </div>
          <div className="v">{hit} of 18 types hit 2×</div>
        </div>
      </div>

      <div className="cov">
        <table>
          <thead>
            <tr>
              <th scope="col">ATTACK</th>
              {members.map((m, i) => (
                <th scope="col" key={i}>
                  <img src={spriteUrl(m.id)} alt="" />
                  <span className="sr-only">{m.name}</span>
                </th>
              ))}
              <th scope="col" style={{ textAlign: 'right' }}>
                WEAK
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.atk}>
                <td className="lead">
                  <TypeChip type={r.atk} />
                </td>
                {r.mults.map((m, i) => (
                  <td key={i} style={cellStyle(m)}>
                    {formatMultiplier(m)}
                  </td>
                ))}
                <td className="count" style={{ color: r.weak >= 3 ? 'var(--weak-ink)' : r.weak ? 'var(--ink)' : 'var(--muted)' }}>
                  {r.weak || '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Based on each member's types. Move-based offensive coverage arrives with movesets in phase 2.</p>
      </div>
    </>
  );
}

function cellStyle(m: number): CSSProperties {
  if (m > 1) return { background: 'var(--weak-bg)', color: 'var(--weak-ink)', filter: m >= 4 ? 'saturate(1.6)' : undefined };
  if (m === 0) return { background: 'var(--immune-bg)', color: 'var(--ink)' };
  if (m < 1) return { background: 'var(--resist-bg)', color: 'var(--resist-ink)' };
  return { background: 'var(--neutral-cell)' };
}
