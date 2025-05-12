import { useEffect, useState } from 'react';
import type { IndexEntry, SpeciesDetail, TypeData, TypeName } from './types';

/**
 * Data access. Everything is static JSON under /data (precached by the
 * service worker), so these are plain fetches memoised in memory.
 */
const memo = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  let p = memo.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`);
      return r.json() as Promise<T>;
    });
    p.catch(() => memo.delete(path));
    memo.set(path, p);
  }
  return p;
}

export const loadIndex = () => getJson<IndexEntry[]>('/data/index.json');
export const loadTypes = () => getJson<TypeData>('/data/types.json');
export const loadSpecies = (id: number) => getJson<SpeciesDetail>(`/data/species/${id}.json`);

/** Small hook: resolves a promise-returning loader, re-running when `key` changes. */
export function useLoad<T>(loader: () => Promise<T>, key: unknown): { data?: T; error?: Error } {
  const [state, setState] = useState<{ data?: T; error?: Error; key?: unknown }>({});
  useEffect(() => {
    let alive = true;
    loader().then(
      (data) => alive && setState({ data, key }),
      (error: Error) => alive && setState({ error, key }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state : {};
}

// ---- media (hot-linked from PokeAPI's sprite/cry repos, cached by the SW) ----
// TODO(phase 0 data build): mirror these into /media as WebP and M4A at build time.
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
export const spriteUrl = (id: number) => `${SPRITES}/${id}.png`;
export const artworkUrl = (id: number) => `${SPRITES}/other/official-artwork/${id}.png`;
export const cryUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;

// ---- type maths ----
export function defensiveMultipliers(defTypes: TypeName[], data: TypeData): Record<TypeName, number> {
  const out = {} as Record<TypeName, number>;
  for (const atk of data.types) {
    out[atk] = defTypes.reduce((acc, d) => acc * (data.matrix[atk]?.[d] ?? 1), 1);
  }
  return out;
}

