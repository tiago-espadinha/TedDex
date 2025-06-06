/** A species' state in a Pokédex tracker; 0 (not seen) is never stored. */
export type DexState = 0 | 1 | 2 | 3;

export const DEX_STATE_LABELS = ['Not seen', 'Seen', 'Caught', 'Shiny'] as const;

/** Highest national dex number of each generation (index 0 = Gen 1); the last is the last species in public/data. */
const GEN_LAST = [151, 251, 386, 493, 649, 721, 809, 905, 1025];

/** Highest national dex number a Pokédex for generation `gen` lists; every species for any game (undefined). */
export function lastSpecies(gen?: number): number {
  if (gen === undefined) return GEN_LAST[GEN_LAST.length - 1];
  return GEN_LAST[Math.min(Math.max(gen, 1), GEN_LAST.length) - 1];
}

/** The state after a tap: not seen → seen → caught → shiny → not seen. */
export const nextState = (s: DexState): DexState => ((s + 1) % 4) as DexState;

export const isDexState = (v: unknown): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3;

/**
 * Counts for species 1 to `last`, the way the games count: seen includes caught and shiny, caught includes shiny.
 * States of species past `last` (from a later game the Pokédex was on) are kept but not counted.
 */
export function dexCounts(states: Record<number, DexState>, last: number) {
  const counts = { seen: 0, caught: 0, shiny: 0, total: last };
  for (const [id, s] of Object.entries(states)) {
    if (Number(id) > last) continue;
    counts.seen++;
    if (s >= 2) counts.caught++;
    if (s === 3) counts.shiny++;
  }
  return counts;
}
