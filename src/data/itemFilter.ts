import { ITEM_CATEGORIES, type ItemCategory } from './itemCategories';
import { searchByName, searchKey } from './reference';
import type { ItemInfo } from './types';

/** Filters of the Items reference list. Kept in the URL (`?q=&cat=&gen=`). Pure, for the tests. */
export interface ItemFilters {
  query: string;
  categories: ItemCategory[];
  gens: number[];
}

/** Categories go in the URL as slugs: "Poké Balls" → "pokeballs". */
const slug = (c: ItemCategory) => searchKey(c);
const list = (raw: string | null) => (raw ? raw.split(',') : []);

export function readItemFilters(params: URLSearchParams): ItemFilters {
  const cats = list(params.get('cat'));
  return {
    query: params.get('q') ?? '',
    categories: ITEM_CATEGORIES.filter((c) => cats.includes(slug(c))),
    gens: list(params.get('gen')).map(Number).filter((g) => g >= 1 && g <= 9),
  };
}

/** The URL params for `f`, leaving out anything empty. */
export function itemFilterParams(f: ItemFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.query) out.q = f.query;
  if (f.categories.length) out.cat = f.categories.map(slug).join(',');
  if (f.gens.length) out.gen = f.gens.join(',');
  return out;
}

/** How many filters (not the query) are on, for the FAB badge. */
export const activeItemFilters = (f: ItemFilters) => f.categories.length + f.gens.length;

/** Names that open with a symbol (the 300 "★And15" Dynamax Crystals) go after the rest instead of first. */
const symbolFirst = (name: string) => Number(!/^[\p{L}\d]/u.test(name));

/** Search (as the other Reference lists), then category and generation (introduced) filters, each a union. */
export function filterItems<T extends { name: string; item: ItemInfo }>(entries: T[], f: ItemFilters): T[] {
  return searchByName(entries, f.query)
    .filter(({ item }) => (!f.categories.length || f.categories.includes(item.category)) && (!f.gens.length || f.gens.includes(item.gen)))
    .sort((a, b) => symbolFirst(a.name) - symbolFirst(b.name));
}
