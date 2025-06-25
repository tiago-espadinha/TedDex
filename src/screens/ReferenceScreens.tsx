import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { defensiveMultipliers, itemSpriteUrl, loadAbilities, loadEggGroups, loadIndex, loadItemPlaces, loadItemReference, loadMoveReference, loadMoves, loadTypes, loadVersions, offensiveMultipliers, useLoad } from '../data/api';
import { EGG_GROUP_COLOR, EGG_GROUP_NOTE } from '../data/eggGroups';
import { abilityFilterParams, activeAbilityFilters, filterAbilities, readAbilityFilters } from '../data/abilityFilter';
import { knownGame, shownGame } from '../data/game';
import { bandStyle } from '../data/gameColors';
import { learnerGames, learnersIn } from '../data/moveLearners';
import { useGame } from '../data/settings';
import { cap, formatMultiplier, formatNo, formatPrice, roman, signed } from '../data/format';
import { activeItemFilters, filterItems, itemFilterParams, readItemFilters } from '../data/itemFilter';
import { NATURES, STAT_ABBR, dislikedFlavor, flavorChip, likedFlavor, type Flavor } from '../data/natures';
import { activeMoveFilters, filterMoves, moveFilterParams, readMoveFilters } from '../data/moveFilter';
import { STAT_COLOR, typeChip, typeTint } from '../data/typeColors';
import type { IndexEntry, ItemInfo, ItemPlaceGame, ItemPlaces, LearnMethod, MoveInfo, MoveReference, TypeData, TypeName, VersionGroup } from '../data/types';
import { GamePicker, SharedGameSheet } from '../components/GamePicker';
import { Icon } from '../components/Icon';
import { CategoryIcon, CountBadge, Loading, MonName, SearchField, Segmented, TypeChip } from '../components/bits';
import { MonImg } from '../components/MonImg';
import { MoveCells, MoveHead } from './MovesTab';
import { AbilityFilterSheet } from './AbilityFilterSheet';
import { ItemFilterSheet } from './ItemFilterSheet';
import { MoveFilterSheet } from './MoveFilterSheet';

type Kind = 'moves' | 'abilities' | 'items' | 'natures' | 'types' | 'gyms' | 'league' | 'compare';

const KINDS: { kind: Kind; title: string; one: string; blurb: string }[] = [
  { kind: 'moves', title: 'Moves', one: 'Move', blurb: 'Power, accuracy, effect and who learns them' },
  { kind: 'abilities', title: 'Abilities', one: 'Ability', blurb: 'What each ability does and who has it' },
  { kind: 'items', title: 'Items', one: 'Item', blurb: 'Every item: what it does, its price and where to find it' },
  { kind: 'natures', title: 'Natures', one: 'Nature', blurb: 'Stats each nature raises and lowers, and flavours' },
  { kind: 'gyms', title: 'Gym Leaders', one: 'Gym Leader', blurb: "Every game's Gym teams, badges and rematches" },
  { kind: 'league', title: 'Elite Four & Champion', one: 'Elite Four', blurb: "Every game's league teams and movesets" },
  { kind: 'compare', title: 'Comparator', one: 'Comparator', blurb: 'Two Pokémon side by side: weaknesses, stats and size' },
  { kind: 'types', title: 'Types', one: 'Type', blurb: 'The full type chart' },
];

/** Menu look per kind: pixel-art sprites (a TM, Ability Capsule, Pomeg Berry, a Mint, Ultra Ball, Master Ball, Dowsing Machine, Rusted Sword over Shield). */
const MENU_LOOK: Record<Kind, { sprite: string; tint: TypeName }> = {
  moves: { sprite: '/media/guide/tm.webp', tint: 'psychic' },
  abilities: { sprite: itemSpriteUrl(685), tint: 'water' },
  items: { sprite: itemSpriteUrl(146), tint: 'fire' },
  natures: { sprite: '/media/guide/mint.webp', tint: 'grass' },
  gyms: { sprite: itemSpriteUrl(2), tint: 'electric' },
  league: { sprite: itemSpriteUrl(1), tint: 'poison' },
  compare: { sprite: itemSpriteUrl(465), tint: 'ice' },
  types: { sprite: '/media/guide/types.webp', tint: 'fighting' },
};

const STAT_NAMES = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

/** One row of a reference list; `move`, `item` and `type` pick a richer row. */
interface Entry {
  id: string;
  name: string;
  sub?: string;
  move?: MoveInfo;
  item?: ItemInfo;
  type?: TypeName;
  /** Generation that introduced it, for the generation filter (abilities). */
  gen?: number;
}

/** Kinds shown as a searchable list; natures and types are tables, the others have their own routes. */
type ListKind = Exclude<Kind, 'natures' | 'types' | 'gyms' | 'league' | 'compare'>;

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
/** Landing rows: each section's sprite (`public/media/items/` or `guide/`) on a type tint. */
const MENU = KINDS.map((k) => ({ to: `/reference/${k.kind}`, title: k.title, blurb: k.blurb, ...MENU_LOOK[k.kind] }));

export function ReferenceScreen() {
  return (
    <>
      <header className="dex-head">
        <h1>Guide</h1>
      </header>
      <nav className="list ref-menu" aria-label="Guide">
        {MENU.map((m) => (
          <Link key={m.to} to={m.to} className="team-row ref-kind" style={{ backgroundColor: typeTint(m.tint) }}>
            <img className="ref-art" src={m.sprite} alt="" />
            <div>
              <div className="name">{m.title}</div>
              <div className="meta">{m.blurb}</div>
            </div>
            <Icon name="next" size={20} />
          </Link>
        ))}
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
  // Moves, items and abilities also filter (moves sort too) in a sheet; their filters live in the URL next to the query.
  const moveFilters = useMemo(() => (k?.kind === 'moves' ? readMoveFilters(params) : undefined), [k?.kind, params]);
  const itemFilters = useMemo(() => (k?.kind === 'items' ? readItemFilters(params) : undefined), [k?.kind, params]);
  const abilityFilters = useMemo(() => (k?.kind === 'abilities' ? readAbilityFilters(params) : undefined), [k?.kind, params]);
  const moves = useMemo(() => (data ?? []).filter((e): e is MoveEntry => !!e.move), [data]);
  const items = useMemo(() => (data ?? []).filter((e): e is ItemEntry => !!e.item), [data]);
  // Only the generations that introduced an ability (III onwards) get a button in the sheet.
  const abilityGens = useMemo(() => [...new Set((data ?? []).map((e) => e.gen ?? 0))].filter(Boolean).sort(), [data]);
  const hasSheet = !!(moveFilters || itemFilters || abilityFilters);
  const shown = useMemo(() => {
    if (moveFilters) return filterMoves(moves, moveFilters);
    if (itemFilters) return filterItems(items, itemFilters);
    return filterAbilities(data ?? [], abilityFilters ?? { query, gens: [] });
  }, [data, moves, items, moveFilters, itemFilters, abilityFilters, query]);
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

  if (!k) return <p className="empty">Page not found.</p>;
  const filtered = moveFilters
    ? activeMoveFilters(moveFilters)
    : itemFilters
      ? activeItemFilters(itemFilters)
      : abilityFilters
        ? activeAbilityFilters(abilityFilters)
        : 0;
  const applyFilters = (next: Record<string, string>) => {
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <header className="topbar">
        <Link to="/reference" className="icon-btn" aria-label="Back to Guide">
          <Icon name="back" />
        </Link>
        <div className="head-title">
          <h1>{k.title}</h1>
          {data && <div className="sub">{filtered || query ? `${shown.length} of ${data.length}` : `${data.length} in the data`}</div>}
        </div>
        <SearchField label={`Search ${k.title.toLowerCase()}`} placeholder="Search" value={query} onChange={setQuery} hints={k.kind === 'moves' || k.kind === 'items' ? k.kind : undefined} />
      </header>
      {error && <p className="empty">Couldn't load {k.title.toLowerCase()}. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && !shown.length && (
        <p className="empty">{filtered ? `No ${k.title.toLowerCase()} match these filters.` : `No ${k.title.toLowerCase()} match “${query}”.`}</p>
      )}
      {shown.length > 0 && k.kind === 'moves' && <MoveHead />}
      {shown.length > 0 && (
        <ul className={`ref-list${hasSheet ? ' with-fab' : ''}${k.kind === 'moves' ? ' move-table' : ''}`}>
          {shown.map((e) => (
            <li key={e.id}>
              <Link
                to={`/reference/${k.kind}/${e.id}`}
                className={e.type ? 'move-row tinted' : 'move-row'}
                style={e.type && { backgroundColor: typeTint(e.type) }}
                data-morph={e.type ? undefined : `/reference/${k.kind}/${e.id}`}
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
            <CountBadge count={filtered} held={sheetOpen} />
          </button>
          {sheetOpen && moveFilters && (
            <MoveFilterSheet
              value={moveFilters}
              countFor={(f) => filterMoves(moves, f).length}
              onChange={(f) => applyFilters(moveFilterParams(f))}
              onClose={() => setSheetOpen(false)}
            />
          )}
          {sheetOpen && itemFilters && (
            <ItemFilterSheet
              value={itemFilters}
              countFor={(f) => filterItems(items, f).length}
              onChange={(f) => applyFilters(itemFilterParams(f))}
              onClose={() => setSheetOpen(false)}
            />
          )}
          {sheetOpen && abilityFilters && (
            <AbilityFilterSheet
              value={abilityFilters}
              gens={abilityGens}
              countFor={(f) => filterAbilities(data ?? [], f).length}
              onChange={(f) => applyFilters(abilityFilterParams(f))}
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
  if (e.move) return <MoveCells move={e.move} />;
  if (e.item) {
    return (
      <>
        <img className="item-sprite" src={itemSpriteUrl(e.id)} alt="" width={64} height={64} loading="lazy" />
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
  if (k.kind === 'natures' || k.kind === 'gyms' || k.kind === 'league' || k.kind === 'compare') {
    return <p className="empty">Page not found.</p>;
  }
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
  /** The list above has no rows to morph from (the type chart). */
  noMorph?: boolean;
  children?: ReactNode;
}

/** Topbar, then the body once loaded; the same loading, error and not-found states for every kind. */
function EntryFrame({ one, name, error, loaded, tint, head, art, noMorph, children }: FrameProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  let body = children;
  if (error) body = <p className="empty">Couldn't load this {one.toLowerCase()}. {error.message}</p>;
  else if (!loaded) body = <Loading />;
  else if (!name) body = <p className="empty">This {one.toLowerCase()} isn't in the data.</p>;
  return (
    <>
      {/* A morph target only once loaded: until then the title is the placeholder. */}
      <header className={tint ? 'topbar tinted' : 'topbar'} style={tint && { backgroundColor: typeTint(tint) }} data-morph={name && !noMorph ? pathname : undefined}>
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

/** `/reference/egg-groups/:group`, opened from a detail page's egg group chip: every species in the group. */
export function EggGroupEntry() {
  const { group = '' } = useParams();
  const { data, error } = useLoad(() => Promise.all([loadEggGroups(), loadIndex()]), 'egg-groups');
  const [groups, index] = data ?? [];
  const g = groups?.[group];
  const note = g && EGG_GROUP_NOTE[g.name];
  return (
    <EntryFrame one="Egg group" name={g?.name} error={error} loaded={!!data} tint={g && EGG_GROUP_COLOR[g.name]}>
      {g && index && (
        <>
          {note && (
            <div className="section">
              <p className="flavor">{note}</p>
            </div>
          )}
          <LearnerTable title="Pokémon" ids={g.species} index={index} />
        </>
      )}
    </EntryFrame>
  );
}

function MoveEntry({ id, one }: EntryProps) {
  const n = Number(id);
  const { data, error } = useLoad(
    () => Promise.all([loadMoves(), loadIndex(), loadVersions()]).then(async ([moves, index, versions]) => ({ moves, index, versions, ref: moves[n] && (await loadMoveReference(n)) })),
    n,
  );
  const move = data?.moves[n];
  const ref = data?.ref;
  return (
    <>
      <EntryFrame one={one} name={move?.name} error={error} loaded={!!data} tint={move?.type} head={move && <MoveFacts move={move} />}>
        {move && ref && data && (
          <>
            {ref.description && (
              <div className="section">
                <h2>Description</h2>
                <p className="flavor">{ref.description}</p>
              </div>
            )}
            <Effect text={ref.effect} />
            <MoveLearners name={move.name} learners={ref.learners} index={data.index} versions={data.versions} />
          </>
        )}
      </EntryFrame>
      <SharedGameSheet />
    </>
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

/** A move's header facts, on its page and in the quick view. */
export function MoveFacts({ move }: { move: MoveInfo }) {
  return (
    <Facts
      facts={[
        ['Type', <TypeChip key="type" type={move.type} />],
        [
          'Category',
          <span key="cat" className="cat-fact">
            <CategoryIcon category={move.category} decorative />
            {cap(move.category)}
          </span>,
        ],
        ['Power', move.power ?? '—'],
        ['Accuracy', move.accuracy ? `${move.accuracy}%` : '—'],
        ['PP', move.pp ?? '—'],
        ['Priority', signed(move.priority)],
      ]}
    />
  );
}

/** An item's header facts, on its page and in the quick view. */
export function ItemFacts({ item }: { item: ItemInfo }) {
  return (
    <Facts
      facts={[
        ['Category', item.category],
        ['Introduced', `Gen ${roman(item.gen)}`],
        ['Price', item.cost ? formatPrice(item.cost) : 'Not sold'],
      ]}
    />
  );
}

const LEARN_METHODS: [LearnMethod, string][] = [
  ['level', 'Level up'],
  ['machine', 'TM/HM'],
  ['tutor', 'Tutor'],
  ['egg', 'Egg move'],
];

/** Who learns the move in the shared game, one learn method at a time (a species can be in several). */
function MoveLearners({ name, learners, index, versions }: { name: string; learners: MoveReference['learners']; index: IndexEntry[]; versions: VersionGroup[] }) {
  const [stored] = useGame();
  const [pickMethod, setMethod] = useState<LearnMethod>('level');
  const games = learnerGames(
    learners,
    versions.map((v) => v.id),
  );
  if (!games.length) return <SpeciesList title="Learned by" ids={[]} index={index} none="No Pokémon learn it in the main-series games." />;

  const chosen = knownGame(stored, versions);
  const group = shownGame(games, chosen);
  if (group === undefined) {
    return (
      <div className="section">
        <h2>Learned by</h2>
        <GamePicker versions={versions} describedBy="learners-missing" />
        <p id="learners-missing" className="hint game-fallback">
          {name} isn't in {versions.find((v) => v.id === chosen)?.label}.
        </p>
      </div>
    );
  }

  const methods = LEARN_METHODS.filter(([m]) => learnersIn(learners, m, group).length > 0);
  const [method, title] = methods.find(([m]) => m === pickMethod) ?? methods[0];

  return (
    <>
      <div className="section">
        <h2>Learned by</h2>
        <GamePicker versions={versions} shows={group} />
        {methods.length > 1 && (
          <Segmented className="method-pick" aria-label="How they learn it">
            {methods.map(([m, label]) => (
              <button key={m} role="radio" aria-checked={m === method} onClick={() => setMethod(m)}>
                {label}
              </button>
            ))}
          </Segmented>
        )}
      </div>
      <LearnerTable title={title} ids={learnersIn(learners, method, group)} index={index} />
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
  const n = Number(id);
  const { data, error } = useLoad(
    () => Promise.all([loadItemReference(), loadIndex()]).then(async ([items, index]) => [items, index, items[n] && (await loadItemPlaces(n))] as const),
    n,
  );
  const item = data?.[0][n];
  return (
    <EntryFrame
      one={one}
      name={item?.name}
      error={error}
      loaded={!!data}
      head={item && <ItemFacts item={item} />}
      art={<img className="item-art" src={itemSpriteUrl(id)} alt="" width={64} height={64} />}
    >
      {item && data && (
        <>
          <Effect text={item.effect} />
          <WhereToFind places={data[2]} index={data[1]} />
        </>
      )}
    </EntryFrame>
  );
}

/** Where to get an item, one block per game (newest first): wild holders, then one-time and repeatable ways. */
function WhereToFind({ places, index }: { places: ItemPlaces; index: IndexEntry[] }) {
  const byId = useMemo(() => new Map(index.map((m) => [m.id, m])), [index]);
  return (
    <section className="section">
      <h2>Where to find</h2>
      {!places.games.length && <p className="hint">No known place to find it in the games.</p>}
      {places.games.map((g, i) => (
        <PlaceGame key={i} place={g} byId={byId} />
      ))}
    </section>
  );
}

function PlaceGame({ place, byId }: { place: ItemPlaceGame; byId: Map<number, IndexEntry> }) {
  const ways: [string, string][] = [
    ...(place.once ?? []).map((text): [string, string] => ['One time', text]),
    ...(place.repeat ?? []).map((text): [string, string] => ['Repeatable', text]),
  ];
  return (
    <div className="move-group place-game game-band" style={bandStyle(place.game)}>
      <h3>{place.game}</h3>
      {place.note?.map((text, i) => (
        <p key={i} className="flavor">
          {text}
        </p>
      ))}
      {(place.held || ways.length > 0) && (
        <ul>
          {place.held && (
            <li className="move-row place-row">
              <span className="body">
                <span className="meta">
                  <span>Held by wild Pokémon</span>
                </span>
                <span className="held-chips">
                  {place.held.map(([id, rarity]) => {
                    const m = byId.get(id);
                    return (
                      m && (
                        <Link key={id} className="held-chip" to={`/pokemon/${id}`}>
                          <MonImg id={id} alt="" width={32} height={32} loading="lazy" />
                          {m.name} <span className="pct">{rarity}%</span>
                        </Link>
                      )
                    );
                  })}
                </span>
              </span>
            </li>
          )}
          {ways.map(([kind, text], i) => (
            <li key={i} className="move-row place-row">
              <span className="body">
                <span className="meta">
                  <span>{kind}</span>
                </span>
                <span className="name">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Topbar for the table pages: back to Reference, title and a subtitle. */
function TableHead({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="topbar">
      <Link to="/reference" className="icon-btn" aria-label="Back to Guide">
        <Icon name="back" />
      </Link>
      <div className="grow">
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
    </header>
  );
}

/** A natures table cell: the stat or flavour as a coloured chip, or — for the neutral natures. */
function NatureCell({ text, color }: { text?: ReactNode; color?: string }) {
  return <td>{text ? <span className="fact-chip" style={{ backgroundColor: color }}>{text}</span> : '—'}</td>;
}

/** Stat names as a screen reader should say them. */
const STAT_SPOKEN = { atk: 'Attack', def: 'Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed' };

/** A raised or lowered stat, short so the five columns fit a phone, with its full name for screen readers. */
function NatureStat({ stat }: { stat?: keyof typeof STAT_NAMES }) {
  const text = stat && (
    <>
      <span aria-hidden="true">{STAT_ABBR[stat]}</span>
      <span className="sr-only">{STAT_SPOKEN[stat]}</span>
    </>
  );
  return <NatureCell text={text} color={stat && typeChip(STAT_COLOR[stat])} />;
}

function NatureFlavor({ flavor }: { flavor?: Flavor }) {
  return <NatureCell text={flavor} color={flavor && flavorChip(flavor)} />;
}

/** Every nature with the stat it raises and lowers and the flavours it likes and dislikes; neutral ones show —. */
function NatureTable() {
  return (
    <>
      <TableHead title="Natures" sub={`${NATURES.length} natures · ±10% to one stat`} />
      <div className="ref-table natures">
        <table>
          <thead>
            <tr>
              <th scope="col">Nature</th>
              <th scope="col" className="up">Increased</th>
              <th scope="col" className="down">Decreased</th>
              <th scope="col" className="up">Likes</th>
              <th scope="col" className="down">Dislikes</th>
            </tr>
          </thead>
          <tbody>
            {NATURES.map((n) => (
              <tr key={n.name}>
                <th scope="row">{n.name}</th>
                <NatureStat stat={n.up} />
                <NatureStat stat={n.down} />
                <NatureFlavor flavor={likedFlavor(n)} />
                <NatureFlavor flavor={dislikedFlavor(n)} />
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
    <EntryFrame one={one} name={type && cap(type)} error={error} loaded={!!data} tint={type} noMorph>
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
/** Species that learn a move as aligned columns: number, sprite, name, types. */
function LearnerTable({ title, ids, index }: { title: string; ids: number[]; index: IndexEntry[] }) {
  const byId = useMemo(() => new Map(index.map((m) => [m.id, m])), [index]);
  const mons = ids.map((id) => byId.get(id)).filter((m): m is IndexEntry => !!m);
  return (
    <section className="section ref-species">
      <h2>
        {title} · {mons.length}
      </h2>
      <div className="learner-head" aria-hidden="true">
        <span>No.</span>
        <span />
        <span>Pokémon</span>
        <span className="type">Type</span>
      </div>
      <ul className="learner-table">
        {mons.map((m) => (
          <li key={m.id}>
            <Link className="learner-row" to={`/pokemon/${m.id}`}>
              <span className="no">{formatNo(m.id)}</span>
              <MonImg id={m.id} alt="" width={40} height={40} loading="lazy" style={{ backgroundColor: typeTint(m.types[0]) }} />
              <span className="name">
                <MonName name={m.name} />
              </span>
              <span className="types">
                {m.types.map((t) => (
                  <TypeChip key={t} type={t} />
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
                <MonImg id={m.id} alt="" width={56} height={56} loading="lazy" style={{ backgroundColor: typeTint(m.types[0]) }} />
                <span className="body">
                  <span className="name">
                    <span className="no">{formatNo(m.id)}</span> <MonName name={m.name} />
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
