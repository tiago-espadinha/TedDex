import type { ItemInfo, MoveInfo, TypeName } from '../../data/types';

export type Kind = 'moves' | 'abilities' | 'items' | 'natures' | 'types' | 'gyms' | 'league' | 'compare';

export const KINDS: { kind: Kind; title: string; one: string; blurb: string }[] = [
  { kind: 'moves', title: 'Moves', one: 'Move', blurb: 'Power, accuracy, effect and who learns them' },
  { kind: 'abilities', title: 'Abilities', one: 'Ability', blurb: 'What each ability does and who has it' },
  { kind: 'items', title: 'Items', one: 'Item', blurb: 'Every item: what it does, its price and where to find it' },
  { kind: 'natures', title: 'Natures', one: 'Nature', blurb: 'Stats each nature raises and lowers, and flavours' },
  { kind: 'gyms', title: 'Gym Leaders', one: 'Gym Leader', blurb: "Every game's Gym teams, badges and rematches" },
  {
    kind: 'league',
    title: 'Elite Four & Champion',
    one: 'Elite Four',
    blurb: "Every game's league teams and movesets",
  },
  {
    kind: 'compare',
    title: 'Comparator',
    one: 'Comparator',
    blurb: 'Two Pokémon side by side: weaknesses, stats and size',
  },
  { kind: 'types', title: 'Types', one: 'Type', blurb: 'The full type chart' },
];

/** One row of a reference list; `move`, `item` and `type` pick a richer row. */
export interface Entry {
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
export type ListKind = Exclude<Kind, 'natures' | 'types' | 'gyms' | 'league' | 'compare'>;

export const kindOf = (param?: string) => KINDS.find((k) => k.kind === param);

export type MoveEntry = Entry & { move: MoveInfo };

export type ItemEntry = Entry & { item: ItemInfo };
