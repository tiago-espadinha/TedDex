import { useEffect, useState } from 'react';
import type {
  AbilityTable, EvolutionMember, Game, IndexEntry, ItemReferenceTable, ItemTable, LeagueGame, LeagueSummary, Learnsets, Locations,
  MoveReference, MoveTable, SpeciesDetail, TypeData, TypeName, VersionGroup,
} from './types';

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
export const loadLearnsets = (id: number) => getJson<Learnsets>(`/data/learnsets/${id}.json`);
export const loadMoves = () => getJson<MoveTable>('/data/moves.json');
export const loadVersions = () => getJson<VersionGroup[]>('/data/versions.json');
export const loadItems = () => getJson<ItemTable>('/data/items.json');
export const loadEvolution = (chainId: number) => getJson<EvolutionMember[]>(`/data/evolution/${chainId}.json`);
export const loadLocations = (id: number) => getJson<Locations>(`/data/locations/${id}.json`);
export const loadGames = () => getJson<Game[]>('/data/games.json');
export const loadMoveReference = (id: number) => getJson<MoveReference>(`/data/reference/moves/${id}.json`);
export const loadAbilities = () => getJson<AbilityTable>('/data/reference/abilities.json');
export const loadItemReference = () => getJson<ItemReferenceTable>('/data/reference/items.json');
export const loadLeagues = () => getJson<LeagueSummary[]>('/data/league/index.json');
export const loadLeague = (id: string) => getJson<LeagueGame>(`/data/league/${id}.json`);

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

// ---- media (mirrored into /media by `npm run media`) ----
// Sprites (Pokémon and items) are precached; artwork and cries are cached the first time they are seen.
export const spriteUrl = (id: number) => `/media/sprites/${id}.webp`;
export const artworkUrl = (id: number) => `/media/artwork/${id}.webp`;
export const cryUrl = (id: number) => `/media/cries/${id}.m4a`;
export const itemSpriteUrl = (id: number | string) => `/media/items/${id}.webp`;

// ---- type maths ----
export function defensiveMultipliers(defTypes: TypeName[], data: TypeData): Record<TypeName, number> {
  const out = {} as Record<TypeName, number>;
  for (const atk of data.types) {
    out[atk] = defTypes.reduce((acc, d) => acc * (data.matrix[atk]?.[d] ?? 1), 1);
  }
  return out;
}


/**
 * Best factor any of `attackTypes` gets against each single defending type (0 when there are none).
 * Plain type chart: no special cases like Freeze-Dry.
 */
export function offensiveMultipliers(attackTypes: TypeName[], data: TypeData): Record<TypeName, number> {
  const out = {} as Record<TypeName, number>;
  for (const def of data.types) {
    out[def] = Math.max(0, ...attackTypes.map((atk) => data.matrix[atk]?.[def] ?? 1));
  }
  return out;
}

/** Types of a member's damaging moves; status moves don't count. */
export function attackingTypes(moveIds: number[] | undefined, moves: MoveTable): TypeName[] {
  return [...new Set((moveIds ?? []).map((id) => moves[id]).filter((m) => m && m.category !== 'status').map((m) => m.type))];
}
