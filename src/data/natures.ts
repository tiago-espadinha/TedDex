import type { StatBlock } from './types';

type Stat = Exclude<keyof StatBlock, 'hp'>;

export interface Nature {
  name: string;
  up?: Stat;
  down?: Stat;
}

/** The 25 natures, alphabetical. Neutral ones have no up/down. */
export const NATURES: Nature[] = [
  { name: 'Adamant', up: 'atk', down: 'spa' },
  { name: 'Bashful' },
  { name: 'Bold', up: 'def', down: 'atk' },
  { name: 'Brave', up: 'atk', down: 'spe' },
  { name: 'Calm', up: 'spd', down: 'atk' },
  { name: 'Careful', up: 'spd', down: 'spa' },
  { name: 'Docile' },
  { name: 'Gentle', up: 'spd', down: 'def' },
  { name: 'Hardy' },
  { name: 'Hasty', up: 'spe', down: 'def' },
  { name: 'Impish', up: 'def', down: 'spa' },
  { name: 'Jolly', up: 'spe', down: 'spa' },
  { name: 'Lax', up: 'def', down: 'spd' },
  { name: 'Lonely', up: 'atk', down: 'def' },
  { name: 'Mild', up: 'spa', down: 'def' },
  { name: 'Modest', up: 'spa', down: 'atk' },
  { name: 'Naive', up: 'spe', down: 'spd' },
  { name: 'Naughty', up: 'atk', down: 'spd' },
  { name: 'Quiet', up: 'spa', down: 'spe' },
  { name: 'Quirky' },
  { name: 'Rash', up: 'spa', down: 'spd' },
  { name: 'Relaxed', up: 'def', down: 'spe' },
  { name: 'Sassy', up: 'spd', down: 'spe' },
  { name: 'Serious' },
  { name: 'Timid', up: 'spe', down: 'atk' },
];

/** Each stat's flavour: a nature likes the flavour of the stat it raises and dislikes that of the one it lowers. */
const FLAVOR: Record<Stat, Flavor> = { atk: 'Spicy', def: 'Sour', spa: 'Dry', spd: 'Bitter', spe: 'Sweet' };
export const FLAVORS = ['Spicy', 'Dry', 'Sweet', 'Bitter', 'Sour'] as const;
export type Flavor = (typeof FLAVORS)[number];
/** Flavour chip colour (`--flavor-<name>` in `src/styles.css`, white text), the games' Pokéblock colours. */
export const flavorChip = (f: Flavor) => `var(--flavor-${f.toLowerCase()})`;
export const likedFlavor = (n: Nature) => (n.up && n.down ? FLAVOR[n.up] : undefined);
export const dislikedFlavor = (n: Nature) => (n.up && n.down ? FLAVOR[n.down] : undefined);

export const STAT_ABBR: Record<Stat, string> = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

/** "Adamant (+Atk −SpA)", or "Hardy (neutral)". */
export const natureLabel = (n: Nature) =>
  n.up && n.down ? `${n.name} (+${STAT_ABBR[n.up]} −${STAT_ABBR[n.down]})` : `${n.name} (neutral)`;
