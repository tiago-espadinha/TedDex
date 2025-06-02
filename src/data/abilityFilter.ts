import { searchByName } from './reference';

/** Filters of the Abilities reference list. Kept in the URL (`?q=&gen=`). Pure, for the tests. */
export interface AbilityFilters {
  query: string;
  gens: number[];
}

export function readAbilityFilters(params: URLSearchParams): AbilityFilters {
  const gens = (params.get('gen') ?? '').split(',').filter(Boolean).map(Number);
  return { query: params.get('q') ?? '', gens: gens.filter((g) => g >= 1 && g <= 9) };
}

/** The URL params for `f`, leaving out anything empty. */
export function abilityFilterParams(f: AbilityFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.query) out.q = f.query;
  if (f.gens.length) out.gen = f.gens.join(',');
  return out;
}

/** How many filters (not the query) are on, for the FAB badge. */
export const activeAbilityFilters = (f: AbilityFilters) => f.gens.length;

/** Search (as the other Reference lists), then the generation that introduced it, a union. */
export function filterAbilities<T extends { name: string; gen?: number }>(entries: T[], f: AbilityFilters): T[] {
  const hits = searchByName(entries, f.query);
  return f.gens.length ? hits.filter((e) => e.gen && f.gens.includes(e.gen)) : hits;
}
