/**
 * "Where to find" build: each item's acquisition table from its Bulbapedia page, merged with PokeAPI's wild held
 * items (reference/items.json), into chunk files (64 items each, `src/data/chunks.ts`) for the Reference tab.
 *
 *   npm run item-places            # download pages (cached in .cache/bulbapedia/items/) and emit reference/places/
 *   npm run item-places -- --fresh # ignore the cache and re-download
 *
 * Run after `npm run data`. Pages are fetched with curl (Bulbapedia challenges Node's fetch), one per second.
 * TMs, TRs, HMs and Dynamax Crystals have no item pages; items whose page is missing, a list or a disambiguation
 * keep only their wild holders. Fails on any table cell it cannot read (unknown template or game code).
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ItemInfo, ItemPlaceGame, ItemPlaces, ItemReferenceTable } from '../src/data/types';
import { toChunks } from '../src/data/chunks';
import { fetchPage, WIKI } from './bulbapedia';
import { gameOfGroup, parseAcquisition, type AcquisitionRow } from './itemPlaces';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'bulbapedia', 'items');
const DATA = join(ROOT, 'public', 'data', 'reference');
const OUT = join(DATA, 'places');
const FRESH = process.argv.includes('--fresh');

/** Items Bulbapedia covers on list pages rather than item pages. */
const NO_PAGE = /^(TM|TR|HM)\d+$|^★/;
/** Items whose page name differs from the item name ("Poké Ball" is the page about every ball). */
const PAGES: Record<string, string> = { 'Poké Ball': 'Poké Ball (item)' };
/** Game-specific copies (named "X (Legends: Arceus)" by `npm run data`) → the version groups their rows must name. */
const VARIANT_GROUPS: Record<string, number[]> = {
  'Legends: Arceus': [24],
  "Let's Go": [19],
  "Let's Go Pikachu": [19],
  "Let's Go Eevee": [19],
  'Sword/Shield': [20],
};
/** Text lines PokeAPI's held chips already say. */
const HELD_BY_WILD = /^Held by wild [^,;]*$/;

const pageUrl = (page: string) => `${WIKI}/wiki/${encodeURIComponent(page.replace(/ /g, '_'))}`;

/** Raw wikitext of a page, "" when it does not exist. */
async function wikitext(page: string): Promise<string> {
  const file = join(CACHE, `${page.replace(/[^\w()-]+/g, '_')}.wiki`);
  if (!FRESH && existsSync(file)) return readFile(file, 'utf8');
  const text = await fetchPage(page, { missingOk: true });
  await writeFile(file, text);
  return text;
}

/** The item's page and its acquisition rows, following one redirect (not one into a section of a list page). */
async function bulbapedia(name: string): Promise<{ page: string; rows: AcquisitionRow[] } | null> {
  let page = name;
  let text = await wikitext(page);
  const redirect = text.match(/^#REDIRECT\s*\[\[([^\]]+)\]\]/i)?.[1];
  if (redirect) {
    if (redirect.includes('#')) return null;
    page = redirect;
    text = await wikitext(page);
  }
  if (!text) return null;
  try {
    const rows = parseAcquisition(text);
    return rows && { page, rows };
  } catch (err) {
    throw new Error(`${name} (${pageUrl(page)}): ${(err as Error).message}`);
  }
}

interface Group extends ItemPlaceGame {
  order: number;
  groups: number[];
}

/** Table rows newest first, wild holders added to the first row naming their version group (or a row of their own). */
function merge(rows: AcquisitionRow[], wild: ItemInfo['wild'], who: string): ItemPlaceGame[] {
  const groups: Group[] = rows.map((r) => ({
    // A cell may name the same games twice, as Bulbapedia's international and Japanese Gen I codes (RBY/RGBY) do.
    game: [...new Set(r.games.flatMap((g) => g.label.split(' / ')))].join(' / ') || 'Other',
    order: r.games.length ? Math.min(...r.games.map((g) => g.order)) : -1,
    groups: r.games.flatMap((g) => g.groups ?? []),
    once: r.once,
    repeat: r.repeat,
    note: r.note,
  }));
  for (const [versionGroup, species, rarity] of wild) {
    let group = groups.find((g) => g.groups.includes(versionGroup));
    if (!group) {
      const game = gameOfGroup(versionGroup);
      if (!game) throw new Error(`${who}: no game for version group ${versionGroup}`);
      group = { game: game.label, order: game.order, groups: game.groups ?? [], once: [], repeat: [] };
      groups.push(group);
    }
    const held = (group.held ??= []);
    const same = held.find(([s]) => s === species);
    if (!same) held.push([species, rarity]);
    else same[1] = Math.max(same[1], rarity);
  }
  return groups
    .sort((a, b) => b.order - a.order)
    .map(({ game, held, once = [], repeat = [], note }) => {
      const out: ItemPlaceGame = { game };
      if (held) out.held = held.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      const text = (lines: string[]) => (held ? lines.filter((l) => !HELD_BY_WILD.test(l)) : lines);
      const [oneTime, repeatable] = [text(once), text(repeat)];
      if (oneTime.length) out.once = oneTime;
      if (repeatable.length) out.repeat = repeatable;
      if (note) out.note = note;
      return out;
    })
    .filter((g) => g.held || g.once || g.repeat || g.note);
}

async function places(name: string, wild: ItemInfo['wild']): Promise<ItemPlaces> {
  const suffix = name.match(/ \(([^)]+)\)$/)?.[1];
  const only = suffix ? VARIANT_GROUPS[suffix] : undefined; // other brackets are part of the name: "Steel Bottle (R)"
  const base = only ? name.slice(0, -suffix!.length - 3) : name;
  const page = NO_PAGE.test(base) ? null : await bulbapedia(PAGES[base] ?? base);
  let rows = page?.rows ?? [];
  if (only) rows = rows.filter((r) => r.games.some((g) => g.groups?.some((id) => only.includes(id))));
  const games = merge(rows, wild, name);
  const fromWiki = games.some((g) => g.once || g.repeat || g.note);
  return { ...(page && fromWiki && { source: pageUrl(page.page) }), games };
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const items = JSON.parse(await readFile(join(DATA, 'items.json'), 'utf8')) as ItemReferenceTable;
  const built: [number, ItemPlaces][] = [];
  for (const [id, item] of Object.entries(items)) built.push([Number(id), await places(item.name, item.wild)]);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const [n, chunk] of toChunks(built)) await writeFile(join(OUT, `c${n}.json`), JSON.stringify(chunk));
  const withSource = built.filter(([, p]) => p.source).length;
  const withAny = built.filter(([, p]) => p.games.length).length;
  console.log(
    `${built.length} items, ${withAny} with places, ${withSource} from Bulbapedia → public/data/reference/places/`,
  );
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
