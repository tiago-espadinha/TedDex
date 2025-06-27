import { readFileSync } from 'node:fs';
import { chunkOf, unpackLearnsets, type ChunkKind, type PackedLearnsets } from '../src/data/chunks';

/** Reads built output under public/data/. */
export const readData = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8')) as T;

/** One id's entry from its chunk file, as the app's loaders read it (not for locations, which are packed per chunk). */
export const dataEntry = <T>(kind: Exclude<ChunkKind, 'locations'>, id: number): T => {
  const entry = readData<Record<number, T>>(`${kind}/c${chunkOf(id)}.json`)[id];
  return (kind === 'learnsets' ? unpackLearnsets(entry as PackedLearnsets) : entry) as T;
};
