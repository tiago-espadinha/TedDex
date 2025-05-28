import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  defensiveMultipliers, loadAbilities, loadIndex, loadItemReference, loadItems, loadMoveReference, loadMoves, loadTypes,
  offensiveMultipliers, spriteUrl, useLoad,
} from '../data/api';
import { cap, formatNo, roman, signed } from '../data/format';
import { NATURES } from '../data/natures';
import { searchByName } from '../data/reference';
import { activeMoveFilters, filterMoves, moveFilterParams, readMoveFilters } from '../data/moveFilter';
import { typeTint } from '../data/typeColors';
import type { IndexEntry, LearnMethod, MoveInfo, MoveReference, TypeData, TypeName } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, SearchField, TypeChip } from '../components/bits';
import { MoveBody } from './MovesTab';
import { MoveFilterSheet } from './MoveFilterSheet';

type Kind = 'moves' | 'abilities' | 'items' | 'natures' | 'types';

const KINDS: { kind: Kind; title: string; one: string; blurb: string }[] = [
  { kind: 'moves', title: 'Moves', one: 'Move', blurb: 'Power, accuracy, effect and who learns them' },
  { kind: 'abilities', title: 'Abilities', one: 'Ability', blurb: 'What each ability does and who has it' },
  { kind: 'items', title: 'Items', one: 'Held item', blurb: 'Held items and who carries them in the wild' },
  { kind: 'natures', title: 'Natures', one: 'Nature', blurb: 'Which stat each nature raises and lowers' },
  { kind: 'types', title: 'Types', one: 'Type', blurb: 'The type chart, one type at a time' },
];

const STAT_NAMES = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

/** One row of a reference list; `move` and `type` pick a richer row. */
interface Entry {
  id: string;
  name: string;
  sub?: string;
  move?: MoveInfo;
  type?: TypeName;
}

const natureSub = (n: (typeof NATURES)[number]) =>
  n.up && n.down ? `+${STAT_NAMES[n.up]} · −${STAT_NAMES[n.down]}` : 'Neutral, no stat change';

async function loadEntries(kind: Kind): Promise<Entry[]> {
  switch (kind) {
    case 'moves':
      return Object.entries(await loadMoves()).map(([id, move]) => ({ id, name: move.name, move }));
    case 'abilities':
      return Object.entries(await loadAbilities()).map(([id, a]) => ({ id, name: a.name, sub: a.effect }));
    case 'items': {
      const [names, refs] = await Promise.all([loadItems(), loadItemReference()]);
      return Object.entries(names).map(([id, name]) => ({ id, name, sub: refs[Number(id)]?.effect }));
    }
    case 'natures':
      return NATURES.map((n) => ({ id: n.name.toLowerCase(), name: n.name, sub: natureSub(n) }));
    case 'types':
      return (await loadTypes()).types.map((t) => ({ id: t, name: cap(t), type: t }));
  }
}

const kindOf = (param?: string) => KINDS.find((k) => k.kind === param);

// ---------------- landing ----------------
export function ReferenceScreen() {
  return (
    <>
      <header className="dex-head">
        <h1>Reference</h1>
      </header>
      <nav className="list" aria-label="Reference">
        {KINDS.map((k) => (
          <Link key={k.kind} to={`/reference/${k.kind}`} className="team-row ref-kind">
            <div>
              <div className="name">{k.title}</div>
              <div className="meta">{k.blurb}</div>
            </div>
            <Icon name="next" size={20} />
          </Link>
        ))}
        <Link to="/reference/league" className="team-row ref-kind">
          <div>
            <div className="name">Elite Four &amp; Champion</div>
            <div className="meta">Every game's league teams and movesets</div>
          </div>
          <Icon name="next" size={20} />
        </Link>
      </nav>
    </>
  );
}

// ---------------- searchable list ----------------
export function ReferenceList() {
  const k = kindOf(useParams().kind);
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const { data, error } = useLoad(() => (k ? loadEntries(k.kind) : Promise.resolve([])), k?.kind);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Moves also filter and sort; their filters live in the URL next to the query.
  const moveFilters = useMemo(() => (k?.kind === 'moves' ? readMoveFilters(params) : undefined), [k?.kind, params]);
  const moves = useMemo(() => (data ?? []).filter((e): e is MoveEntry => !!e.move), [data]);
  const shown = useMemo(
    () => (moveFilters ? filterMoves(moves, moveFilters) : searchByName(data ?? [], query)),
    [data, moves, moveFilters, query],
  );
  const setQuery = (q: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (q) next.set('q', q);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );

  if (!k) return <p className="empty">Page not found.</p>;
  const filtered = moveFilters ? activeMoveFilters(moveFilters) : 0;

  return (
    <>
      <header className="topbar">
        <Link to="/reference" className="icon-btn" aria-label="Back to Reference">
          <Icon name="back" />
        </Link>
        <div className="head-title">
          <h1>{k.title}</h1>
          {data && <div className="sub">{filtered || query ? `${shown.length} of ${data.length}` : `${data.length} in the data`}</div>}
        </div>
        <SearchField label={`Search ${k.title.toLowerCase()}`} placeholder="Search" value={query} onChange={setQuery} />
      </header>
      {error && <p className="empty">Couldn't load {k.title.toLowerCase()}. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && !shown.length && (
        <p className="empty">{filtered ? `No ${k.title.toLowerCase()} match these filters.` : `No ${k.title.toLowerCase()} match “${query}”.`}</p>
      )}
      {shown.length > 0 && (
        <ul className={moveFilters ? 'ref-list with-fab' : 'ref-list'}>
          {shown.map((e) => (
            <li key={e.id}>
              <Link
                to={`/reference/${k.kind}/${e.id}`}
                className={e.type ? 'move-row tinted' : 'move-row'}
                style={e.type && { backgroundColor: typeTint(e.type) }}
              >
                <EntryBody entry={e} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {moveFilters && (
        <>
          <button
            className="fab"
            aria-label={filtered ? `Filter and sort, ${filtered} active` : 'Filter and sort'}
            onClick={() => setSheetOpen(true)}
          >
            <Icon name="filter" size={24} />
            {filtered > 0 && (
              <span className="badge" aria-hidden="true">
                {filtered}
              </span>
            )}
          </button>
          {sheetOpen && (
            <MoveFilterSheet
              value={moveFilters}
              countFor={(f) => filterMoves(moves, f).length}
              onApply={(f) => {
                setParams(moveFilterParams(f), { replace: true });
                setSheetOpen(false);
                window.scrollTo({ top: 0 });
              }}
              onClose={() => setSheetOpen(false)}
            />
          )}
        </>
      )}
    </>
  );
}

type MoveEntry = Entry & { move: MoveInfo };

function EntryBody({ entry: e }: { entry: Entry }) {
  if (e.move) {
    return (
      <>
        <MoveBody move={e.move} />
        <TypeChip type={e.move.type} />
      </>
    );
  }
  if (e.type) {
    return (
      <span className="body">
        <span>
          <TypeChip type={e.type} large />
        </span>
      </span>
    );
  }
  return (
    <span className="body">
      <span className="name">{e.name}</span>
      {e.sub && <span className="meta one-line">{e.sub}</span>}
    </span>
  );
}

// ---------------- entry pages ----------------
export function ReferenceEntry() {
  const { kind, id = '' } = useParams();
  const k = kindOf(kind);
  if (!k) return <p className="empty">Page not found.</p>;
  const Page = { moves: MoveEntry, abilities: AbilityEntry, items: ItemEntry, natures: NatureEntry, types: TypeEntry }[k.kind];
  return <Page id={id} one={k.one} />;
}

interface EntryProps {
  id: string;
  one: string;
}

interface FrameProps {
  one: string;
  name?: string;
  error?: Error;
  loaded: boolean;
  /** Tints the header with this type, like the detail hero. */
  tint?: TypeName;
  /** Shown in the header under the title, once loaded. */
  head?: ReactNode;
  children?: ReactNode;
}

/** Topbar, then the body once loaded; the same loading, error and not-found states for every kind. */
function EntryFrame({ one, name, error, loaded, tint, head, children }: FrameProps) {
  const navigate = useNavigate();
  let body = children;
  if (error) body = <p className="empty">Couldn't load this {one.toLowerCase()}. {error.message}</p>;
  else if (!loaded) body = <Loading />;
  else if (!name) body = <p className="empty">This {one.toLowerCase()} isn't in the data.</p>;
  return (
    <>
      <header className={tint ? 'topbar tinted' : 'topbar'} style={tint && { backgroundColor: typeTint(tint) }}>
        <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/reference'))}>
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1>{name ?? one}</h1>
          {name && <div className="sub">{one}</div>}
          {name && head}
        </div>
      </header>
      {body}
    </>
  );
}

function MoveEntry({ id, one }: EntryProps) {
  const n = Number(id);
  const { data, error } = useLoad(
    () => Promise.all([loadMoves(), loadIndex()]).then(async ([moves, index]) => [moves, index, moves[n] && (await loadMoveReference(n))] as const),
    n,
  );
  const move = data?.[0][n];
  const ref = data?.[2];
  const facts: [string, ReactNode][] = move
    ? [
        ['Type', <TypeChip key="type" type={move.type} />],
        ['Category', cap(move.category)],
        ['Power', move.power ?? '—'],
        ['Accuracy', move.accuracy ? `${move.accuracy}%` : '—'],
        ['PP', move.pp ?? '—'],
        ['Priority', signed(move.priority)],
      ]
    : [];
  return (
    <EntryFrame
      one={one}
      name={move?.name}
      error={error}
      loaded={!!data}
      tint={move?.type}
      head={
        <dl className="head-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      }
    >
      {move && ref && data && (
        <>
          {ref.description && (
            <div className="section">
              <h2>Description</h2>
              <p className="flavor">{ref.description}</p>
            </div>
          )}
          <Effect text={ref.effect} />
          <MoveLearners learners={ref.learners} index={data[1]} />
        </>
      )}
    </EntryFrame>
  );
}

const LEARN_METHODS: [LearnMethod, string][] = [
  ['level', 'Level up'],
  ['machine', 'TM/HM'],
  ['tutor', 'Tutor'],
  ['egg', 'Egg move'],
];

/** Who learns the move in one generation, one learn method at a time (a species can be in several). */
function MoveLearners({ learners, index }: { learners: MoveReference['learners']; index: IndexEntry[] }) {
  const all = Object.values(learners).flat();
  const gens = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((g) => all.some(([, mask]) => mask & (1 << (g - 1))));
  const [pickGen, setGen] = useState<number>();
  const [pickMethod, setMethod] = useState<LearnMethod>('level');
  if (!gens.length) return <SpeciesList title="Learned by" ids={[]} index={index} none="No Pokémon learn it in the main-series games." />;

  const gen = pickGen && gens.includes(pickGen) ? pickGen : gens[gens.length - 1];
  const inGen = (method: LearnMethod) => (learners[method] ?? []).filter(([, mask]) => mask & (1 << (gen - 1))).map(([s]) => s);
  const methods = LEARN_METHODS.filter(([m]) => inGen(m).length > 0);
  const [method, title] = methods.find(([m]) => m === pickMethod) ?? methods[0];

  return (
    <>
      <div className="section">
        <h2>Learned by</h2>
        <label className="game-select">
          <span className="k">Generation</span>
          <select value={gen} onChange={(e) => setGen(Number(e.target.value))}>
            {gens.map((g) => (
              <option key={g} value={g}>
                Gen {roman(g)}
              </option>
            ))}
          </select>
          <Icon name="next" size={18} />
        </label>
        {methods.length > 1 && (
          <div className="segmented method-pick" role="radiogroup" aria-label="How they learn it">
            {methods.map(([m, label]) => (
              <button key={m} role="radio" aria-checked={m === method} onClick={() => setMethod(m)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <SpeciesList title={title} ids={inGen(method)} index={index} none="" />
    </>
  );
}

function AbilityEntry({ id, one }: EntryProps) {
  const { data, error } = useLoad(() => Promise.all([loadAbilities(), loadIndex()]), 'abilities');
  const ability = data?.[0][Number(id)];
  return (
    <EntryFrame one={one} name={ability?.name} error={error} loaded={!!data}>
      {ability && data && (
        <>
          <Effect text={ability.effect} />
          <SpeciesList title="Pokémon with it" ids={ability.species} index={data[1]} none="No Pokémon have it." />
        </>
      )}
    </EntryFrame>
  );
}

function ItemEntry({ id, one }: EntryProps) {
  const { data, error } = useLoad(() => Promise.all([loadItems(), loadItemReference(), loadIndex()]), 'items');
  const n = Number(id);
  const ref = data?.[1][n];
  return (
    <EntryFrame one={one} name={data?.[0][n]} error={error} loaded={!!data}>
      {ref && data && (
        <>
          <Effect text={ref.effect} />
          <SpeciesList title="Held in the wild by" ids={ref.species} index={data[2]} none="No Pokémon hold it in the wild." />
        </>
      )}
    </EntryFrame>
  );
}

function NatureEntry({ id, one }: EntryProps) {
  const nature = NATURES.find((n) => n.name.toLowerCase() === id);
  return (
    <EntryFrame one={one} name={nature?.name} loaded>
      {nature && (
        <div className="section">
          {nature.up && nature.down ? (
            <div className="facts">
              <Fact k="Raises (+10%)">{STAT_NAMES[nature.up]}</Fact>
              <Fact k="Lowers (−10%)">{STAT_NAMES[nature.down]}</Fact>
            </div>
          ) : (
            <p className="flavor">A neutral nature: it raises and lowers the same stat, so nothing changes.</p>
          )}
          <p className="hint">Any Pokémon can have any nature, so there is no list of species here.</p>
        </div>
      )}
    </EntryFrame>
  );
}

function TypeEntry({ id, one }: EntryProps) {
  const { data, error } = useLoad(() => Promise.all([loadTypes(), loadIndex()]), 'types');
  const type = data?.[0].types.find((t) => t === id);
  return (
    <EntryFrame one={one} name={type && cap(type)} error={error} loaded={!!data} tint={type}>
      {type && data && (
        <>
          <TypeChart type={type} data={data[0]} />
          <SpeciesList
            title={`${cap(type)}-type Pokémon`}
            ids={data[1].filter((m) => m.types.includes(type)).map((m) => m.id)}
            index={data[1]}
            none="No Pokémon have this type."
          />
        </>
      )}
    </EntryFrame>
  );
}

const ATTACK_GROUPS = [
  { label: 'Super effective against', test: (m: number) => m > 1 },
  { label: 'Not very effective against', test: (m: number) => m > 0 && m < 1 },
  { label: 'No effect on', test: (m: number) => m === 0 },
];
const DEFEND_GROUPS = [
  { label: 'Weak to', test: (m: number) => m > 1 },
  { label: 'Resists', test: (m: number) => m > 0 && m < 1 },
  { label: 'Immune to', test: (m: number) => m === 0 },
];

function TypeChart({ type, data }: { type: TypeName; data: TypeData }) {
  const sides = [
    { title: 'Attacking', mult: offensiveMultipliers([type], data), groups: ATTACK_GROUPS },
    { title: 'Defending', mult: defensiveMultipliers([type], data), groups: DEFEND_GROUPS },
  ];
  return sides.map((side) => (
    <div className="section" key={side.title}>
      <h2>{side.title}</h2>
      {side.groups.map((g) => {
        const hits = data.types.filter((t) => g.test(side.mult[t]));
        if (!hits.length) return null;
        return (
          <div className="eff-group" key={g.label}>
            <h3>{g.label}</h3>
            <div className="chip-wrap">
              {hits.map((t) => (
                <Link key={t} to={`/reference/types/${t}`} className="chip-link">
                  <TypeChip type={t} large />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  ));
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="fact">
      <div className="k">{k}</div>
      <div className="v">{children}</div>
    </div>
  );
}

/** Effect text; the data keeps paragraphs apart with a blank line. */
function Effect({ text, title = 'Effect' }: { text: string; title?: string }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      {text ? (
        text.split('\n\n').map((para, i) => (
          <p className="flavor" key={i}>
            {para}
          </p>
        ))
      ) : (
        <p className="flavor">No description in the data yet.</p>
      )}
    </div>
  );
}

/** Species linking to their detail pages, in dex order; sprites load as they scroll into view. */
function SpeciesList({ title, ids, index, none }: { title: string; ids: number[]; index: IndexEntry[]; none: string }) {
  const byId = useMemo(() => new Map(index.map((m) => [m.id, m])), [index]);
  const mons = ids.map((id) => byId.get(id)).filter((m): m is IndexEntry => !!m);
  return (
    <section className="section ref-species">
      <h2>
        {title} · {mons.length}
      </h2>
      {!mons.length ? (
        <p className="hint">{none}</p>
      ) : (
        <ul className="evo-list">
          {mons.map((m) => (
            <li key={m.id}>
              <Link className="evo-member" to={`/pokemon/${m.id}`}>
                <img src={spriteUrl(m.id)} alt="" width={56} height={56} loading="lazy" style={{ backgroundColor: typeTint(m.types[0]) }} />
                <span className="body">
                  <span className="name">
                    <span className="no">{formatNo(m.id)}</span> {m.name}
                  </span>
                  <span className="types">
                    {m.types.map((t) => (
                      <TypeChip key={t} type={t} />
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
