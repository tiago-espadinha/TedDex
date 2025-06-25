import { useCallback, useState } from 'react';
import type { Category, FormKind, StatBlock, TypeName } from './types';

/** Dex list filters. Kept in sessionStorage so they survive opening a detail page. */
export type SortKey = 'number' | 'name' | 'total' | keyof StatBlock | 'height' | 'weight';

/** Sort options in the order the filter sheet shows them. */
export const SORT_LABELS: Record<SortKey, string> = {
  number: 'Number',
  name: 'Name',
  total: 'Base total',
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
  height: 'Height',
  weight: 'Weight',
};

/** A Dex category: a data tag, or the user's favourites. */
export type DexCategory = Category | 'favourite';

/** Quick categories in the order the filter sheet shows them. */
export const CATEGORY_LABELS: Record<DexCategory, string> = {
  favourite: 'Favourites',
  starter: 'Starters',
  mega: 'Megas',
  fossil: 'Fossils',
  eeveelution: 'Eeveelutions',
  legendary: 'Legendaries',
  mythical: 'Mythicals',
  regional: 'Regional forms',
  baby: 'Babies',
  paradox: 'Paradox',
  stone: 'Stone evolutions',
};

/** The Settings switches that add forms as Dex rows, in the order Settings shows them. */
export const FORM_KIND_LABELS: Record<FormKind, string> = {
  mega: 'Megas & Primals',
  regional: 'Regional forms',
  gmax: 'Gigantamax',
  other: 'Other battle forms',
};

/** The form each of those switches shows as its example: Mega Charizard X, Alolan Vulpix, Gigantamax Charizard, Blade Aegislash. */
export const FORM_KIND_EXAMPLES: Record<FormKind, { id: number; speciesId: number }> = {
  mega: { id: 10034, speciesId: 6 },
  regional: { id: 10103, speciesId: 37 },
  gmax: { id: 10196, speciesId: 6 },
  other: { id: 10026, speciesId: 681 },
};

/** The Pokémon the Settings art style tiles draw: Pikachu. */
export const ART_STYLE_EXAMPLE = 25;

/** The form kinds shown before any choice is stored: all but Gigantamax. */
export const DEFAULT_FORM_KINDS: FormKind[] = ['mega', 'regional', 'other'];

/** The form kinds a stored "mega,gmax" list switches on (none for ''); unknown words are ignored; nothing stored gives the defaults. */
export function parseFormKinds(raw: string | null): FormKind[] {
  if (raw == null) return DEFAULT_FORM_KINDS;
  const words = raw.split(',');
  return (Object.keys(FORM_KIND_LABELS) as FormKind[]).filter((k) => words.includes(k));
}

/** Whether a Dex URL's search is pick mode: adding to a team (`pick=<team>`) or picking a Compare side (`compare=a|b`). */
export function isPicking(params: URLSearchParams): boolean {
  const team = params.get('pick');
  return (team != null && /^\d+$/.test(team)) || params.get('compare') === 'a' || params.get('compare') === 'b';
}

export interface DexFilters {
  query: string;
  gens: number[];
  types: TypeName[];
  sort: SortKey;
  /** One quick category at a time, combined with the other filters. */
  category: DexCategory | null;
}

export const DEFAULT_FILTERS: DexFilters = { query: '', gens: [], types: [], sort: 'number', category: null };

const KEY = 'dex-filters';
const ORDER_KEY = 'dex-order';

function read(): DexFilters {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function useDexFilters() {
  const [filters, setFilters] = useState<DexFilters>(read);
  const update = useCallback((next: DexFilters) => {
    setFilters(next);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, []);
  return [filters, update] as const;
}

/** A species' detail page, in form `formKey` when given. */
export const detailPath = (id: number, formKey?: string) =>
  `/pokemon/${id}${formKey ? `?${new URLSearchParams({ form: formKey })}` : ''}`;

/** The visible rows' detail paths in list order, so the detail page's previous/next follows it. */
export function saveOrder(paths: string[]) {
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(paths));
  } catch {
    /* ignore */
  }
}

/**
 * The detail paths before and after this species (in form `formKey`) in the saved order. A form that isn't a row
 * (picked on the detail page) steps from its species' row; without a saved row, from the neighbouring numbers.
 */
export function neighbours(id: number, formKey?: string): { prev?: string; next?: string } {
  try {
    const paths = JSON.parse(sessionStorage.getItem(ORDER_KEY) ?? '[]') as unknown[];
    let i = paths.indexOf(detailPath(id, formKey));
    if (i < 0) i = paths.indexOf(detailPath(id));
    if (i >= 0) return { prev: paths[i - 1] as string | undefined, next: paths[i + 1] as string | undefined };
  } catch {
    /* fall through */
  }
  return { prev: id > 1 ? detailPath(id - 1) : undefined, next: detailPath(id + 1) };
}
