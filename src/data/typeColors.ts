import type { TypeName } from './types';

/** The 18 types in game order. */
export const TYPE_NAMES: readonly TypeName[] = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

export const isTypeName = (s: string): s is TypeName => (TYPE_NAMES as readonly string[]).includes(s);

/**
 * Type colours are tokens in `src/styles.css` (`--type-<name>-chip`, `--type-<name>-tint`) so a
 * design can swap them. `chip` carries white text (all pass 4.5:1, see tests/type-colors.test.ts);
 * `tint` is the card background for that type.
 */
export const typeChip = (t: TypeName) => `var(--type-${t}-chip)`;
export const typeTint = (t: TypeName) => `var(--type-${t}-tint)`;
