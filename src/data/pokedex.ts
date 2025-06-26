import { searchKey } from './reference';
import { isTypeName } from './typeColors';
import type { Pokedexes, RegionalDex, TypeName } from './types';

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

/** A game's regional Pokédexes in the game's order; none for a game the data no longer has. */
export function gameDexes(data: Pokedexes, group: number): RegionalDex[] {
  return (data.groups[group] ?? []).flatMap((id) => data.dexes.find((d) => d.id === id) ?? []);
}

/** How many of `species` are caught (caught or shiny). */
export const caughtCount = (states: Record<number, DexState>, species: number[]) =>
  species.filter((id) => (states[id] ?? 0) >= 2).length;

/** One cell of a Pokédex view: the species and the number it has in that dex. */
export interface DexCell {
  id: number;
  no: number;
}

/** A tab of the Pokédex page: one of the game's regional dexes (`key` is its id) or National. */
export interface DexView {
  key: string;
  label: string;
  cells: DexCell[];
}

/** The game's regional dexes in order, numbered from their `first`, then National up to `last`. */
export function dexViews(regional: RegionalDex[], last: number): DexView[] {
  return [
    ...regional.map((d) => ({
      key: String(d.id),
      label: d.name,
      cells: d.species.map((id, i) => ({ id, no: d.first + i })),
    })),
    { key: 'national', label: 'National', cells: Array.from({ length: last }, (_, i) => ({ id: i + 1, no: i + 1 })) },
  ];
}

/** A custom Pokédex's one view: its species in national order, with their national numbers. */
export const customView = (species: number[]): DexView => ({
  key: 'custom',
  label: 'Custom',
  cells: [...species].sort((a, b) => a - b).map((id) => ({ id, no: id })),
});

/** State, type and search filters of the Pokédex page. Kept in the URL (`?q=&state=&type=`). */
export interface DexFilters {
  query: string;
  states: DexState[];
  types: TypeName[];
}

const list = (raw: string | null) => (raw ? raw.split(',') : []);

export function readDexFilters(params: URLSearchParams): DexFilters {
  return {
    query: params.get('q') ?? '',
    states: [
      ...new Set(
        list(params.get('state'))
          .filter((s) => /^[0-3]$/.test(s))
          .map(Number) as DexState[],
      ),
    ].sort(),
    types: list(params.get('type')).filter(isTypeName),
  };
}

/** The URL params for `f`, leaving out anything empty. */
export function dexFilterParams(f: DexFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.query) out.q = f.query;
  if (f.states.length) out.state = f.states.join(',');
  if (f.types.length) out.type = f.types.join(',');
  return out;
}

/** How many filters (not the query) are on, for the filter button's badge. */
export const activeDexFilters = (f: DexFilters) => f.states.length + f.types.length;

/**
 * Cells in any of the states and of any of the types (empty = no limit) whose name contains the query, or whose
 * number in the view is the query. Not-seen species match too: the page shows them as silhouettes.
 */
export function filterDexCells(
  cells: DexCell[],
  states: Record<number, DexState>,
  species: Map<number, { name: string; types: TypeName[] }>,
  f: DexFilters,
): DexCell[] {
  const q = searchKey(f.query);
  const no = /^\d+$/.test(q) ? Number(q) : undefined;
  return cells.filter(({ id, no: cellNo }) => {
    const s = species.get(id);
    return (
      (!f.states.length || f.states.includes(states[id] ?? 0)) &&
      (!f.types.length || (s?.types.some((t) => f.types.includes(t)) ?? false)) &&
      (!q || cellNo === no || (s !== undefined && searchKey(s.name).includes(q)))
    );
  });
}
