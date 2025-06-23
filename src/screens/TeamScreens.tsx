import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { attackingTypes, itemSpriteUrl, loadAbilityNames, loadIndex, loadItems, loadMoves, loadSpecies, loadTypes, useLoad } from '../data/api';
import { averageStats, defensiveCoverage, offensiveCoverage, type CoverageRow } from '../data/coverage';
import { NAME_LENGTH, NICKNAME_LENGTH, TEAM_SIZE, createTeam, db, memberTitle, removeFromTeam, renameTeam, type TeamMember } from '../data/db';
import { STAT_ROWS, cap, formatMultiplier, formatNo, formatScore, statColor } from '../data/format';
import { memberView, type MemberView } from '../data/forms';
import { memberAbility } from '../data/memberOptions';
import { teamMatches } from '../data/teamSearch';
import { NATURES } from '../data/natures';
import { STAT_COLOR, typeChip, typeTint } from '../data/typeColors';
import type { AbilityNameTable, ItemTable, MoveTable, TypeData } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, SearchField, Segmented, TypeChip, playAnim, useModalSheet, useSegmentSlide } from '../components/bits';
import { MonImg } from '../components/MonImg';
import { Fact, MonFacts, MonHead, MonMoves } from '../components/MonCard';
import { usePeek } from '../components/usePeek';

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

/**
 * What is set on a member under its head: ability in the left column and held item in the right (each column keeps
 * its place when the other is unset), then moves (the nature sits on the types row as a chip). Ability, item and moves open the quick view; the rest of the card is the editor link under them.
 */
function MemberDetails({
  member: m,
  name,
  items,
  moves,
  abilities,
  own,
}: {
  member: TeamMember;
  name: string;
  /** The form's own abilities, when known; a same-named one (As One) then opens the form's. */
  own?: MemberView['abilities'];
  items?: ItemTable;
  moves?: MoveTable;
  abilities?: AbilityNameTable;
}) {
  const peek = usePeek();
  const item = m.item !== undefined && items?.[m.item] ? { id: m.item, name: items[m.item].name } : undefined;
  // A form's own abilities come with its species file; until then a name lookup could pick another form's (As One).
  const abilityId = m.formKey && !own ? undefined : memberAbility(own ?? [], m.ability, abilities)?.id;
  const chosen = moves && m.moves?.length ? m.moves : undefined;
  return (
    <>
      {(m.ability || item) && (
        <MonFacts>
          {m.ability && (
            <Fact k="Ability">
              {abilityId ? (
                <button className="league-chip" onClick={() => peek({ kind: 'ability', id: abilityId })}>
                  {m.ability}
                </button>
              ) : (
                <span className="league-chip">{m.ability}</span>
              )}
            </Fact>
          )}
          {item && (
            <Fact k="Item" className="item">
              <button className="league-chip" onClick={() => peek({ kind: 'item', id: item.id })}>
                <img src={itemSpriteUrl(item.id)} alt="" width={24} height={24} loading="lazy" />
                {item.name}
              </button>
            </Fact>
          )}
        </MonFacts>
      )}
      {chosen && moves && <MonMoves name={name} moves={chosen} table={moves} onPeek={(id) => peek({ kind: 'move', id })} />}
    </>
  );
}

/** The nature on the types row, coloured like the stat it raises (as in the natures table); neutral ones are glass. */
function NatureChip({ name }: { name: string }) {
  const up = NATURES.find((n) => n.name === name)?.up;
  return (
    <span className="nature fact-chip" style={up && { backgroundColor: typeChip(STAT_COLOR[up]) }}>
      <span className="sr-only">Nature: </span>
      {name}
    </span>
  );
}

// ---------------- saved teams ----------------
export function TeamsScreen() {
  const teams = useLiveQuery(() => db.teams.orderBy('updatedAt').reverse().toArray(), []);
  const { view, formsReady } = useMemberViews(teams?.flatMap((t) => t.members));
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  // Member names come with the index and form species files; a search waits for them rather than missing.
  const shown = query && !formsReady ? undefined : teams?.filter((t) => teamMatches(t.name, t.members.flatMap((m) => [view?.(m)?.name, m.nickname]).filter((n): n is string => !!n), query));

  return (
    <>
      <header className="dex-head">
        <h1>Teams</h1>
        <SearchField label="Search teams" placeholder="Team or Pokémon" value={query} onChange={(q) => setParams(q ? { q } : {}, { replace: true })} />
      </header>
      <TeamTabs />
      <div className="list with-fab">
        {!shown && <Loading />}
        {teams?.length === 0 && <p className="empty">No teams yet. Tap + to create one.</p>}
        {teams?.length !== 0 && shown?.length === 0 && <p className="empty">No teams match “{query}”.</p>}
        {shown?.map((t) => (
          <Link key={t.id} to={`/teams/${t.id}`} className="team-row team-list-row">
            <span className="head">
              <Icon name="ball" size={16} />
              <span className="name">{t.name}</span>
            </span>
            {t.members.length > 0 && (
              <span className="minis" aria-hidden="true">
                {t.members.map((m, i) => {
                  const mon = view?.(m);
                  return (
                    <span key={i}>
                      <MonImg id={mon?.mediaId ?? m.speciesId} speciesId={m.speciesId} alt="" title={mon?.name} width={80} height={80} />
                    </span>
                  );
                })}
              </span>
            )}
          </Link>
        ))}
      </div>
      <button className="fab" aria-label="New team" onClick={async () => navigate(`/teams/${await createTeam()}`)}>
        <Icon name="plus" size={24} />
      </button>
    </>
  );
}

/** The Team tab's two lists. */
export function TeamTabs() {
  const ref = useSegmentSlide<HTMLElement>('team-tabs');
  return (
    <nav ref={ref} className="segmented team-tabs" aria-label="Lists">
      <NavLink to="/teams" end>
        Teams
      </NavLink>
      <NavLink to="/teams/pokedex" end>
        Pokédex
      </NavLink>
    </nav>
  );
}

/**
 * A sheet that renames a team or Pokédex (up to NAME_LENGTH characters, counted as code points), or sets a member's
 * nickname; `onSave` runs only when the name changed. `nickname` titles it "Nickname", takes up to NICKNAME_LENGTH
 * characters and lets it be emptied to clear it.
 */
export function RenameSheet({
  noun,
  name: current,
  nickname,
  onSave,
  onClose,
}: {
  noun: string;
  name: string;
  nickname?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const [name, setName] = useState(current);
  const headingId = useId();
  const limit = nickname ? NICKNAME_LENGTH : NAME_LENGTH;
  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <div className="handle" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() !== current) onSave(name);
            close();
          }}
        >
          <div className="sheet-head">
            <h2 id={headingId}>{nickname ? 'Nickname' : `Rename ${noun}`}</h2>
            <button type="button" className="text-btn" onClick={() => close()}>
              Cancel
            </button>
          </div>
          <label className="search rename-field">
            <span className="sr-only">{nickname ? `Nickname for ${noun}` : `${cap(noun)} name`}</span>
            <input
              data-autofocus
              value={name}
              placeholder={nickname ? noun : undefined}
              autoComplete="off"
              enterKeyHint="done"
              // A longer name is refused rather than cut, so the caret, emoji and IME input stay whole.
              onChange={(e) => [...e.target.value].length <= limit && setName(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p className="hint">
            Up to {limit} characters.{nickname && ' Leave it empty to clear it.'}
          </p>
          <button className="primary-btn" disabled={!nickname && !name.trim()}>
            Save
          </button>
        </form>
      </section>
    </>
  );
}

/** Asks before deleting `name`; `lost` says what goes with it. Cancel takes focus, so Enter alone can't delete. */
export function DeleteSheet({ name, lost, onDelete, onClose }: { name: string; lost: string; onDelete: () => void; onClose: () => void }) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const headingId = useId();
  const textId = useId();
  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet" role="alertdialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={textId}>
        <div className="handle" />
        <div className="sheet-head">
          <h2 id={headingId} className="confirm-title">
            Delete {name}?
          </h2>
        </div>
        <p id={textId} className="confirm-text">
          {lost} This can't be undone.
        </p>
        <div className="confirm-actions">
          <button className="primary-btn cancel" data-autofocus onClick={() => close()}>
            Cancel
          </button>
          <button className="primary-btn danger" onClick={() => close(onDelete)}>
            Delete
          </button>
        </div>
      </section>
    </>
  );
}

// ---------------- team editor ----------------
export function TeamEditor() {
  const id = Number(useParams().id);
  const team = useLiveQuery(() => db.teams.get(id).then((t) => t ?? null), [id]);
  const { view } = useMemberViews(team?.members);
  const { data: items } = useLoad(loadItems, 'items');
  const { data: moves } = useLoad(loadMoves, 'moves');
  const { data: abilities } = useLoad(loadAbilityNames, 'ability-names');
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  if (team === undefined) return <Loading />;
  if (!team) return <p className="empty">This team no longer exists.</p>;

  return (
    <>
      <header className="topbar">
        <Link to="/teams" className="icon-btn" aria-label="Back to teams">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1 className="team-name">
            <button aria-label={`Rename team ${team.name}`} onClick={() => setRenaming(true)}>
              <span>{team.name}</span>
            </button>
          </h1>
          <div className="sub">
            {team.members.length} of {TEAM_SIZE}
          </div>
        </div>
        <button
          className="icon-btn"
          aria-label="Delete team"
          aria-haspopup="dialog"
          onClick={(e) => {
            playAnim(e.currentTarget, 'bin');
            setDeleting(true);
          }}
        >
          <Icon name="trash" />
        </button>
      </header>

      <div className="list">
        {team.members.length > 0 && (
          <ul className="team-members">
            {team.members.map((m, i) => {
              const mon = view?.(m);
              const name = memberTitle(mon?.name ?? formatNo(m.speciesId), m.nickname);
              return (
                <li key={`${m.speciesId}-${i}`} className="team-mon" style={{ backgroundColor: mon ? typeTint(mon.types[0]) : 'var(--surface)' }}>
                  <Link to={`/teams/${id}/member/${i}`} className="evo-member">
                    <MonHead
                      spriteId={mon?.mediaId ?? m.speciesId}
                      speciesId={m.speciesId}
                      name={name}
                      types={mon?.types ?? []}
                      note={m.nature && <NatureChip name={m.nature} />}
                    />
                  </Link>
                  <MemberDetails
                    member={m}
                    name={name}
                    items={items}
                    moves={moves}
                    abilities={abilities}
                    own={mon?.abilities}
                  />
                  <button className="icon-btn" aria-label={`Remove ${name}`} onClick={() => removeFromTeam(id, i)}>
                    <Icon name="close" size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {team.members.length < TEAM_SIZE && (
          <Link to={`/?pick=${id}`} className="add-slot">
            <Icon name="plus" size={18} /> Add Pokémon
          </Link>
        )}
      </div>

      {team.members.length > 0 && (
        <div className="bottom-cta team-cta">
          <Link to={`/teams/${id}/coverage`} className="primary-btn">
            <Icon name="shield" size={20} /> Analyse team
          </Link>
        </div>
      )}
      {renaming && <RenameSheet noun="team" name={team.name} onSave={(name) => renameTeam(id, name)} onClose={() => setRenaming(false)} />}
      {deleting && (
        <DeleteSheet
          name={team.name}
          lost={team.members.length ? `Its ${team.members.length} Pokémon and their moves, items and nicknames go with it.` : 'It has no Pokémon yet.'}
          onDelete={() => db.teams.delete(id).then(() => navigate('/teams', { replace: true }), () => setDeleting(false))}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}

// ---------------- analysis ----------------
type Mode = 'defensive' | 'offensive' | 'stats';

/** A member as coverage sees it: its form's name, types and sprite, and its chosen moves. */
export interface CoverageMember {
  mon: MemberView;
  moves: number[] | undefined;
}

export function CoverageScreen() {
  const id = Number(useParams().id);
  const team = useLiveQuery(() => db.teams.get(id).then((t) => t ?? null), [id]);
  // The analysis waits for the forms' types and stats; slots elsewhere show the default form meanwhile.
  const { view, formsReady } = useMemberViews(team?.members);

  const members = (team?.members ?? [])
    .map((m) => ({ mon: view?.(m), moves: m.moves }))
    .filter((x): x is CoverageMember => !!x.mon);
  if (team === undefined || !view || !formsReady) return <Loading />;
  if (!team) return <p className="empty">This team no longer exists.</p>;

  return (
    <>
      <header className="topbar">
        <Link to={`/teams/${id}`} className="icon-btn" aria-label="Back to team">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>Analyse team</h1>
          <div className="sub">
            {team.name} · {members.length} member{members.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>
      {!members.length ? <p className="empty">Add Pokémon to this team to analyse it.</p> : <CoverageBody members={members} />}
    </>
  );
}

/** The Defensive / Offensive / Stats switch and its view, for saved teams and trainer teams. */
export function CoverageBody({ members }: { members: CoverageMember[] }) {
  const { data: typeData } = useLoad(loadTypes, 'types');
  const { data: moves } = useLoad(loadMoves, 'moves');
  const [mode, setMode] = useState<Mode>('defensive');
  if (!typeData || !moves) return <Loading />;
  return (
    <>
      <Segmented className="cov-mode" aria-label="Analysis">
        {(['defensive', 'offensive', 'stats'] as Mode[]).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
            {cap(m)}
          </button>
        ))}
      </Segmented>
      {mode === 'defensive' ? (
        <DefensiveView mons={members.map((x) => x.mon)} typeData={typeData} />
      ) : mode === 'offensive' ? (
        <OffensiveView members={members} typeData={typeData} moves={moves} />
      ) : (
        <StatsView mons={members.map((x) => x.mon)} />
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
          {threat.score < 0 ? `${cap(threat.type)} · score ${formatScore(threat.score)}` : 'No net weakness'}
        </Tile>
        <Tile label="STAB COVERAGE" tone="resist">
          {stabHits} of 18 types hit 2×
        </Tile>
      </div>
      <CoverageTable mons={mons} rows={rows} lead="ATTACK" cell={defensiveCell} last={SCORE_COLUMN} />
    </>
  );
}

function OffensiveView({
  members,
  typeData,
  moves,
}: {
  members: CoverageMember[];
  typeData: TypeData;
  moves: MoveTable;
}) {
  const attacks = members.map((x) => attackingTypes(x.moves, moves));
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
      <CoverageTable mons={members.map((x) => x.mon)} rows={rows} lead="DEFEND" cell={offensiveCell} last={HITS_COLUMN} />
    </>
  );
}

/** The members' mean base stats as Stats-tab bars. */
function StatsView({ mons }: { mons: MemberView[] }) {
  const { stats, total } = averageStats(mons);
  return (
    <div className="section">
      <h2>Average base stats</h2>
      {STAT_ROWS.map(([k, label]) => (
        <div className="stat-row" key={k}>
          <span className="label">{label}</span>
          <span className="val">{stats[k]}</span>
          <span className="track">
            <span className="fill" style={{ display: 'block', width: `${Math.min(100, (stats[k] / 180) * 100)}%`, background: statColor(stats[k]) }} />
          </span>
        </div>
      ))}
      <div className="stat-row total">
        <span className="label">Total</span>
        <span className="val">{total}</span>
        <span />
      </div>
    </div>
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

function CoverageTable<R extends CoverageRow>({
  mons,
  rows,
  lead,
  cell,
  last,
}: {
  mons: MemberView[];
  rows: R[];
  lead: string;
  cell: (m: number | null) => CSSProperties;
  last: LastColumn<R>;
}) {
  return (
    <div className="cov">
      <table>
        <thead>
          <tr>
            <th scope="col">{lead}</th>
            {mons.map((m, i) => (
              <th scope="col" key={i}>
                <MonImg id={m.mediaId} speciesId={m.speciesId} alt="" />
                <span className="sr-only">{m.name}</span>
              </th>
            ))}
            <th scope="col" style={{ textAlign: last.align }}>
              {last.label}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const [value, style] = last.cell(r);
            return (
              <tr key={r.type}>
                <td className="lead">
                  <TypeChip type={r.type} />
                </td>
                {r.mults.map((m, i) => (
                  <td key={i} style={cell(m)}>
                    {m === null ? '–' : formatMultiplier(m)}
                  </td>
                ))}
                <td className="count" style={{ ...style, textAlign: last.align }}>
                  {value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The table's last column: its header and each row's text and style. */
interface LastColumn<R> {
  label: string;
  align: 'right' | 'center';
  cell: (row: R) => [ReactNode, CSSProperties];
}

const SCORE_COLUMN: LastColumn<{ score: number }> = { label: 'SCORE', align: 'center', cell: scoreCell };
const HITS_COLUMN: LastColumn<CoverageRow> = { label: 'HIT 2×', align: 'right', cell: hitsCell };

/** A type's team score, green when the team holds it, warm when it doesn't. */
function scoreCell({ score }: { score: number }): [ReactNode, CSSProperties] {
  const style: CSSProperties =
    score > 0
      ? { background: 'var(--resist-bg)', color: 'var(--resist-ink)' }
      : score < 0
        ? { background: 'var(--weak-bg)', color: 'var(--weak-ink)' }
        : { color: 'var(--muted)' };
  return [formatScore(score), style];
}

function hitsCell({ count }: CoverageRow): [ReactNode, CSSProperties] {
  return [count || '–', { color: count ? 'var(--ink)' : 'var(--muted)' }];
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
