import { useCallback, useState } from 'react';
import type { Category, StatBlock, TypeName } from './types';

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

export interface DexFilters {
  query: string;
  gens: number[];
  types: TypeName[];
  sort: SortKey;
  /** One quick category at a time, combined with the other filters. */
  category: Category | null;
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

/** The visible list order, so the detail page's previous/next follows it. */
export function saveOrder(ids: number[]) {
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function neighbours(id: number): { prev?: number; next?: number } {
  try {
    const ids = JSON.parse(sessionStorage.getItem(ORDER_KEY) ?? '[]') as number[];
    const i = ids.indexOf(id);
    if (i >= 0) return { prev: ids[i - 1], next: ids[i + 1] };
  } catch {
    /* fall through */
  }
  return { prev: id > 1 ? id - 1 : undefined, next: id + 1 };
}
