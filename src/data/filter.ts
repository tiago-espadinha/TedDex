import type Fuse from 'fuse.js';
import type { DexFilters } from './dexState';
import { isTypeName } from './typeColors';
import type { IndexEntry } from './types';

/** Search + generation/type filters + sort, in that order. Pure, so it's easy to test. */
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
  if (f.types.length) list = list.filter((m) => f.types.every((t) => m.types.includes(t)));
  if (f.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  else if (f.sort === 'total') list = [...list].sort((a, b) => b.total - a.total || a.id - b.id);
  return list;
}
