import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { attackingTypes, loadIndex, loadItems, loadMoves, loadSpecies, loadTypes, spriteUrl, useLoad } from '../data/api';
import { defensiveCoverage, offensiveCoverage, type CoverageRow } from '../data/coverage';
import { TEAM_SIZE, createTeam, db, removeFromTeam, type TeamMember } from '../data/db';
import { cap, formatMultiplier, formatNo } from '../data/format';
import { memberView, type MemberView } from '../data/forms';
import { typeTint } from '../data/typeColors';
import type { ItemTable, MoveTable, TypeData } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip } from '../components/bits';

/**
 * Resolves members to how their slot looks, loading the species file of each member that has a form.
 * `view` is undefined until the grid index loads; until the species files load (`formsReady`), or if
 * any fails to load, members with a form show their default form.
 */
function useMemberViews(members: TeamMember[] = []) {
  const { data: index } = useLoad(loadIndex, 'index');
  const rows = useMemo(() => new Map((index ?? []).map((m) => [m.id, m])), [index]);
  const formed = [...new Set(members.filter((m) => m.formKey).map((m) => m.speciesId))].sort((a, b) => a - b);
  const { data: details, error } = useLoad(() => Promise.all(formed.map(loadSpecies)), formed.join());
  if (!index) return {};
  const species = new Map((details ?? []).map((d) => [d.id, d]));
  const view = (m: TeamMember) => memberView(m, rows.get(m.speciesId), species.get(m.speciesId));
  return { view, formsReady: !!details || !!error };
}

/** "Adamant · Life Orb · 3 moves", or a prompt when nothing is set yet. */
function memberSummary(m: TeamMember, items?: ItemTable) {
  const moves = m.moves?.length ?? 0;
  const parts = [m.nature, m.item && items?.[m.item], moves && `${moves} move${moves === 1 ? '' : 's'}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Set ability, nature, item and moves';
}

// ---------------- saved teams ----------------
export function TeamsScreen() {
  const teams = useLiveQuery(() => db.teams.orderBy('updatedAt').reverse().toArray(), []);
  const { view } = useMemberViews(teams?.flatMap((t) => t.members));
  const navigate = useNavigate();

  return (
    <>
      <header className="dex-head">
        <h1>Teams</h1>
      </header>
      <div className="list">
        {!teams && <Loading />}
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
              {t.members.map((m, i) => {
                const mon = view?.(m);
                return <img key={i} src={spriteUrl(mon?.mediaId ?? m.speciesId)} alt="" title={mon?.name} />;
              })}
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
  const team = useLiveQuery(() => db.teams.get(id).then((t) => t ?? null), [id]);
  const { view } = useMemberViews(team?.members);
  const { data: items } = useLoad(loadItems, 'items');
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (team === undefined) return <Loading />;
  if (!team) return <p className="empty">This team no longer exists.</p>;

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
      <div role="status">
        {confirmDelete && (
          <p className="hint" style={{ padding: '0 20px' }}>
            Tap the bin again to delete this team.
          </p>
        )}
      </div>

      <div className="list">
        {team.members.map((m, i) => {
          const mon = view?.(m);
          return (
            <div key={`${m.speciesId}-${i}`} className="slot" style={{ backgroundColor: mon ? typeTint(mon.types[0]) : 'var(--surface)' }}>
              <Link to={`/teams/${id}/member/${i}`}>
                <img src={spriteUrl(mon?.mediaId ?? m.speciesId)} alt="" width={64} height={64} />
                <div style={{ minWidth: 0 }}>
                  <div className="name">{mon?.name ?? formatNo(m.speciesId)}</div>
                  <div className="chips">{mon?.types.map((t) => <TypeChip key={t} type={t} />)}</div>
                  <div className="meta">{memberSummary(m, items)}</div>
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
type Mode = 'defensive' | 'offensive';

export function CoverageScreen() {
  const id = Number(useParams().id);
  const team = useLiveQuery(() => db.teams.get(id).then((t) => t ?? null), [id]);
  // Coverage waits for the forms' types; slots elsewhere show the default form meanwhile.
  const { view, formsReady } = useMemberViews(team?.members);
  const { data: typeData } = useLoad(loadTypes, 'types');
  const { data: moves } = useLoad(loadMoves, 'moves');
  const [mode, setMode] = useState<Mode>('defensive');

  const members = (team?.members ?? [])
    .map((m) => ({ member: m, mon: view?.(m) }))
    .filter((x): x is { member: TeamMember; mon: MemberView } => !!x.mon);
  if (team === undefined || !typeData || !moves || !view || !formsReady) return <Loading />;
  if (!team) return <p className="empty">This team no longer exists.</p>;

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
      {!members.length ? (
        <p className="empty">Add Pokémon to this team to see its coverage.</p>
      ) : (
        <>
          <div className="segmented cov-mode" role="radiogroup" aria-label="Coverage">
            {(['defensive', 'offensive'] as Mode[]).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
                {cap(m)}
              </button>
            ))}
          </div>
          {mode === 'defensive' ? (
            <DefensiveView mons={members.map((x) => x.mon)} typeData={typeData} />
          ) : (
            <OffensiveView members={members} typeData={typeData} moves={moves} />
          )}
        </>
      )}
    </>
  );
}

function DefensiveView({ mons, typeData }: { mons: MemberView[]; typeData: TypeData }) {
  const { rows, threat, stabHits } = defensiveCoverage(mons.map((m) => m.types), typeData);

  return (
    <>
      <div className="summary">
        <Tile label="BIGGEST THREAT" tone="weak">
          {threat.count ? `${cap(threat.type)} · ${threat.count} of ${mons.length} weak` : 'No shared weakness'}
        </Tile>
        <Tile label="STAB COVERAGE" tone="resist">
          {stabHits} of 18 types hit 2×
        </Tile>
      </div>
      <CoverageTable mons={mons} rows={rows} lead="ATTACK" countLabel="WEAK" cell={defensiveCell} alarm={(n) => n >= 3}>
        Based on each member's types. Switch to Offensive for coverage from chosen moves.
      </CoverageTable>
    </>
  );
}

function OffensiveView({
  members,
  typeData,
  moves,
}: {
  members: { member: TeamMember; mon: MemberView }[];
  typeData: TypeData;
  moves: MoveTable;
}) {
  const attacks = members.map(({ member }) => attackingTypes(member.moves, moves));
  if (attacks.every((a) => !a.length)) {
    return <p className="empty">No damaging moves yet. Give your team members moves to see what they hit.</p>;
  }
  const { rows, hits, walls } = offensiveCoverage(attacks, typeData);

  return (
    <>
      <div className="summary">
        <Tile label="MOVE COVERAGE" tone="resist">
          {hits} of 18 types hit 2×
        </Tile>
        <Tile label="WALLED BY" tone={walls.length ? 'weak' : 'resist'}>
          {walls.length ? walls.map(cap).join(', ') : 'Nothing'}
        </Tile>
      </div>
      <CoverageTable mons={members.map((x) => x.mon)} rows={rows} lead="DEFEND" countLabel="HIT 2×" cell={offensiveCell}>
        Each cell is the member's best damaging move against that type (type chart only; status moves don't
        count). – means no damaging moves.
      </CoverageTable>
    </>
  );
}

function Tile({ label, tone, children }: { label: string; tone: 'weak' | 'resist'; children: ReactNode }) {
  return (
    <div className="tile" style={{ background: `var(--${tone}-bg)` }}>
      <div className="k" style={{ color: `var(--${tone}-ink)` }}>
        {label}
      </div>
      <div className="v">{children}</div>
    </div>
  );
}

function CoverageTable({
  mons,
  rows,
  lead,
  countLabel,
  cell,
  alarm,
  children,
}: {
  mons: MemberView[];
  rows: CoverageRow[];
  lead: string;
  countLabel: string;
  cell: (m: number | null) => CSSProperties;
  alarm?: (count: number) => boolean;
  children: ReactNode;
}) {
  return (
    <div className="cov">
      <table>
        <thead>
          <tr>
            <th scope="col">{lead}</th>
            {mons.map((m, i) => (
              <th scope="col" key={i}>
                <img src={spriteUrl(m.mediaId)} alt="" />
                <span className="sr-only">{m.name}</span>
              </th>
            ))}
            <th scope="col" style={{ textAlign: 'right' }}>
              {countLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.type}>
              <td className="lead">
                <TypeChip type={r.type} />
              </td>
              {r.mults.map((m, i) => (
                <td key={i} style={cell(m)}>
                  {m === null ? '–' : formatMultiplier(m)}
                </td>
              ))}
              <td className="count" style={{ color: alarm?.(r.count) ? 'var(--weak-ink)' : r.count ? 'var(--ink)' : 'var(--muted)' }}>
                {r.count || '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">{children}</p>
    </div>
  );
}

/** Defending: taking more damage is bad (warm), less is good (green). */
function defensiveCell(m: number | null): CSSProperties {
  if (m === null) return { background: 'var(--neutral-cell)' };
  if (m > 1) return { background: 'var(--weak-bg)', color: 'var(--weak-ink)', filter: m >= 4 ? 'saturate(1.6)' : undefined };
  if (m === 0) return { background: 'var(--immune-bg)', color: 'var(--ink)' };
  if (m < 1) return { background: 'var(--resist-bg)', color: 'var(--resist-ink)' };
  return { background: 'var(--neutral-cell)' };
}

/** Attacking: the colours flip, so super effective is green and resisted is warm. */
function offensiveCell(m: number | null): CSSProperties {
  if (m === null) return { background: 'var(--neutral-cell)', color: 'var(--muted)' };
  if (m > 1) return { background: 'var(--resist-bg)', color: 'var(--resist-ink)' };
  if (m === 0) return { background: 'var(--immune-bg)', color: 'var(--ink)' };
  if (m < 1) return { background: 'var(--weak-bg)', color: 'var(--weak-ink)' };
  return { background: 'var(--neutral-cell)' };
}
