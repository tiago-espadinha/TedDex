import { searchByName } from './reference';
import { isTypeName } from './typeColors';
import type { MoveCategory, MoveInfo, TypeName } from './types';

/** Filters and sort of the Moves reference list. Kept in the URL (`?q=&cat=&gen=&type=&sort=`). Pure, for the tests. */
export type MoveSort = 'name' | 'power' | 'accuracy' | 'pp' | 'priority';

export interface MoveFilters {
  query: string;
  categories: MoveCategory[];
  gens: number[];
  types: TypeName[];
  sort: MoveSort;
}

export const MOVE_SORTS: Record<MoveSort, string> = { name: 'Name', power: 'Power', accuracy: 'Accuracy', pp: 'PP', priority: 'Priority' };
export const MOVE_CATEGORIES: MoveCategory[] = ['physical', 'special', 'status'];

const list = (raw: string | null) => (raw ? raw.split(',') : []);

export function readMoveFilters(params: URLSearchParams): MoveFilters {
  const sort = params.get('sort');
  return {
    query: params.get('q') ?? '',
    categories: list(params.get('cat')).filter((c): c is MoveCategory => MOVE_CATEGORIES.includes(c as MoveCategory)),
    gens: list(params.get('gen')).map(Number).filter((g) => g >= 1 && g <= 9),
    types: list(params.get('type')).filter(isTypeName),
    sort: sort && sort in MOVE_SORTS ? (sort as MoveSort) : 'name',
  };
}

/** The URL params for `f`, leaving out anything at its default. */
export function moveFilterParams(f: MoveFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.query) out.q = f.query;
  if (f.categories.length) out.cat = f.categories.join(',');
  if (f.gens.length) out.gen = f.gens.join(',');
  if (f.types.length) out.type = f.types.join(',');
  if (f.sort !== 'name') out.sort = f.sort;
  return out;
}

/** How many filters (not the query) are on, for the FAB badge. */
export const activeMoveFilters = (f: MoveFilters) => f.categories.length + f.gens.length + f.types.length + (f.sort !== 'name' ? 1 : 0);

/**
 * Highest first. A move that never misses (no accuracy) counts as the most accurate; moves without power or PP
 * go last.
 */
function sortValue(m: MoveInfo, sort: Exclude<MoveSort, 'name'>): number {
  switch (sort) {
    case 'power':
      return m.power ?? -1;
    case 'accuracy':
      return m.accuracy ?? 101;
    case 'pp':
      return m.pp ?? -1;
    case 'priority':
      return m.priority;
  }
}

/** Search (as the other Reference lists), then category, generation and type filters, then the sort. */
export function filterMoves<T extends { name: string; move: MoveInfo }>(entries: T[], f: MoveFilters): T[] {
  const hits = searchByName(entries, f.query).filter(
    ({ move }) =>
      (!f.categories.length || f.categories.includes(move.category)) &&
      (!f.gens.length || f.gens.includes(move.gen)) &&
      (!f.types.length || f.types.includes(move.type)),
  );
  if (f.sort === 'name') return hits;
  const sort = f.sort;
  return hits.sort((a, b) => sortValue(b.move, sort) - sortValue(a.move, sort) || a.name.localeCompare(b.name));
}
