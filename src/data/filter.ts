import type Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import type { DexFilters, SortKey } from './dexState';
import { isTypeName } from './typeColors';
import type { IndexEntry } from './types';

/** Name search options, shared by DexScreen and the tests. */
export const FUSE_OPTIONS: IFuseOptions<IndexEntry> = { keys: ['name'], threshold: 0.3, ignoreLocation: true };

/** The number a sort orders by, highest first; undefined for number and name order. */
export function sortValue(m: IndexEntry, sort: SortKey): number | undefined {
  switch (sort) {
    case 'number':
    case 'name':
      return undefined;
    case 'total':
      return m.total;
    case 'height':
      return m.heightM;
    case 'weight':
      return m.weightKg;
    default:
      return m.stats[sort];
  }
}

/** Search + generation/type filters + sort, in that order. Types match any of the chosen ones. Pure, so it's easy to test. */
export function applyFilters(all: IndexEntry[], fuse: Fuse<IndexEntry> | null, f: DexFilters): IndexEntry[] {
  let list = all;
  const q = f.query.trim().toLowerCase();
  if (q) {
    const asNumber = q.replace(/^#/, '');
    if (/^\d+$/.test(asNumber)) {
      list = list.filter((m) => String(m.id).startsWith(String(Number(asNumber))));
    } else if (isTypeName(q)) {
      list = list.filter((m) => m.types.includes(q));
    } else if (fuse) {
      const hits = new Set(fuse.search(q).map((r) => r.item.id));
      list = list.filter((m) => hits.has(m.id));
    }
  }
  if (f.gens.length) list = list.filter((m) => f.gens.includes(m.gen));
  if (f.types.length) list = list.filter((m) => f.types.some((t) => m.types.includes(t)));
  if (f.sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === 'number') return list;
  return [...list].sort((a, b) => sortValue(b, f.sort)! - sortValue(a, f.sort)! || a.id - b.id);
}
