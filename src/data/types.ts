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
