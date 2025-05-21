/** Shapes of the JSON produced by scripts/build-data.ts. Keep in sync with it. */

export type TypeName =
  | 'normal' | 'fighting' | 'flying' | 'poison' | 'ground' | 'rock'
  | 'bug' | 'ghost' | 'steel' | 'fire' | 'water' | 'grass'
  | 'electric' | 'psychic' | 'ice' | 'dragon' | 'dark' | 'fairy';

export interface IndexEntry {
  id: number;
  name: string;
  types: TypeName[];
  gen: number;
  total: number;
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
  heightM: number;
  weightKg: number;
  stats: StatBlock;
  abilities: { name: string; hidden: boolean }[];
  flavor: string;
  legendary: boolean;
  mythical: boolean;
  evolutionChainId: number | null;
  /** Battle forms, default first (key ''); absent when the species has none. */
  forms?: FormVariant[];
}

/** One form of a species: what changes in battle, plus the Pokémon id its media is stored under. */
export type FormVariant = Pick<SpeciesDetail, 'name' | 'types' | 'stats' | 'total' | 'abilities' | 'heightM' | 'weightKg'> & {
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

/** reference/moves/<id>.json: what a move does and the species that learn it in any game. */
export interface MoveReference {
  effect: string;
  species: number[];
}

/** reference/abilities.json: ability id → name, effect and the species that have it (any form). */
export type AbilityTable = Record<number, { name: string; effect: string; species: number[] }>;

/** reference/items.json: held item id → effect and the species that hold it in the wild. */
export type ItemReferenceTable = Record<number, { effect: string; species: number[] }>;

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
