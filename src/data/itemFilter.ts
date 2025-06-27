import { ITEM_CATEGORIES, type ItemCategory } from './itemCategories';
import { searchEntries } from './query';
import { searchKey } from './reference';
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
    gens: list(params.get('gen'))
      .map(Number)
      .filter((g) => g >= 1 && g <= 9),
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

/**
 * The words a search takes for a category: its name, then the singulars and the parts of the names with an "&", which is
 * an operator ("tms & trs" still works, both sides being the same category). No "pokeball": it's the Poké Ball's name.
 */
export const ITEM_CATEGORY_WORDS: Record<string, ItemCategory> = {
  ...Object.fromEntries(ITEM_CATEGORIES.map((c) => [slug(c), c])),
  berry: 'Berries',
  balls: 'Poké Balls',
  battle: 'Battle items',
  battleitem: 'Battle items',
  held: 'Held items',
  helditem: 'Held items',
  megastone: 'Mega Stones',
  zcrystal: 'Z-Crystals',
  plate: 'Plates',
  memory: 'Memories',
  jewel: 'Jewels',
  terashard: 'Tera Shards',
  tm: 'TMs & TRs',
  tms: 'TMs & TRs',
  tr: 'TMs & TRs',
  trs: 'TMs & TRs',
  key: 'Key items',
  keyitem: 'Key items',
  treasure: 'Treasures',
  ingredient: 'Ingredients & materials',
  ingredients: 'Ingredients & materials',
  material: 'Ingredients & materials',
  materials: 'Ingredients & materials',
};

function itemKeyword(term: string): ((entry: { item: ItemInfo }) => boolean) | undefined {
  const category = ITEM_CATEGORY_WORDS[searchKey(term)];
  return category && (({ item }) => item.category === category);
}

/** Search (operators and keywords, query.ts), then category and generation (introduced) filters, each a union. */
export function filterItems<T extends { name: string; item: ItemInfo }>(entries: T[], f: ItemFilters): T[] {
  return searchEntries(entries, f.query, itemKeyword)
    .filter(
      ({ item }) =>
        (!f.categories.length || f.categories.includes(item.category)) && (!f.gens.length || f.gens.includes(item.gen)),
    )
    .sort((a, b) => symbolFirst(a.name) - symbolFirst(b.name));
}
