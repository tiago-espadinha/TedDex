import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  defensiveMultipliers, itemSpriteUrl, loadAbilities, loadIndex, loadItemReference, loadMoveReference, loadMoves, loadTypes,
  offensiveMultipliers, spriteUrl, useLoad,
} from '../data/api';
import { cap, formatMultiplier, formatNo, formatPrice, roman, signed } from '../data/format';
import { activeItemFilters, filterItems, itemFilterParams, readItemFilters } from '../data/itemFilter';
import { NATURES, dislikedFlavor, likedFlavor } from '../data/natures';
import { searchByName } from '../data/reference';
import { activeMoveFilters, filterMoves, moveFilterParams, readMoveFilters } from '../data/moveFilter';
import { typeChip, typeTint } from '../data/typeColors';
import type { IndexEntry, ItemInfo, LearnMethod, MoveInfo, MoveReference, TypeData, TypeName } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, SearchField, TypeChip } from '../components/bits';
import { MoveBody } from './MovesTab';
import { ItemFilterSheet } from './ItemFilterSheet';
import { MoveFilterSheet } from './MoveFilterSheet';

type Kind = 'moves' | 'abilities' | 'items' | 'natures' | 'types';

const KINDS: { kind: Kind; title: string; one: string; blurb: string }[] = [
  { kind: 'moves', title: 'Moves', one: 'Move', blurb: 'Power, accuracy, effect and who learns them' },
  { kind: 'abilities', title: 'Abilities', one: 'Ability', blurb: 'What each ability does and who has it' },
  { kind: 'items', title: 'Items', one: 'Item', blurb: 'Every item: what it does, its price and who holds it' },
  { kind: 'natures', title: 'Natures', one: 'Nature', blurb: 'Stats each nature raises and lowers, and flavours' },
  { kind: 'types', title: 'Types', one: 'Type', blurb: 'The full type chart' },
];

const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const STAT_NAMES = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

/** One row of a reference list; `move`, `item` and `type` pick a richer row. */
interface Entry {
  id: string;
  name: string;
  sub?: string;
  move?: MoveInfo;
  item?: ItemInfo;
  type?: TypeName;
  /** Generation that introduced it, for the generation chips (abilities). */
  gen?: number;
}

/** Kinds shown as a searchable list; natures and types are tables instead. */
type ListKind = Exclude<Kind, 'natures' | 'types'>;

async function loadEntries(kind: ListKind): Promise<Entry[]> {
  switch (kind) {
    case 'moves':
      return Object.entries(await loadMoves()).map(([id, move]) => ({ id, name: move.name, move }));
    case 'abilities':
      return Object.entries(await loadAbilities()).map(([id, a]) => ({ id, name: a.name, sub: a.effect, gen: a.gen }));
    case 'items':
      return Object.entries(await loadItemReference()).map(([id, item]) => ({ id, name: item.name, item }));
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
/** `/reference/:kind`: the natures table, the type chart, or a searchable list. */
export function ReferenceList() {
  const kind = useParams().kind;
  if (kind === 'natures') return <NatureTable />;
  if (kind === 'types') return <TypeMatrix />;
  return <SearchList />;
}

function SearchList() {
  const k = kindOf(useParams().kind);
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const { data, error } = useLoad(() => (k ? loadEntries(k.kind as ListKind) : Promise.resolve([])), k?.kind);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Moves and items also filter (moves sort too) in a sheet; their filters live in the URL next to the query.
  const moveFilters = useMemo(() => (k?.kind === 'moves' ? readMoveFilters(params) : undefined), [k?.kind, params]);
  const itemFilters = useMemo(() => (k?.kind === 'items' ? readItemFilters(params) : undefined), [k?.kind, params]);
  const moves = useMemo(() => (data ?? []).filter((e): e is MoveEntry => !!e.move), [data]);
  const items = useMemo(() => (data ?? []).filter((e): e is ItemEntry => !!e.item), [data]);
  const hasSheet = !!(moveFilters || itemFilters);
  // Lists whose entries carry a generation (abilities) get generation chips, kept in `?gen=`.
  const hasGens = !hasSheet && !!data?.some((e) => e.gen);
  const gens = useMemo(() => (params.get('gen') ?? '').split(',').filter(Boolean).map(Number), [params]);
  const shown = useMemo(() => {
    if (moveFilters) return filterMoves(moves, moveFilters);
    if (itemFilters) return filterItems(items, itemFilters);
    const hits = searchByName(data ?? [], query);
    return gens.length ? hits.filter((e) => e.gen && gens.includes(e.gen)) : hits;
  }, [data, moves, items, moveFilters, itemFilters, query, gens]);
  const setParam = (key: string, value: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const setQuery = (q: string) => setParam('q', q);
  const toggleGen = (g: number) =>
    setParam('gen', (gens.includes(g) ? gens.filter((x) => x !== g) : [...gens, g].sort()).join(','));

  if (!k) return <p className="empty">Page not found.</p>;
  const filtered = moveFilters ? activeMoveFilters(moveFilters) : itemFilters ? activeItemFilters(itemFilters) : gens.length;
  const applyFilters = (next: Record<string, string>) => {
    setParams(next, { replace: true });
    setSheetOpen(false);
    window.scrollTo({ top: 0 });
  };

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
      {hasGens && (
        <div className="chip-row" role="group" aria-label="Generation introduced">
          {GENS.map((g) => (
            <button key={g} className={gens.includes(g) ? 'filter-chip on' : 'filter-chip'} aria-pressed={gens.includes(g)} onClick={() => toggleGen(g)}>
              Gen {roman(g)}
            </button>
          ))}
        </div>
      )}
      {error && <p className="empty">Couldn't load {k.title.toLowerCase()}. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && !shown.length && (
        <p className="empty">{filtered ? `No ${k.title.toLowerCase()} match these filters.` : `No ${k.title.toLowerCase()} match “${query}”.`}</p>
      )}
      {shown.length > 0 && (
        <ul className={hasSheet ? 'ref-list with-fab' : 'ref-list'}>
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
      {hasSheet && (
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
          {sheetOpen && moveFilters && (
            <MoveFilterSheet
              value={moveFilters}
              countFor={(f) => filterMoves(moves, f).length}
              onApply={(f) => applyFilters(moveFilterParams(f))}
              onClose={() => setSheetOpen(false)}
            />
          )}
          {sheetOpen && itemFilters && (
            <ItemFilterSheet
              value={itemFilters}
              countFor={(f) => filterItems(items, f).length}
              onApply={(f) => applyFilters(itemFilterParams(f))}
              onClose={() => setSheetOpen(false)}
            />
          )}
        </>
      )}
    </>
  );
}

type MoveEntry = Entry & { move: MoveInfo };
type ItemEntry = Entry & { item: ItemInfo };

function EntryBody({ entry: e }: { entry: Entry }) {
  if (e.move) {
    return (
      <>
        <MoveBody move={e.move} />
        <TypeChip type={e.move.type} />
      </>
    );
  }
  if (e.item) {
    return (
      <>
        <img className="item-sprite" src={itemSpriteUrl(e.id)} alt="" width={40} height={40} loading="lazy" />
        <span className="body">
          <span className="name">{e.name}</span>
          <span className="meta one-line">{e.item.effect || e.item.category}</span>
        </span>
        <span className="price">
          {e.item.cost ? (
            formatPrice(e.item.cost)
          ) : (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">Not sold</span>
            </>
          )}
        </span>
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
  if (k.kind === 'natures') return <p className="empty">Page not found.</p>;
  const Page = { moves: MoveEntry, abilities: AbilityEntry, items: ItemEntry, types: TypeEntry }[k.kind];
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
  /** Picture at the end of the header (item sprites), once loaded. */
  art?: ReactNode;
  children?: ReactNode;
}

/** Topbar, then the body once loaded; the same loading, error and not-found states for every kind. */
function EntryFrame({ one, name, error, loaded, tint, head, art, children }: FrameProps) {
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
        {name && art}
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
      head={<Facts facts={facts} />}
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

/** Label-over-value facts in an entry header (moves, items). */
function Facts({ facts }: { facts: [string, ReactNode][] }) {
  return (
    <dl className="head-facts">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
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
          {ability.details && ability.details !== ability.effect && <Effect title="Details" text={ability.details} />}
          <SpeciesList title="Pokémon with it" ids={ability.species} index={data[1]} none="No Pokémon have it." />
        </>
      )}
    </EntryFrame>
  );
}

function ItemEntry({ id, one }: EntryProps) {
  const { data, error } = useLoad(() => Promise.all([loadItemReference(), loadIndex()]), 'items');
  const item = data?.[0][Number(id)];
  const facts: [string, ReactNode][] = item
    ? [
        ['Category', item.category],
        ['Introduced', `Gen ${roman(item.gen)}`],
        ['Price', item.cost ? formatPrice(item.cost) : 'Not sold'],
      ]
    : [];
  return (
    <EntryFrame
      one={one}
      name={item?.name}
      error={error}
      loaded={!!data}
      head={<Facts facts={facts} />}
      art={<img className="item-art" src={itemSpriteUrl(id)} alt="" width={64} height={64} />}
    >
      {item && data && (
        <>
          <Effect text={item.effect} />
          <SpeciesList title="Held in the wild by" ids={item.species} index={data[1]} none="No Pokémon hold it in the wild." />
        </>
      )}
    </EntryFrame>
  );
}

/** Topbar for the table pages: back to Reference, title and a subtitle. */
function TableHead({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="topbar">
      <Link to="/reference" className="icon-btn" aria-label="Back to Reference">
        <Icon name="back" />
      </Link>
      <div className="grow">
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
    </header>
  );
}

/** Every nature with the stat it raises and lowers and the flavours it likes and dislikes; neutral ones show —. */
function NatureTable() {
  return (
    <>
      <TableHead title="Natures" sub={`${NATURES.length} natures · ±10% to one stat`} />
      <div className="ref-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Nature</th>
              <th scope="col">Increased</th>
              <th scope="col">Decreased</th>
              <th scope="col">Likes</th>
              <th scope="col">Dislikes</th>
            </tr>
          </thead>
          <tbody>
            {NATURES.map((n) => (
              <tr key={n.name}>
                <th scope="row">{n.name}</th>
                <td className={n.up && 'up'}>{n.up ? STAT_NAMES[n.up] : '—'}</td>
                <td className={n.down && 'down'}>{n.down ? STAT_NAMES[n.down] : '—'}</td>
                <td>{likedFlavor(n) ?? '—'}</td>
                <td>{dislikedFlavor(n) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Short column labels so 18 columns fit a phone with a little sideways scrolling. */
const TYPE_ABBR = (t: TypeName) => t.slice(0, 3).toUpperCase();

/** The full type chart: attacking type per row, defending type per column; blank cells are 1×. */
function TypeMatrix() {
  const { data, error } = useLoad(loadTypes, 'types');
  return (
    <>
      <TableHead title="Types" sub="Attacking type down the side, defending along the top" />
      {error && <p className="empty">Couldn't load the type chart. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && (
        <div className="type-matrix" tabIndex={0} role="region" aria-label="Type chart">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Attacking ↓ / defending →</span>
                </th>
                {data.types.map((def) => (
                  <th scope="col" key={def}>
                    <abbr title={cap(def)} style={{ backgroundColor: typeChip(def) }}>
                      {TYPE_ABBR(def)}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.types.map((atk) => (
                <tr key={atk}>
                  <th scope="row">
                    <Link to={`/reference/types/${atk}`} style={{ backgroundColor: typeChip(atk) }}>
                      {cap(atk)}
                    </Link>
                  </th>
                  {data.types.map((def) => {
                    const m = data.matrix[atk][def] ?? 1;
                    return (
                      <td key={def} className={matchupClass(m)} aria-label={`${cap(atk)} on ${cap(def)}: ${m}×`}>
                        {formatMultiplier(m)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Attacking view, as in team coverage: super effective is good (green), resisted warm, immune grey. */
const matchupClass = (m: number) => (m > 1 ? 'super' : m === 0 ? 'immune' : m < 1 ? 'resisted' : undefined);

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
