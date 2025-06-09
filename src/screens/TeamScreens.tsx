import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  attackingTypes,
  itemSpriteUrl,
  loadAbilityNames,
  loadIndex,
  loadItems,
  loadLearnsets,
  loadMoves,
  loadSpecies,
  loadTypes,
  loadVersions,
  spriteUrl,
  useLoad,
} from '../data/api';
import { defensiveCoverage, offensiveCoverage, type CoverageRow } from '../data/coverage';
import { TEAM_SIZE, createTeam, db, removeFromTeam, renameTeam, setGodMode, setTeamGame, type Team, type TeamMember } from '../data/db';
import { cap, formatMultiplier, formatNo } from '../data/format';
import { applyForm, memberView, type MemberView } from '../data/forms';
import { teamGame } from '../data/game';
import { abilityInGame, formInGame, itemInGame, learnable, memberAbility } from '../data/memberOptions';
import { useGame } from '../data/settings';
import { typeTint } from '../data/typeColors';
import type { AbilityNameTable, ItemTable, MoveTable, TypeData } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip, useModalSheet, useToast } from '../components/bits';
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
 * What isn't legal in the team's `game`, per member: whether its species and form are in that game, which moves it
 * can't learn there, and whether its ability and held item are missing there. Undefined for any game, and until the
 * data loads.
 */
function useLegality(members: TeamMember[] = [], game?: number, items?: ItemTable) {
  const ids = game === undefined ? [] : [...new Set(members.map((m) => m.speciesId))].sort((a, b) => a - b);
  const { data } = useLoad(
    () =>
      ids.length
        ? Promise.all([Promise.all(ids.map(loadLearnsets)), Promise.all(ids.map(loadSpecies)), loadAbilityNames(), loadVersions()])
        : Promise.resolve(undefined),
    ids.join(),
  );
  if (game === undefined || !data) return undefined;
  const [learnsets, details, abilities, versions] = data;
  const gen = versions.find((v) => v.id === game)?.gen;
  const index = new Map(ids.map((id, i) => [id, i]));
  return (m: TeamMember) => {
    const i = index.get(m.speciesId);
    if (i === undefined) return undefined;
    const ok = learnable(learnsets[i], game);
    const { view, form } = applyForm(details[i], m.formKey ?? null);
    const ability = memberAbility(view.abilities, m.ability, abilities);
    return {
      inGame: !!learnsets[i][game] && formInGame(form, game),
      flagged: new Set((m.moves ?? []).filter((id) => !ok.has(id))),
      abilityOff: ability?.id !== undefined && !abilityInGame(gen, abilities[ability.id]?.gen ?? 1, ability.hidden),
      // Unflagged only while items.json is missing, when the card shows no item chip.
      itemOff: m.item !== undefined && !!items?.[m.item] && !itemInGame(gen, items[m.item].gen),
    };
  };
}

/** Marks an ability or item chip that the team's game lacks: a dashed edge and a note, like moves. */
const offClass = (off?: boolean) => (off ? 'league-chip not-in-game' : 'league-chip');
const offNote = (off?: boolean) => off && <small className="move-flag">Not in game</small>;

/**
 * What is set on a member (ability, nature, item, moves), or a prompt when nothing is set yet. Ability, item and
 * moves open the quick view; the rest of the card is the editor link under them.
 */
function MemberDetails({
  member: m,
  name,
  items,
  moves,
  abilities,
  own,
  flagged,
  abilityOff,
  itemOff,
}: {
  member: TeamMember;
  name: string;
  /** The form's own abilities, when known; a same-named one (As One) then opens the form's. */
  own?: MemberView['abilities'];
  items?: ItemTable;
  moves?: MoveTable;
  abilities?: AbilityNameTable;
  flagged?: Set<number>;
  /** The ability or item isn't in the team's game. */
  abilityOff?: boolean;
  itemOff?: boolean;
}) {
  const peek = usePeek();
  const item = m.item !== undefined && items?.[m.item] ? { id: m.item, name: items[m.item].name } : undefined;
  // A form's own abilities come with its species file; until then a name lookup could pick another form's (As One).
  const abilityId = m.formKey && !own ? undefined : memberAbility(own ?? [], m.ability, abilities)?.id;
  const chosen = moves && m.moves?.length ? m.moves : undefined;
  if (!m.ability && !m.nature && m.item === undefined && !m.moves?.length) return <span className="team-mon-hint">Tap to set ability, nature, item and moves</span>;
  return (
    <>
      {(m.ability || m.nature || item) && (
        <MonFacts>
          {m.ability && (
            <Fact k="Ability">
              {abilityId ? (
                <button className={offClass(abilityOff)} onClick={() => peek({ kind: 'ability', id: abilityId })}>
                  {m.ability}
                  {offNote(abilityOff)}
                </button>
              ) : (
                <span className={offClass(abilityOff)}>
                  {m.ability}
                  {offNote(abilityOff)}
                </span>
              )}
            </Fact>
          )}
          {m.nature && <Fact k="Nature">{m.nature}</Fact>}
          {item && (
            <Fact k="Item">
              <button className={offClass(itemOff)} onClick={() => peek({ kind: 'item', id: item.id })}>
                <img src={itemSpriteUrl(item.id)} alt="" width={24} height={24} loading="lazy" />
                {item.name}
                {offNote(itemOff)}
              </button>
            </Fact>
          )}
        </MonFacts>
      )}
      {chosen && moves && <MonMoves name={name} moves={chosen} table={moves} flagged={flagged} onPeek={(id) => peek({ kind: 'move', id })} />}
    </>
  );
}

// ---------------- saved teams ----------------
export function TeamsScreen() {
  const teams = useLiveQuery(() => db.teams.orderBy('updatedAt').reverse().toArray(), []);
  const { view } = useMemberViews(teams?.flatMap((t) => t.members));
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState<Team>();
  const [game] = useGame();

  return (
    <>
      <header className="dex-head">
        <h1>Teams</h1>
      </header>
      <TeamTabs />
      <div className="list">
        {!teams && <Loading />}
        {teams?.length === 0 && <p className="empty">No teams yet. Create one, or tap + on any Pokémon.</p>}
        {teams?.map((t) => (
          <div key={t.id} className="team-row team-entry">
            <Link to={`/teams/${t.id}`}>
              <span className="name">{t.name}</span>
              <span className="meta">
                {t.members.length} of {TEAM_SIZE}
              </span>
              {t.members.length > 0 && (
                <span className="minis" aria-hidden="true">
                  {t.members.map((m, i) => {
                    const mon = view?.(m);
                    return <img key={i} src={spriteUrl(mon?.mediaId ?? m.speciesId)} alt="" title={mon?.name} />;
                  })}
                </span>
              )}
            </Link>
            <button className="icon-btn" aria-label={`Rename ${t.name}`} onClick={() => setRenaming(t)}>
              <Icon name="pencil" size={20} />
            </button>
          </div>
        ))}
        <button className="add-slot" onClick={async () => navigate(`/teams/${await createTeam(undefined, teamGame(game))}`)}>
          <Icon name="plus" size={18} /> New team
        </button>
      </div>
      {renaming && <RenameSheet noun="team" name={renaming.name} onSave={(name) => renameTeam(renaming.id, name)} onClose={() => setRenaming(undefined)} />}
    </>
  );
}

/** The Team tab's two lists. */
export function TeamTabs() {
  return (
    <nav className="segmented team-tabs" aria-label="Lists">
      <NavLink to="/teams" end>
        Teams
      </NavLink>
      <NavLink to="/teams/pokedex" end>
        Pokédexes
      </NavLink>
    </nav>
  );
}

/** A sheet that renames a team or Pokédex; `onSave` runs only when the name changed. */
export function RenameSheet({ noun, name: current, onSave, onClose }: { noun: string; name: string; onSave: (name: string) => void; onClose: () => void }) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const [name, setName] = useState(current);
  const headingId = useId();
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
            <h2 id={headingId}>Rename {noun}</h2>
            <button type="button" className="text-btn" onClick={() => close()}>
              Cancel
            </button>
          </div>
          <label className="search rename-field">
            <span className="sr-only">{cap(noun)} name</span>
            <input
              data-autofocus
              value={name}
              maxLength={40}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button className="primary-btn" disabled={!name.trim()}>
            Save
          </button>
        </form>
      </section>
    </>
  );
}

// ---------------- team editor ----------------
const godModeText = (on: boolean) =>
  on ? 'God mode on: any move, ability and item for every member' : 'God mode off: only legal moves, abilities and items';

export function TeamEditor() {
  const id = Number(useParams().id);
  const team = useLiveQuery(() => db.teams.get(id).then((t) => t ?? null), [id]);
  const { view } = useMemberViews(team?.members);
  const { data: items } = useLoad(loadItems, 'items');
  const { data: moves } = useLoad(loadMoves, 'moves');
  const { data: abilities } = useLoad(loadAbilityNames, 'ability-names');
  const { data: versions } = useLoad(loadVersions, 'versions');
  const legality = useLegality(team?.members, team?.game, items);
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const toast = useToast();

  if (team === undefined) return <Loading />;
  if (!team) return <p className="empty">This team no longer exists.</p>;
  // Undefined for any game, and until versions.json loads (the flags wait for it too).
  const gameLabel = team.game !== undefined && versions ? (versions.find((v) => v.id === team.game)?.label ?? 'Unknown game') : undefined;

  return (
    <>
      <header className="topbar">
        <Link to="/teams" className="icon-btn" aria-label="Back to teams">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1 className="team-name">{team.name}</h1>
          <div className="sub">
            {team.members.length} of {TEAM_SIZE}
            {gameLabel && ` · ${gameLabel}`}
            {team.godMode && ' · God mode'}
          </div>
        </div>
        <button
          className="icon-btn"
          aria-label="God mode"
          aria-pressed={team.godMode ?? false}
          title={godModeText(team.godMode ?? false)}
          onClick={async () => {
            await setGodMode(id, !team.godMode);
            toast({ text: godModeText(!team.godMode) });
          }}
        >
          <Icon name="bolt" />
        </button>
        <button className="icon-btn" aria-label="Rename team" onClick={() => setRenaming(true)}>
          <Icon name="pencil" />
        </button>
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
        {versions && (
          <label className="game-select team-game">
            <span className="k">Game</span>
            <select value={team.game ?? ''} onChange={(e) => setTeamGame(id, e.target.value ? Number(e.target.value) : undefined)}>
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
        {team.members.length > 0 && (
          <ul className="team-members">
            {team.members.map((m, i) => {
              const mon = view?.(m);
              const name = mon?.name ?? formatNo(m.speciesId);
              const legal = legality?.(m);
              return (
                <li key={`${m.speciesId}-${i}`} className="team-mon" style={{ backgroundColor: mon ? typeTint(mon.types[0]) : 'var(--surface)' }}>
                  <Link to={`/teams/${id}/member/${i}`} className="evo-member">
                    <MonHead spriteId={mon?.mediaId ?? m.speciesId} name={name} types={mon?.types ?? []} />
                  </Link>
                  {legal && !legal.inGame && gameLabel && <span className="team-mon-hint team-mon-flag">Not in {gameLabel}</span>}
                  <MemberDetails
                    member={m}
                    name={name}
                    items={items}
                    moves={moves}
                    abilities={abilities}
                    own={mon?.abilities}
                    flagged={legal?.flagged}
                    abilityOff={legal?.abilityOff}
                    itemOff={legal?.itemOff}
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
        <div className="bottom-cta">
          <Link to={`/teams/${id}/coverage`} className="primary-btn">
            <Icon name="shield" size={20} /> Analyse coverage
          </Link>
        </div>
      )}
      {renaming && <RenameSheet noun="team" name={team.name} onSave={(name) => renameTeam(id, name)} onClose={() => setRenaming(false)} />}
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
