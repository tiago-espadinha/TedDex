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

/** Quick categories in the order the filter sheet shows them. */
export const CATEGORY_LABELS: Record<Category, string> = {
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

/** The form kinds a stored "mega,gmax" list switches on; unknown words are ignored. */
export function parseFormKinds(raw: string | null): FormKind[] {
  const words = raw?.split(',') ?? [];
  return (Object.keys(FORM_KIND_LABELS) as FormKind[]).filter((k) => words.includes(k));
}

export interface DexFilters {
  query: string;
  gens: number[];
  types: TypeName[];
  sort: SortKey;
  /** One quick category at a time, combined with the other filters. */
  category: Category | null;
  /** The global game whose limit (species up to its generation) was lifted; another game brings a limit back. */
  liftedGame: number | null;
}

export const DEFAULT_FILTERS: DexFilters = { query: '', gens: [], types: [], sort: 'number', category: null, liftedGame: null };

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
