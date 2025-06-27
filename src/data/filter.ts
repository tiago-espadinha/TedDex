import type Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import type { DexCategory, DexFilters, SortKey } from './dexState';
import { compileQuery, parseQuery } from './query';
import { isTypeName } from './typeColors';
import type { FormKind, IndexEntry } from './types';

/**
 * A Dex row: a species, or one of its forms (`form`) with the form's types, stats and size. A form row keeps the
 * species' name, so it sorts by name right after it, and shows `form.name` as its title.
 */
export interface DexRow extends Omit<IndexEntry, 'forms'> {
  form?: { key: string; label: string; name: string; kind: FormKind; pokemonId: number };
}

/** The species, each followed by its forms of the kinds switched on, in dex order. Forms keep the species' number, generation and tags. */
export function dexRows(index: IndexEntry[], kinds: readonly FormKind[]): DexRow[] {
  const rows: DexRow[] = [];
  for (const { forms, ...mon } of index) {
    rows.push(mon);
    for (const { key, label, name, kind, pokemonId, ...shown } of forms ?? []) {
      if (kinds.includes(kind)) rows.push({ ...mon, ...shown, form: { key, label, name, kind, pokemonId } });
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

/** A favourite's key in the set `applyFilters` takes: the species id, then the form key for a form ("6:mega-x"). */
export const favouriteKey = (speciesId: number, formKey?: string) =>
  formKey ? `${speciesId}:${formKey}` : String(speciesId);

/** The words a search takes for each Category of the filter sheet. */
const CATEGORY_WORDS: Record<string, DexCategory> = {
  mega: 'mega',
  megas: 'mega',
  starter: 'starter',
  starters: 'starter',
  fossil: 'fossil',
  fossils: 'fossil',
  legendary: 'legendary',
  legendaries: 'legendary',
  mythical: 'mythical',
  mythicals: 'mythical',
  paradox: 'paradox',
  baby: 'baby',
  babies: 'baby',
  regional: 'regional',
  regionals: 'regional',
  eeveelution: 'eeveelution',
  eeveelutions: 'eeveelution',
  stone: 'stone',
  stones: 'stone',
  favourite: 'favourite',
  favourites: 'favourite',
};

const inCategory = (m: DexRow, category: DexCategory, favourites?: ReadonlySet<string>) =>
  category === 'favourite' ? !!favourites?.has(favouriteKey(m.id, m.form?.key)) : !!m.tags?.includes(category);

/** One search term's test: a number, a type, a Category, a generation, else a name. "!megas" drops the Mega rows, not Charizard. */
function dexTerm<T extends DexRow>(
  term: string,
  negated: boolean,
  fuse: Fuse<T> | null,
  favourites?: ReadonlySet<string>,
): (m: T) => boolean {
  const asNumber = term.replace(/^#/, '');
  if (/^\d+$/.test(asNumber)) return (m) => String(m.id).startsWith(String(Number(asNumber)));
  if (isTypeName(term)) return (m) => m.types.includes(term);
  const category = CATEGORY_WORDS[term];
  if (category) {
    if (negated && (category === 'mega' || category === 'regional')) return (m) => m.form?.kind === category;
    return (m) => inCategory(m, category, favourites);
  }
  const gen = /^gen(?:eration)?\s*([1-9])$/.exec(term);
  if (gen) return (m) => m.gen === Number(gen[1]);
  if (!fuse) return () => true;
  const hits = new Set(fuse.search(term).map((r) => r.item));
  return (m) => hits.has(m);
}

/**
 * Search + category/generation/type filters + sort, in that order. Types match any of the chosen ones. The Favourites
 * category keeps the rows whose species and form are in `favourites` (favouriteKey). Pure, so it's easy to test.
 */
export function applyFilters<T extends DexRow>(
  all: T[],
  fuse: Fuse<T> | null,
  f: DexFilters,
  favourites?: ReadonlySet<string>,
): T[] {
  let list = all;
  const query = parseQuery(f.query);
  if (query) list = list.filter(compileQuery<T>(query, (term, negated) => dexTerm(term, negated, fuse, favourites)));
  const category = f.category;
  if (category) list = list.filter((m) => inCategory(m, category, favourites));
  if (f.gens.length) list = list.filter((m) => f.gens.includes(m.gen));
  if (f.types.length) list = list.filter((m) => f.types.some((t) => m.types.includes(t)));
  if (f.sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === 'number') return list;
  return [...list].sort((a, b) => sortValue(b, f.sort)! - sortValue(a, f.sort)! || a.id - b.id);
}
