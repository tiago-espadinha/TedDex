/**
 * Ways to get each species from its Bulbapedia "Game locations" table, joined to the location chunks as text rows
 * wherever PokeAPI has no encounters, and the games PokeAPI doesn't cover added to games.json.
 *
 *   npm run availability            # download pages (cached in .cache/bulbapedia/availability/) and rewrite locations/
 *   npm run availability -- --fresh # ignore the cache and re-download
 *
 * Run after `npm run data`, which rewrites the location chunks without the text rows. Pages come through curl
 * (Bulbapedia challenges Node's fetch), one per second, about 17 minutes the first time. Fails on anything it can't read.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chunkOf, packLocations, unpackLocations, type PackedLocations } from '../src/data/chunks';
import type { EvolutionMember, Game, IndexEntry, Locations, SpeciesDetail } from '../src/data/types';
import { ADDED_GAMES, parseAvailability, regionalParents, withAvailability, type Availability } from './availability';
import { fetchPage } from './bulbapedia';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'bulbapedia', 'availability');
const DATA = join(ROOT, 'public', 'data');
const FRESH = process.argv.includes('--fresh');

const readJson = async <T>(path: string) => JSON.parse(await readFile(join(DATA, path), 'utf8')) as T;

const evolutionChunks = new Map<number, Record<number, EvolutionMember[]>>();
async function evolutionChain(chainId: number): Promise<EvolutionMember[]> {
  const chunk = chunkOf(chainId);
  if (!evolutionChunks.has(chunk)) evolutionChunks.set(chunk, await readJson(`evolution/c${chunk}.json`));
  return evolutionChunks.get(chunk)![chainId];
}

/** The species' page, cached by id once it holds the table; a redirect ("Farfetch’d" with the app's apostrophe) is followed. */
async function wikitext(id: number, name: string): Promise<string> {
  const file = join(CACHE, `${id}.wiki`);
  if (!FRESH && existsSync(file)) return readFile(file, 'utf8');
  let text = await fetchPage(`${name} (Pokémon)`.replace(/ /g, '_'));
  const redirect = text.match(/^#redirect\s*\[\[([^\]]+)\]\]/i)?.[1];
  if (redirect) text = await fetchPage(redirect.replace(/ /g, '_'));
  if (!/locations\s*===/i.test(text)) throw new Error(`${name}: no Game locations section`);
  await writeFile(file, text);
  return text;
}

async function parsePage(id: number, name: string): Promise<Availability> {
  try {
    const availability = parseAvailability(await wikitext(id, name));
    if (!availability) throw new Error('no Game locations section');
    return availability;
  } catch (err) {
    throw new Error(`${name}: ${(err as Error).message}`, { cause: err });
  }
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const index = await readJson<IndexEntry[]>('index.json');
  // Every page first: a page that can't be read stops the build before any chunk is rewritten.
  const availability = new Map<number, Availability>();
  for (const { id, name } of index) availability.set(id, await parsePage(id, name));

  const names = new Map(index.map((entry) => [entry.id, entry.name]));
  const known = await readJson<Game[]>('games.json');
  const knownIds = new Set(known.map((g) => g.id));
  const games = [...known, ...ADDED_GAMES.filter((g) => !knownIds.has(g.id))];

  const dir = join(DATA, 'locations');
  let textRows = 0;
  for (const file of await readdir(dir)) {
    const packed = await readJson<PackedLocations>(join('locations', file));
    const species = await readJson<Record<number, SpeciesDetail>>(join('species', file));
    const chunk: Record<number, Locations> = {};
    for (const key of Object.keys(packed.species)) {
      const id = Number(key);
      const forms = species[id].forms ?? [];
      const formGames = Object.fromEntries(forms.map((f) => [f.key, games.filter((g) => f.games?.includes(g.group)).map((g) => g.id)]));
      const chainId = species[id].evolutionChainId;
      const chain = chainId === null ? [] : await evolutionChain(chainId);
      const parents = regionalParents(chain, id, (parent) => names.get(parent)!);
      chunk[id] = withAvailability(unpackLocations(packed, id)!, availability.get(id)!, forms.map((f) => f.key), formGames, parents);
      textRows += Object.values(chunk[id].games).flat().filter((row) => row[2] === 0).length;
    }
    await writeFile(join(dir, file), JSON.stringify(packLocations(chunk)));
  }

  await writeFile(join(DATA, 'games.json'), JSON.stringify(games));
  console.log(`${index.length} species, ${textRows} text rows → public/data/locations/`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
