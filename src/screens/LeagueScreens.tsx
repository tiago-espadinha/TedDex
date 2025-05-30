import { useId, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  itemSpriteUrl, loadAbilities, loadIndex, loadItemReference, loadItems, loadMoves, loadSpecies, loadTrainerGame, loadTrainerGames,
  trainerSpriteUrl, useLoad, type TrainerKind,
} from '../data/api';
import type { AbilityTable, FormVariant, IndexEntry, ItemTable, LeagueGame, LeagueMember, LeagueTeam, LeagueTrainer, MoveTable } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip } from '../components/bits';
import { Fact, MonFacts, MonHead, MonMoves } from '../components/MonCard';

const battleFormLabel = (key: string) => (key === 'gmax' ? 'Gigantamaxes' : 'Mega Evolves');
const TITLES: Record<TrainerKind, string> = { league: 'Elite Four & Champion', gyms: 'Gym Leaders' };

// ---------------- games ----------------
export function LeagueList({ kind }: { kind: TrainerKind }) {
  const { data, error } = useLoad(() => loadTrainerGames(kind), kind);
  return (
    <>
      <header className="topbar">
        <Link to="/reference" className="icon-btn" aria-label="Back to Reference">
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

/** The game and the tables its page needs; null when the id is not a game in the data. */
async function loadGame(kind: TrainerKind, id: string): Promise<[LeagueGame, Tables] | null> {
  if (!(await loadTrainerGames(kind)).some((g) => g.id === id)) return null;
  const [game, index, moves, abilities, held] = await Promise.all([
    loadTrainerGame(kind, id), loadIndex(), loadMoves(), loadAbilities(), loadItems(),
  ]);
  const teams = game.trainers.flatMap((t) => [...t.teams, ...(t.rematches ?? []).flatMap((r) => r.teams)]);
  const members = teams.flatMap((team) => team.members);
  // A few teams hold Berries with no battle effect, which only the full item table names.
  let items = held;
  if (members.some((m) => m.item !== undefined && !held[m.item])) {
    items = Object.fromEntries(Object.entries(await loadItemReference()).map(([itemId, item]) => [itemId, item.name]));
  }
  const formed = [...new Set(members.filter((m) => m.form).map((m) => m.id))];
  const forms = new Map<string, FormVariant>();
  for (const s of await Promise.all(formed.map(loadSpecies))) {
    for (const f of s.forms ?? []) forms.set(formKey(s.id, f.key), f);
  }
  return [game, { index: new Map(index.map((s) => [s.id, s])), forms, moves, abilities, items }];
}

export function LeagueGameScreen({ kind }: { kind: TrainerKind }) {
  const id = useParams().game ?? '';
  const navigate = useNavigate();
  const { data, error } = useLoad(() => loadGame(kind, id), `${kind}/${id}`);
  const [game, tables] = data ?? [];
  const [params, setParams] = useSearchParams();
  const hasRematches = !!game?.trainers.some((t) => t.rematches);
  const rematch = hasRematches && params.get('rematch') === '1';
  const toggleRematch = () => setParams(rematch ? {} : { rematch: '1' }, { replace: true });
  return (
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate(`/reference/${kind}`))}>
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1>{game?.label ?? TITLES[kind]}</h1>
          {game && <div className="sub">{game.region} · Gen {game.gen}</div>}
        </div>
      </header>
      {error && <Missing kind={kind} text="Couldn't load this game. Check your connection and try again." />}
      {data === null && <Missing kind={kind} text="This game isn't in the data." />}
      {data === undefined && !error && <Loading />}
      {game && tables && (
        <>
          {game.note && <p className="hint league-note">{game.note}</p>}
          {hasRematches && (
            <button type="button" className="switch-row" role="switch" aria-checked={rematch} onClick={toggleRematch}>
              Show rematches
              <span className="track" aria-hidden="true" />
            </button>
          )}
          {game.trainers.map((t, i) => (
            <TrainerSection key={`${t.name}-${i}`} trainer={t} tables={tables} rematch={rematch} />
          ))}
          <Sources trainers={game.trainers} />
        </>
      )}
    </>
  );
}

function Missing({ kind, text }: { kind: TrainerKind; text: string }) {
  return (
    <div className="empty" role="alert">
      <p>{text}</p>
      <Link to={`/reference/${kind}`}>All games</Link>
    </div>
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

function TrainerSection({ trainer: t, tables, rematch }: { trainer: LeagueTrainer; tables: Tables; rematch: boolean }) {
  const [stage, setStage] = useState(0);
  const [pick, setPick] = useState(0);
  const stages = rematch ? t.rematches : undefined;
  const teams: LeagueTeam[] = stages?.[stage].teams ?? t.teams;
  const team = teams[Math.min(pick, teams.length - 1)];
  const headingId = useId();
  return (
    <section className="section league-trainer" aria-labelledby={headingId}>
      <div className="league-head">
        {t.sprite ? (
          <img className="trainer-sprite" src={trainerSpriteUrl(t.sprite)} alt="" width={72} height={72} loading="lazy" />
        ) : (
          <span className="trainer-sprite placeholder" aria-hidden="true">
            <Icon name="person" size={32} />
          </span>
        )}
        <div className="who">
          <h2 id={headingId}>{t.name}</h2>
          <div className="tags">
            <span className="role">{t.role}</span>
            {t.type && <TypeChip type={t.type} />}
          </div>
          {t.badge && <div className="badge-name">{t.badge}</div>}
        </div>
      </div>
      {rematch && !stages && <p className="hint league-no-rematch">No rematch for this trainer: first battle team.</p>}
      {stages && stages.length > 1 && (
        <Picker
          labels={stages.map((s) => s.label)}
          fallback="Rematch"
          pick={stage}
          onPick={(i) => {
            setStage(i);
            setPick(0);
          }}
          labelledBy={headingId}
        />
      )}
      {stages?.length === 1 && <p className="league-pick-label">{stages[0].label}</p>}
      {teams.length > 1 && (
        <Picker labels={teams.map((tm) => tm.label ?? '')} fallback="Team" pick={pick} onPick={setPick} labelledBy={headingId} />
      )}
      <ul className="league-team">
        {team.members.map((m, i) => (
          <MemberRow key={`${m.id}-${i}`} member={m} tables={tables} />
        ))}
      </ul>
    </section>
  );
}

function MemberRow({ member: m, tables }: { member: LeagueMember; tables: Tables }) {
  const species = tables.index.get(m.id);
  const form = m.form ? tables.forms.get(formKey(m.id, m.form)) : undefined;
  const name = form?.name ?? species?.name ?? `#${m.id}`;
  const item = m.item !== undefined && tables.items[m.item] ? { id: m.item, name: tables.items[m.item] } : undefined;
  const ability = m.ability !== undefined ? tables.abilities[m.ability]?.name : undefined;
  return (
    <li className="league-mon">
      <Link className="evo-member" to={`/pokemon/${m.id}${m.form ? `?form=${m.form}` : ''}`}>
        <MonHead
          spriteId={form?.pokemonId ?? m.id}
          name={name}
          types={form?.types ?? species?.types ?? []}
          aside={<span className="lv">Lv {m.level}</span>}
        />
      </Link>
      {(ability || item || m.tera || m.battleForm) && (
        <MonFacts>
          {ability && (
            <Fact k="Ability">
              <Link className="league-chip" to={`/reference/abilities/${m.ability}`}>
                {ability}
              </Link>
            </Fact>
          )}
          {item && (
            <Fact k="Item">
              <Link className="league-chip" to={`/reference/items/${item.id}`}>
                <img src={itemSpriteUrl(item.id)} alt="" width={24} height={24} loading="lazy" />
                {item.name}
              </Link>
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
      {m.moves.length > 0 && <MonMoves name={name} moves={m.moves} table={tables.moves} />}
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
