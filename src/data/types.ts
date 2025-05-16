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
}

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
