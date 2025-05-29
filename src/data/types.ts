/** Shapes of the JSON produced by scripts/build-data.ts. Keep in sync with it. */
import type { ItemCategory } from './itemCategories';

export type TypeName =
  | 'normal' | 'fighting' | 'flying' | 'poison' | 'ground' | 'rock'
  | 'bug' | 'ghost' | 'steel' | 'fire' | 'water' | 'grass'
  | 'electric' | 'psychic' | 'ice' | 'dragon' | 'dark' | 'fairy';

/** Quick categories on the Dex chip bar. */
export type Category =
  | 'starter' | 'mega' | 'fossil' | 'eeveelution' | 'legendary' | 'mythical' | 'regional' | 'baby' | 'paradox' | 'stone';

export interface IndexEntry {
  id: number;
  name: string;
  types: TypeName[];
  gen: number;
  total: number;
  stats: StatBlock;
  heightM: number;
  weightKg: number;
  /** Absent when the species is in no category. */
  tags?: Category[];
}

export interface StatBlock {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface SpeciesDetail extends IndexEntry {
  slug: string;
  genus: string;
  /** `id` is the reference/abilities.json id. */
  abilities: { id: number; name: string; hidden: boolean }[];
  flavor: string;
  catchRate: number;
  /** Effort values a defeated Pokémon gives; only the stats it gives any in. */
  evYield: Partial<StatBlock>;
  /** In-game name, e.g. "Medium Slow". */
  growthRate: string;
  /** In-game names, e.g. ["Monster", "Grass"]; ["Undiscovered"] for those that can't breed. */
  eggGroups: string[];
  /** Female share in eighths (0 = always male, 8 = always female); -1 when genderless. */
  genderRate: number;
  legendary: boolean;
  mythical: boolean;
  evolutionChainId: number | null;
  /** Battle forms, default first (key ''); absent when the species has none. */
  forms?: FormVariant[];
}

/** One form of a species: what changes in battle, plus the Pokémon id its media is stored under. */
export type FormVariant = Pick<SpeciesDetail, 'name' | 'types' | 'stats' | 'total' | 'abilities' | 'heightM' | 'weightKg' | 'evYield'> & {
  pokemonId: number;
  /** Unique within the species, used in `?form=`; '' for the default form. */
  key: string;
  /** Short chip label, e.g. "Mega X". */
  label: string;
};

export interface TypeData {
  types: TypeName[];
  /** matrix[attacker][defender] = damage factor (0, 0.5, 1, 2) */
  matrix: Record<TypeName, Record<TypeName, number>>;
}

export type MoveCategory = 'physical' | 'special' | 'status';

export interface MoveInfo {
  name: string;
  type: TypeName;
  category: MoveCategory;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  /** -7 to +5; 0 for most moves. */
  priority: number;
  /** Generation that introduced it. */
  gen: number;
}

/** moves.json: move id → move. */
export type MoveTable = Record<number, MoveInfo>;

/** versions.json: main-series version groups with learnsets, oldest first. */
export interface VersionGroup {
  id: number;
  label: string;
  gen: number;
}

/** One game's learnset. Level 0 means "learned on evolution". */
export interface Learnset {
  level: [moveId: number, level: number][];
  machine: number[];
  tutor: number[];
  egg: number[];
}

/** learnsets/<id>.json: version group id → learnset (only games the species is in). */
export type Learnsets = Record<number, Learnset>;

/** evolution/<chainId>.json: chain members in tree order (each parent before its children). */
export interface EvolutionMember {
  id: number;
  /** Species it evolves from; null for the chain's base. */
  from: number | null;
  /** English condition text, one entry per distinct method. Empty for the base. */
  conditions: string[];
}

/** items.json: held item id → English name. */
export type ItemTable = Record<number, string>;

/** Learn methods, as in a learnset. */
export type LearnMethod = keyof Learnset;

/**
 * reference/moves/<id>.json: the in-game description, the full effect (paragraphs split by a blank line), and
 * who learns it: per method, [species id, bitmask of generations (bit n-1 = Gen n)], default forms, by species id.
 */
export interface MoveReference {
  description: string;
  effect: string;
  learners: Partial<Record<LearnMethod, [species: number, gens: number][]>>;
}

/**
 * reference/abilities.json: ability id → name, short effect, full details (paragraphs split by a blank line; may
 * be empty), the generation that introduced it and the species that have it (any form).
 */
export type AbilityTable = Record<number, { name: string; effect: string; details: string; gen: number; species: number[] }>;

/**
 * reference/items.json: item id → name, category, the generation that introduced it, price (0 when it can't be
 * bought), short effect and the wild Pokémon that hold it. Every named item, held or not.
 */
export type ItemReferenceTable = Record<number, ItemInfo>;

export interface ItemInfo {
  name: string;
  category: ItemCategory;
  gen: number;
  cost: number;
  effect: string;
  /** Wild holders: [version group (see versions.json), species, chance in percent], oldest game first. */
  wild: [versionGroup: number, species: number, rarity: number][];
}

/**
 * reference/places/<id>.json: where to find an item, newest game first ("Other" last). `held` is PokeAPI's wild
 * holders as [species, chance in percent]; `once` and `repeat` are Bulbapedia's one-time and repeatable ways as
 * text, and `source` is the Bulbapedia page they come from (absent when the page gave nothing).
 */
export interface ItemPlaces {
  source?: string;
  games: ItemPlaceGame[];
}

export interface ItemPlaceGame {
  game: string;
  held?: [species: number, rarity: number][];
  once?: string[];
  repeat?: string[];
  /** Bulbapedia's text when the page describes acquisition in prose rather than a table (game "Other"). */
  note?: string[];
}

/** games.json: games (versions, not version groups) with encounter data, oldest first. */
export interface Game {
  id: number;
  label: string;
  gen: number;
}

/**
 * One area and method in one game. Text fields are indexes into `Locations.strings` (0 = none);
 * `rate` is the chance in percent under the best conditions (0 when unknown), and `upTo` is 1 when it depends on them.
 */
export type EncounterRow = [area: number, method: number, min: number, max: number, rate: number, upTo: 0 | 1, note: number, form: number];

/** locations/<id>.json: wild encounters per game id (only games the species appears in). */
export interface Locations {
  strings: string[];
  games: Record<number, EncounterRow[]>;
}

/** league/index.json: games with Elite Four and Champion teams, oldest first. */
export interface LeagueSummary {
  id: string;
  label: string;
  region: string;
  gen: number;
}

/** One Pokémon on a league trainer's team. Ids point into the shared tables (index, abilities, items, moves). */
export interface LeagueMember {
  id: number;
  /** Form key as in `SpeciesDetail.forms` (regional and other battle forms); absent for the default form. */
  form?: string;
  level: number;
  ability?: number;
  /** items.json id. */
  item?: number;
  moves: number[];
  tera?: TypeName;
  /** Form key it changes into during the battle: Mega Evolution or Gigantamax. */
  battleForm?: string;
}

/** A trainer's team; `label` names the condition when the team depends on the player's choices. */
export interface LeagueTeam {
  label?: string;
  members: LeagueMember[];
}

/** A later battle against the same trainer (post-game rematch or title defense); `label` comes from the page heading. */
export interface LeagueRematch {
  label: string;
  teams: LeagueTeam[];
}

export interface LeagueTrainer {
  name: string;
  /** "Elite Four", "Champion", or the Champion Cup round. */
  role: string;
  type?: TypeName;
  /** File name under media/trainers/ without extension; absent when Bulbapedia has no sprite. */
  sprite?: string;
  /** Bulbapedia page the team comes from. */
  source: string;
  teams: LeagueTeam[];
  /** In battle order; absent when the game has no rematch with this trainer. */
  rematches?: LeagueRematch[];
}

/** league/<id>.json: one game's Elite Four and Champion in battle order. */
export interface LeagueGame extends LeagueSummary {
  note?: string;
  trainers: LeagueTrainer[];
}
