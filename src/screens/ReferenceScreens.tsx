import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  defensiveMultipliers, loadAbilities, loadIndex, loadItemReference, loadItems, loadMoveReference, loadMoves, loadTypes,
  offensiveMultipliers, spriteUrl, useLoad,
} from '../data/api';
import { cap, formatNo } from '../data/format';
import { NATURES } from '../data/natures';
import { searchByName } from '../data/reference';
import { typeTint } from '../data/typeColors';
import type { IndexEntry, MoveInfo, TypeData, TypeName } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, SearchField, TypeChip } from '../components/bits';
import { MoveBody } from './MovesTab';

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
  const shown = useMemo(() => searchByName(data ?? [], query), [data, query]);

  if (!k) return <p className="empty">Page not found.</p>;

  return (
    <>
      <header className="topbar">
        <Link to="/reference" className="icon-btn" aria-label="Back to Reference">
          <Icon name="back" />
        </Link>
        <div className="head-title">
          <h1>{k.title}</h1>
          {data && <div className="sub">{data.length} in the data</div>}
        </div>
        <SearchField
          label={`Search ${k.title.toLowerCase()}`}
          placeholder="Search"
          value={query}
          onChange={(q) => setParams(q ? { q } : {}, { replace: true })}
        />
      </header>
      {error && <p className="empty">Couldn't load {k.title.toLowerCase()}. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && !shown.length && <p className="empty">No {k.title.toLowerCase()} match “{query}”.</p>}
      {shown.length > 0 && (
        <ul className="ref-list">
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
    </>
  );
}

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
  children?: ReactNode;
}

/** Topbar, then the body once loaded; the same loading, error and not-found states for every kind. */
function EntryFrame({ one, name, error, loaded, tint, children }: FrameProps) {
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
  return (
    <EntryFrame one={one} name={move?.name} error={error} loaded={!!data} tint={move?.type}>
      {move && data?.[2] && (
        <>
          <div className="section">
            <div className="facts">
              <Fact k="Type"><TypeChip type={move.type} large /></Fact>
              <Fact k="Category">{cap(move.category)}</Fact>
              <Fact k="Power">{move.power ?? '—'}</Fact>
              <Fact k="Accuracy">{move.accuracy ? `${move.accuracy}%` : '—'}</Fact>
              <Fact k="PP">{move.pp ?? '—'}</Fact>
            </div>
          </div>
          <Effect text={data[2].effect} />
          <SpeciesList title="Learned by" ids={data[2].species} index={data[1]} none="No Pokémon learn it in the main-series games." />
        </>
      )}
    </EntryFrame>
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

function Effect({ text }: { text: string }) {
  return (
    <div className="section">
      <h2>Effect</h2>
      <p className="flavor">{text || 'No description in the data yet.'}</p>
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
