import type { EncounterRow, Learnset, Learnsets, Locations } from './types';

/**
 * Per-id data (species, learnsets, locations, evolution, move and item-place pages) ships in chunks of
 * CHUNK_SIZE ids, so the service worker precaches about 180 files instead of thousands.
 * A chunk file is `<kind>/c<n>.json` holding id → entry; learnsets and locations are packed further below.
 */
export const CHUNK_SIZE = 64;

export type ChunkKind = 'species' | 'learnsets' | 'locations' | 'evolution' | 'reference/moves' | 'reference/places';

export const chunkOf = (id: number) => Math.floor(id / CHUNK_SIZE);
export const chunkPath = (kind: ChunkKind, id: number) => `/data/${kind}/c${chunkOf(id)}.json`;

/** Groups id → entry into chunk number → (id → entry). */
export function toChunks<T>(entries: Iterable<[number, T]>): Map<number, Record<number, T>> {
  const out = new Map<number, Record<number, T>>();
  for (const [id, entry] of entries) {
    let chunk = out.get(chunkOf(id));
    if (!chunk) out.set(chunkOf(id), (chunk = {}));
    chunk[id] = entry;
  }
  return out;
}

// ---- learnsets: each distinct list once per species ----

type LearnList = Learnset['level'] | number[];

/**
 * learnsets chunk entry: `lists` holds each distinct list; a game is [level, machine, tutor, egg] indexes into it.
 * `forms` holds the games of forms that learn other moves than the species (form key → games), into the same lists.
 */
export interface PackedLearnsets {
  lists: LearnList[];
  games: Record<number, [level: number, machine: number, tutor: number, egg: number]>;
  forms?: Record<string, PackedLearnsets['games']>;
}

export function packLearnsets(learnsets: Learnsets, forms: Record<string, Learnsets> = {}): PackedLearnsets {
  const lists: LearnList[] = [];
  const seen = new Map<string, number>();
  const ref = (list: LearnList) => {
    const key = JSON.stringify(list);
    let i = seen.get(key);
    if (i === undefined) seen.set(key, (i = lists.push(list) - 1));
    return i;
  };
  const pack = (sets: Learnsets) => {
    const games: PackedLearnsets['games'] = {};
    for (const [game, l] of Object.entries(sets))
      games[Number(game)] = [ref(l.level), ref(l.machine), ref(l.tutor), ref(l.egg)];
    return games;
  };
  const games = pack(learnsets);
  const formGames = Object.entries(forms).map(([key, sets]) => [key, pack(sets)]);
  return formGames.length ? { lists, games, forms: Object.fromEntries(formGames) } : { lists, games };
}

/**
 * Inverse of packLearnsets: the learnsets of form `formKey` when it learns its own moves, else the species'.
 * Games may share list arrays, so treat the result as read-only.
 */
export function unpackLearnsets({ lists, games, forms }: PackedLearnsets, formKey?: string | null): Learnsets {
  const out: Learnsets = {};
  for (const [game, [level, machine, tutor, egg]] of Object.entries((formKey && forms?.[formKey]) || games)) {
    out[Number(game)] = {
      level: lists[level] as Learnset['level'],
      machine: lists[machine] as number[],
      tutor: lists[tutor] as number[],
      egg: lists[egg] as number[],
    };
  }
  return out;
}

// ---- locations: one string table per chunk ----

/** locations chunk file: rows of every species point into the shared `strings` (0 = ""). */
export interface PackedLocations {
  strings: string[];
  species: Record<number, Locations['games']>;
}

/** The text columns of an EncounterRow: area, method, note, form, form key (only on some rows). */
const TEXT_COLUMNS = [0, 1, 6, 7, 8] as const;

export function packLocations(chunk: Record<number, Locations>): PackedLocations {
  const strings = [''];
  const index = new Map([['', 0]]);
  const ref = (text: string) => {
    let i = index.get(text);
    if (i === undefined) index.set(text, (i = strings.push(text) - 1));
    return i;
  };
  const species: PackedLocations['species'] = {};
  for (const [id, loc] of Object.entries(chunk)) {
    const games: Locations['games'] = {};
    for (const [game, rows] of Object.entries(loc.games)) {
      games[Number(game)] = rows.map((row) => {
        const out = [...row] as EncounterRow;
        for (const c of TEXT_COLUMNS) if (row[c] !== undefined) out[c] = ref(loc.strings[row[c]!]);
        return out;
      });
    }
    species[Number(id)] = games;
  }
  return { strings, species };
}

/** One species' Locations from a packed chunk (its rows already point into the shared strings). */
export function unpackLocations(file: PackedLocations, id: number): Locations | undefined {
  const games = file.species[id];
  return games && { strings: file.strings, games };
}
