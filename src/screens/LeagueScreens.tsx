import { useId, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom';
import {
  itemSpriteUrl, loadAbilities, loadIndex, loadItemReference, loadItems, loadMoves, loadSpecies, loadTrainerGame, loadTrainerGames,
  trainerSpriteUrl, useLoad, type TrainerKind,
} from '../data/api';
import type { MemberView } from '../data/forms';
import type { AbilityTable, FormVariant, IndexEntry, ItemTable, LeagueGame, LeagueMember, LeagueTrainer, MoveTable } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip } from '../components/bits';
import { Fact, MonFacts, MonHead, MonMoves } from '../components/MonCard';
import { usePeek } from '../components/usePeek';
import { teamType } from '../data/teamType';
import { findTrainer, readTeamPick, shownTeam, teamPickParams, teamSummary, trainerSlug, type TeamPick } from '../data/trainers';
import { typeTint } from '../data/typeColors';
import { CoverageBody } from './TeamScreens';

const battleFormLabel = (key: string) => (key === 'gmax' ? 'Gigantamaxes' : 'Mega Evolves');
const TITLES: Record<TrainerKind, string> = { league: 'Elite Four & Champion', gyms: 'Gym Leaders' };

// ---------------- games ----------------
export function LeagueList({ kind }: { kind: TrainerKind }) {
  const { data, error } = useLoad(() => loadTrainerGames(kind), kind);
  return (
    <>
      <header className="topbar">
        <Link to="/reference" className="icon-btn" aria-label="Back to Guide">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>{TITLES[kind]}</h1>
          {data && <div className="sub">{data.length} games</div>}
        </div>
      </header>
      {error && <p className="empty">Couldn't load the games. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && (
        <ul className="ref-list">
          {data.map((g) => (
            <li key={g.id}>
              <Link to={`/reference/${kind}/${g.id}`} className="move-row">
                <span className="body">
                  <span className="name">{g.label}</span>
                  <span className="meta">
                    <span>{g.region}</span>
                    <span>Gen {g.gen}</span>
                  </span>
                </span>
                <Icon name="next" size={20} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---------------- one game ----------------
interface Tables {
  index: Map<number, IndexEntry>;
  /** Forms of the species that appear in another form, keyed `${id}:${form}`. */
  forms: Map<string, FormVariant>;
  moves: MoveTable;
  abilities: AbilityTable;
  items: ItemTable;
}

const formKey = (id: number, form: string) => `${id}:${form}`;

const NO_STATS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** A member's sprite, name, types and base stats, from its form when it has one. */
function monOf(m: LeagueMember, tables: Tables): MemberView {
  const species = tables.index.get(m.id);
  const form = m.form ? tables.forms.get(formKey(m.id, m.form)) : undefined;
  return {
    mediaId: form?.pokemonId ?? m.id,
    name: form?.name ?? species?.name ?? `#${m.id}`,
    types: form?.types ?? species?.types ?? [],
    stats: form?.stats ?? species?.stats ?? NO_STATS,
    total: form?.total ?? species?.total ?? 0,
  };
}

/** The game and the tables its pages need; null when the id is not a game in the data. */
async function loadGame(kind: TrainerKind, id: string): Promise<[LeagueGame, Tables] | null> {
  if (!(await loadTrainerGames(kind)).some((g) => g.id === id)) return null;
  const [game, index, moves, abilities, held] = await Promise.all([
    loadTrainerGame(kind, id), loadIndex(), loadMoves(), loadAbilities(), loadItems(),
  ]);
  const teams = game.trainers.flatMap((t) => [...t.teams, ...(t.rematches ?? []).flatMap((r) => r.teams)]);
  const members = teams.flatMap((team) => team.members);
  // A few teams hold Berries with no battle effect, which only the full item table names.
  const items: ItemTable = members.some((m) => m.item !== undefined && !held[m.item]) ? await loadItemReference() : held;
  const formed = [...new Set(members.filter((m) => m.form).map((m) => m.id))];
  const forms = new Map<string, FormVariant>();
  for (const s of await Promise.all(formed.map(loadSpecies))) {
    for (const f of s.forms ?? []) forms.set(formKey(s.id, f.key), f);
  }
  return [game, { index: new Map(index.map((s) => [s.id, s])), forms, moves, abilities, items }];
}

/** Back to where the user came from, or to `fallback` when the page was opened directly. */
function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate();
  return (
    <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate(fallback))}>
      <Icon name="back" />
    </button>
  );
}

/** Game and trainer pages' scroll positions by URL: ScrollRestoration runs before their data has loaded. */
const savedScroll = new Map<string, number>();

/** Back to a game or trainer page returns to the same place on it, once `ready`. */
function useRestoreScroll(ready: boolean) {
  const { pathname, search } = useLocation();
  const key = pathname + search;
  const back = useNavigationType() === 'POP';
  useLayoutEffect(() => {
    if (!ready) return;
    const saved = savedScroll.get(key);
    if (back && saved) window.scrollTo({ top: saved });
    return () => {
      savedScroll.set(key, window.scrollY);
    };
  }, [ready, key, back]);
}

export function LeagueGameScreen({ kind }: { kind: TrainerKind }) {
  const id = useParams().game ?? '';
  const { data, error } = useLoad(() => loadGame(kind, id), `${kind}/${id}`);
  const [game, tables] = data ?? [];
  useRestoreScroll(!!tables);
  return (
    <>
      <header className="topbar">
        <BackButton fallback={`/reference/${kind}`} />
        <div className="grow">
          <h1>{game?.label ?? TITLES[kind]}</h1>
          {game && <div className="sub">{game.region} · Gen {game.gen}</div>}
        </div>
      </header>
      {error && <Missing to={`/reference/${kind}`} link="All games" text="Couldn't load this game. Check your connection and try again." />}
      {data === null && <Missing to={`/reference/${kind}`} link="All games" text="This game isn't in the data." />}
      {data === undefined && !error && <Loading />}
      {game && tables && (
        <>
          {game.note && <p className="hint league-note">{game.note}</p>}
          <ul className="league-trainers">
            {game.trainers.map((t, i) => (
              <TrainerRow key={`${t.name}-${i}`} to={`/reference/${kind}/${game.id}/${trainerSlug(t.name)}`} trainer={t} tables={tables} />
            ))}
          </ul>
          <Sources trainers={game.trainers} />
        </>
      )}
    </>
  );
}

function Missing({ to, link, text }: { to: string; link: string; text: string }) {
  return (
    <div className="empty" role="alert">
      <p>{text}</p>
      <Link to={to}>{link}</Link>
    </div>
  );
}

function TrainerSprite({ sprite }: { sprite?: string }) {
  return sprite ? (
    <img className="trainer-sprite" src={trainerSpriteUrl(sprite)} alt="" width={72} height={72} loading="lazy" />
  ) : (
    <span className="trainer-sprite placeholder" aria-hidden="true">
      <Icon name="person" size={32} />
    </span>
  );
}

/** A trainer in the game's list: "Badge · Name", role and type, and the first battle team's size and top level. */
function TrainerRow({ to, trainer: t, tables }: { to: string; trainer: LeagueTrainer; tables: Tables }) {
  const team = t.teams[0];
  const { count, level } = teamSummary(team);
  return (
    <li className="league-trainer" style={tintOf(t, team.members, tables)}>
      <Link className="league-head" to={to}>
        <TrainerSprite sprite={t.sprite} />
        <span className="who">
          <span className="trainer-name">
            {t.badge && <span className="badge-name">{t.badge} · </span>}
            <span className="name">{t.name}</span>
          </span>
          <span className="tags">
            <span className="role">{t.role}</span>
            {t.type && <TypeChip type={t.type} />}
          </span>
          <span className="team-size">
            {count} Pokémon · Lv {level}
          </span>
        </span>
        <Icon name="next" size={20} />
      </Link>
    </li>
  );
}

// ---------------- one trainer ----------------
/** The trainer in the URL, its game and tables, and the team its rematch and choice pickers show. */
function useTrainer(kind: TrainerKind) {
  const { game: gameId = '', trainer: slug = '' } = useParams();
  const { data, error } = useLoad(() => loadGame(kind, gameId), `${kind}/${gameId}`);
  const [game, tables] = data ?? [];
  const trainer = game && findTrainer(game, slug);
  const [params, setParams] = useSearchParams();
  const pick = readTeamPick(params);
  const shown = trainer && shownTeam(trainer, pick);
  const setPick = (p: TeamPick) => setParams(teamPickParams(p), { replace: true, preventScrollReset: true });
  const gamePath = `/reference/${kind}/${gameId}`;
  const missing =
    (error && <Missing to={gamePath} link="All trainers" text="Couldn't load this trainer. Check your connection and try again." />) ||
    (data === null && <Missing to={`/reference/${kind}`} link="All games" text="This game isn't in the data." />) ||
    (game && !trainer && <Missing to={gamePath} link="All trainers" text="This trainer isn't in this game." />) ||
    (data === undefined && <Loading />);
  return { game, tables, trainer, pick, shown, setPick, gamePath, search: params.toString(), missing };
}

export function TrainerScreen({ kind }: { kind: TrainerKind }) {
  const { game, tables, trainer: t, pick, shown, setPick, gamePath, search, missing } = useTrainer(kind);
  const headingId = useId();
  useRestoreScroll(!!shown);
  return (
    <>
      <header className="topbar">
        <BackButton fallback={gamePath} />
        <div className="grow">
          <h1 id={headingId}>{t?.name ?? TITLES[kind]}</h1>
          {game && <div className="sub">{game.label}</div>}
        </div>
      </header>
      {missing}
      {t && tables && shown && (
        <>
          <div className="league-trainer trainer-hero" style={tintOf(t, shown.team.members, tables)}>
            <TrainerSprite sprite={t.sprite} />
            <span className="who">
              <span className="tags">
                <span className="role">{t.role}</span>
                {t.type && <TypeChip type={t.type} />}
              </span>
              {t.badge && <span className="badge-name">{t.badge}</span>}
            </span>
          </div>
          {t.rematches && (
            <button
              type="button"
              className="switch-row"
              role="switch"
              aria-checked={pick.rematch}
              onClick={() => setPick({ rematch: !pick.rematch, stage: 0, pick: 0 })}
            >
              Show rematches
              <span className="track" aria-hidden="true" />
            </button>
          )}
          <div className="trainer-picks">
            {pick.rematch && !shown.stages && <p className="hint">No rematch for this trainer: first battle team.</p>}
            {shown.stages && shown.stages.length > 1 && (
              <Picker
                labels={shown.stages.map((s) => s.label.replace(/^Rematch /, ''))}
                fallback="Which rematch"
                pick={shown.stage}
                onPick={(i) => setPick({ rematch: true, stage: i, pick: 0 })}
                labelledBy={headingId}
              />
            )}
            {shown.stages?.length === 1 && shown.stages[0].label !== 'Rematch' && (
              <p className="league-pick-label">{shown.stages[0].label}</p>
            )}
            {shown.teams.length > 1 && (
              <Picker
                labels={shown.teams.map((tm) => tm.label ?? '')}
                fallback="Team"
                pick={shown.pick}
                onPick={(i) => setPick({ ...pick, stage: shown.stage, pick: i })}
                labelledBy={headingId}
              />
            )}
          </div>
          <div className="list">
            <ul className="team-members">
              {shown.team.members.map((m, i) => (
                <TrainerMon key={`${m.id}-${i}`} member={m} tables={tables} />
              ))}
            </ul>
          </div>
          <div className="bottom-cta">
            <Link to={`${gamePath}/${trainerSlug(t.name)}/coverage${search && `?${search}`}`} className="primary-btn">
              <Icon name="shield" size={20} /> Analyse coverage
            </Link>
          </div>
          <Sources trainers={[t]} />
        </>
      )}
    </>
  );
}

function tintOf(t: LeagueTrainer, members: LeagueMember[], tables: Tables) {
  const tint = teamType(t.type, members.map((m) => monOf(m, tables).types));
  return tint && { backgroundColor: typeTint(tint) };
}

export function TrainerCoverageScreen({ kind }: { kind: TrainerKind }) {
  const { tables, trainer, shown, gamePath, search, missing } = useTrainer(kind);
  const members = tables && shown ? shown.team.members.map((m) => ({ mon: monOf(m, tables), moves: m.moves })) : [];
  return (
    <>
      <header className="topbar">
        <BackButton fallback={trainer ? `${gamePath}/${trainerSlug(trainer.name)}${search && `?${search}`}` : gamePath} />
        <div className="grow">
          <h1>Coverage</h1>
          {trainer && (
            <div className="sub">
              {trainer.name} · {members.length} member{members.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </header>
      {missing}
      {members.length > 0 && <CoverageBody members={members} />}
    </>
  );
}

/** "If you chose Bulbasaur", "If you chose Squirtle" → prefix "If you chose", options "Bulbasaur", "Squirtle". */
function splitLabels(labels: string[]): { prefix: string; options: string[] } {
  const words = labels.map((l) => l.split(' '));
  let n = 0;
  while (words.every((w) => n < w.length - 1 && w[n] === words[0][n])) n++;
  // "(before Stark Mountain)" → "Before Stark Mountain".
  const option = (w: string[]) => w.slice(n).join(' ').replace(/^\((.*)\)$/, '$1').replace(/^./, (c) => c.toUpperCase());
  return { prefix: words[0].slice(0, n).join(' '), options: words.map(option) };
}

/** A labelled row of radio buttons; `labels` share their leading words, which become the heading. */
function Picker({ labels, fallback, pick, onPick, labelledBy }: {
  labels: string[];
  /** Heading when the labels share no leading words. */
  fallback: string;
  pick: number;
  onPick: (i: number) => void;
  labelledBy: string;
}) {
  const { prefix, options } = splitLabels(labels);
  const id = useId();
  return (
    <>
      <div className="league-pick-label" id={id}>
        {prefix || fallback}
      </div>
      <div className="segmented league-pick" role="radiogroup" aria-labelledby={`${labelledBy} ${id}`}>
        {options.map((o, i) => (
          <button key={i} role="radio" aria-checked={i === pick} onClick={() => onPick(i)}>
            {o}
          </button>
        ))}
      </div>
    </>
  );
}

/** A team member as a saved team's card: the head links to the species, ability, item and moves open the quick view. */
function TrainerMon({ member: m, tables }: { member: LeagueMember; tables: Tables }) {
  const peek = usePeek();
  const { mediaId, name, types } = monOf(m, tables);
  const item = m.item !== undefined && tables.items[m.item] ? { id: m.item, name: tables.items[m.item].name } : undefined;
  const ability = m.ability !== undefined && tables.abilities[m.ability] ? { id: m.ability, name: tables.abilities[m.ability].name } : undefined;
  return (
    <li className="team-mon trainer-mon" style={{ backgroundColor: types[0] ? typeTint(types[0]) : 'var(--surface)' }}>
      <Link className="evo-member" to={`/pokemon/${m.id}${m.form ? `?form=${m.form}` : ''}`}>
        <MonHead spriteId={mediaId} name={name} types={types} aside={<span className="lv">Lv {m.level}</span>} />
      </Link>
      {(ability || item || m.tera || m.battleForm) && (
        <MonFacts>
          {ability && (
            <Fact k="Ability">
              <button className="league-chip" onClick={() => peek({ kind: 'ability', id: ability.id })}>
                {ability.name}
              </button>
            </Fact>
          )}
          {item && (
            <Fact k="Item">
              <button className="league-chip" onClick={() => peek({ kind: 'item', id: item.id })}>
                <img src={itemSpriteUrl(item.id)} alt="" width={24} height={24} loading="lazy" />
                {item.name}
              </button>
            </Fact>
          )}
          {m.tera && (
            <Fact k="Tera">
              <TypeChip type={m.tera} />
            </Fact>
          )}
          {m.battleForm && <Fact k="In battle">{battleFormLabel(m.battleForm)}</Fact>}
        </MonFacts>
      )}
      {m.moves.length > 0 && <MonMoves name={name} moves={m.moves} table={tables.moves} onPeek={(id) => peek({ kind: 'move', id })} />}
    </li>
  );
}

function Sources({ trainers }: { trainers: LeagueTrainer[] }) {
  const pages = [...new Map(trainers.map((t) => [t.source, t.name]))];
  return (
    <section className="section">
      <h2>Source</h2>
      <p className="hint league-source">
        Teams from Bulbapedia (CC BY-NC-SA 2.5), trainer sprites from Bulbagarden Archives:{' '}
        {pages.map(([url, name], i) => (
          <span key={url}>
            {i > 0 && ', '}
            <a href={url} target="_blank" rel="noreferrer">
              {name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
        ))}
        .
      </p>
    </section>
  );
}
