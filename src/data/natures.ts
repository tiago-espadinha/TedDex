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

const SHORT: Record<Stat, string> = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

/** "Adamant (+Atk −SpA)", or "Hardy (neutral)". */
export const natureLabel = (n: Nature) =>
  n.up && n.down ? `${n.name} (+${SHORT[n.up]} −${SHORT[n.down]})` : `${n.name} (neutral)`;
