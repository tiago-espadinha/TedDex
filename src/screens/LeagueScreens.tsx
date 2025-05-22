import { useId, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadAbilities, loadIndex, loadItems, loadLeague, loadLeagues, loadMoves, loadSpecies, spriteUrl, useLoad } from '../data/api';
import { typeChip, typeTint } from '../data/typeColors';
import type { AbilityTable, FormVariant, IndexEntry, ItemTable, LeagueGame, LeagueMember, LeagueTrainer, MoveTable } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip } from '../components/bits';

const battleFormLabel = (key: string) => (key === 'gmax' ? 'Gigantamaxes' : 'Mega Evolves');

// ---------------- games ----------------
export function LeagueList() {
  const { data, error } = useLoad(loadLeagues, 'leagues');
  return (
    <>
      <header className="topbar">
        <Link to="/reference" className="icon-btn" aria-label="Back to Reference">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>Elite Four &amp; Champion</h1>
          {data && <div className="sub">{data.length} games</div>}
        </div>
      </header>
      {error && <p className="empty">Couldn't load the games. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && (
        <ul className="ref-list">
          {data.map((g) => (
            <li key={g.id}>
              <Link to={`/reference/league/${g.id}`} className="move-row">
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
async function loadGame(id: string): Promise<[LeagueGame, Tables] | null> {
  if (!(await loadLeagues()).some((g) => g.id === id)) return null;
  const [game, index, moves, abilities, items] = await Promise.all([loadLeague(id), loadIndex(), loadMoves(), loadAbilities(), loadItems()]);
  const members = game.trainers.flatMap((t) => t.teams.flatMap((team) => team.members));
  const formed = [...new Set(members.filter((m) => m.form).map((m) => m.id))];
  const forms = new Map<string, FormVariant>();
  for (const s of await Promise.all(formed.map(loadSpecies))) {
    for (const f of s.forms ?? []) forms.set(formKey(s.id, f.key), f);
  }
  return [game, { index: new Map(index.map((s) => [s.id, s])), forms, moves, abilities, items }];
}

export function LeagueGameScreen() {
  const id = useParams().game ?? '';
  const navigate = useNavigate();
  const { data, error } = useLoad(() => loadGame(id), id);
  const [game, tables] = data ?? [];
  return (
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/reference/league'))}>
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1>{game?.label ?? 'Elite Four & Champion'}</h1>
          {game && <div className="sub">{game.region} · Gen {game.gen}</div>}
        </div>
      </header>
      {error && <Missing text="Couldn't load this game. Check your connection and try again." />}
      {data === null && <Missing text="This game isn't in the data." />}
      {data === undefined && !error && <Loading />}
      {game && tables && (
        <>
          {game.note && <p className="hint league-note">{game.note}</p>}
          {game.trainers.map((t, i) => (
            <TrainerSection key={`${t.name}-${i}`} trainer={t} tables={tables} />
          ))}
          <Sources trainers={game.trainers} />
        </>
      )}
    </>
  );
}

function Missing({ text }: { text: string }) {
  return (
    <div className="empty" role="alert">
      <p>{text}</p>
      <Link to="/reference/league">All games</Link>
    </div>
  );
}

/** "If you chose Bulbasaur", "If you chose Squirtle" → prefix "If you chose", options "Bulbasaur", "Squirtle". */
function splitLabels(labels: string[]): { prefix: string; options: string[] } {
  const words = labels.map((l) => l.split(' '));
  let n = 0;
  while (words.every((w) => n < w.length - 1 && w[n] === words[0][n])) n++;
  return { prefix: words[0].slice(0, n).join(' '), options: words.map((w) => w.slice(n).join(' ')) };
}

function TrainerSection({ trainer: t, tables }: { trainer: LeagueTrainer; tables: Tables }) {
  const [pick, setPick] = useState(0);
  const team = t.teams[pick];
  const { prefix, options } = splitLabels(t.teams.map((tm) => tm.label ?? ''));
  const headingId = useId();
  const pickLabelId = useId();
  return (
    <section className="section league-trainer" aria-labelledby={headingId}>
      <div className="league-head">
        <h2 id={headingId}>{t.name}</h2>
        <span className="role">{t.role}</span>
        {t.type && <TypeChip type={t.type} />}
      </div>
      {t.teams.length > 1 && (
        <>
          <div className="league-pick-label" id={pickLabelId}>
            {prefix || 'Team'}
          </div>
          <div className="segmented league-pick" role="radiogroup" aria-labelledby={`${headingId} ${pickLabelId}`}>
            {options.map((o, i) => (
              <button key={i} role="radio" aria-checked={i === pick} onClick={() => setPick(i)}>
                {o}
              </button>
            ))}
          </div>
        </>
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
  const types = form?.types ?? species?.types ?? [];
  const item = m.item !== undefined ? tables.items[m.item] : undefined;
  const ability = m.ability !== undefined ? tables.abilities[m.ability]?.name : undefined;
  return (
    <li className="league-mon">
      <Link className="evo-member" to={`/pokemon/${m.id}${m.form ? `?form=${m.form}` : ''}`}>
        <img
          src={spriteUrl(form?.pokemonId ?? m.id)}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          style={types[0] && { backgroundColor: typeTint(types[0]) }}
        />
        <span className="body">
          <span className="name">{name}</span>
          <span className="types">
            {types.map((t) => (
              <TypeChip key={t} type={t} />
            ))}
          </span>
        </span>
        <span className="lv">
          Lv {m.level}
        </span>
      </Link>
      {(ability || item || m.tera || m.battleForm) && (
        <dl className="league-facts">
          {ability && <Fact k="Ability">{ability}</Fact>}
          {item && <Fact k="Item"><Link to={`/reference/items/${m.item}`}>{item}</Link></Fact>}
          {m.tera && (
            <Fact k="Tera">
              <TypeChip type={m.tera} />
            </Fact>
          )}
          {m.battleForm && <Fact k="In battle">{battleFormLabel(m.battleForm)}</Fact>}
        </dl>
      )}
      {m.moves.length > 0 && (
        <ul className="league-moves" aria-label={`${name}'s moves`}>
          {m.moves.map((id, i) => {
            const move = tables.moves[id];
            return (
              <li key={`${id}-${i}`}>
                <Link to={`/reference/moves/${id}`} style={move && { borderLeftColor: typeChip(move.type) }}>
                  {move?.name ?? `Move ${id}`}
                  {move && <span className="sr-only">, {move.type}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Sources({ trainers }: { trainers: LeagueTrainer[] }) {
  const pages = [...new Map(trainers.map((t) => [t.source, t.name]))];
  return (
    <section className="section">
      <h2>Source</h2>
      <p className="hint league-source">
        Teams of the first league challenge, from Bulbapedia (CC BY-NC-SA 2.5):{' '}
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
