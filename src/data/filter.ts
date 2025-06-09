import type Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import type { DexFilters, SortKey } from './dexState';
import { isTypeName } from './typeColors';
import type { FormKind, IndexEntry } from './types';

/**
 * A Dex row: a species, or one of its forms (`form`) with the form's types, stats and size. A form row keeps the
 * species' name, so it sorts by name right after it, and is told apart by `form.label`.
 */
export interface DexRow extends Omit<IndexEntry, 'forms'> {
  form?: { key: string; label: string; name: string; pokemonId: number };
}

/** The species, each followed by its forms of the kinds switched on, in dex order. Forms keep the species' number, generation and tags. */
export function dexRows(index: IndexEntry[], kinds: readonly FormKind[]): DexRow[] {
  const rows: DexRow[] = [];
  for (const { forms, ...mon } of index) {
    rows.push(mon);
    for (const { key, label, name, kind, pokemonId, ...shown } of forms ?? []) {
      if (kinds.includes(kind)) rows.push({ ...mon, ...shown, form: { key, label, name, pokemonId } });
    }
  }
  return rows;
}

/** Name search options, shared by DexScreen and the tests: a form row matches its full name too ("Alolan Vulpix"). */
export const FUSE_OPTIONS: IFuseOptions<DexRow> = { keys: ['name', 'form.name'], threshold: 0.3, ignoreLocation: true };

/** The number a sort orders by, highest first; undefined for number and name order. */
export function sortValue(m: DexRow, sort: SortKey): number | undefined {
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

/**
 * Search + category/generation/type filters + sort, in that order, over the species up to number `upTo` (the global
 * game's generation; all when undefined). Types match any of the chosen ones. Pure, so it's easy to test.
 */
export function applyFilters<T extends DexRow>(all: T[], fuse: Fuse<T> | null, f: DexFilters, upTo?: number): T[] {
  let list = upTo === undefined ? all : all.filter((m) => m.id <= upTo);
  const q = f.query.trim().toLowerCase();
  if (q) {
    const asNumber = q.replace(/^#/, '');
    if (/^\d+$/.test(asNumber)) {
      list = list.filter((m) => String(m.id).startsWith(String(Number(asNumber))));
    } else if (isTypeName(q)) {
      list = list.filter((m) => m.types.includes(q));
    } else if (fuse) {
      const hits = new Set(fuse.search(q).map((r) => r.item));
      list = list.filter((m) => hits.has(m));
    }
  }
  if (f.category) list = list.filter((m) => m.tags?.includes(f.category!));
  if (f.gens.length) list = list.filter((m) => f.gens.includes(m.gen));
  if (f.types.length) list = list.filter((m) => f.types.some((t) => m.types.includes(t)));
  if (f.sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === 'number') return list;
  return [...list].sort((a, b) => sortValue(b, f.sort)! - sortValue(a, f.sort)! || a.id - b.id);
}
