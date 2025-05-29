/**
 * Elite Four & Champion build: turns Bulbapedia's trainer pages into the JSON the Reference tab ships.
 * PokeAPI has no trainer data, so `scripts/league-manifest.json` says by hand which battle of which page
 * belongs to each game; this script only reads the teams out of those pages and maps names to our ids.
 *
 *   npm run league            # download pages (cached in .cache/bulbapedia/) and emit public/data/league/
 *   npm run league -- --fresh # ignore the cache and re-download
 *
 * Run after `npm run data` (it reads public/data/ for species, forms, moves, abilities and items).
 * Output: league/index.json (games, oldest first), league/<game>.json and each trainer's sprite from the
 * party template as media/trainers/<file>.webp (downloaded from Bulbagarden Archives with curl, cached in
 * .cache/bulbapedia/sprites/, first frame only; needs `ffmpeg`). Fails on any name it cannot map, and writes
 * nothing until every game has been built.
 */
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  AbilityTable, IndexEntry, ItemTable, LeagueGame, LeagueMember, LeagueRematch, LeagueTeam, LeagueTrainer, MoveTable,
  SpeciesDetail, TypeData, TypeName, VersionGroup,
} from '../src/data/types';
import { nameKey, parseLevel, parseParties, plainText, type RawMember, type RawParty } from './league';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'bulbapedia');
const DATA = join(ROOT, 'public', 'data');
const OUT = join(DATA, 'league');
const SPRITE_CACHE = join(CACHE, 'sprites');
const SPRITES = join(ROOT, 'public', 'media', 'trainers');
const ARCHIVES = 'https://archives.bulbagarden.net/wiki/Special:FilePath';
const FRESH = process.argv.includes('--fresh');
const WIKI = 'https://bulbapedia.bulbagarden.net';
const USER_AGENT = 'material-dex-web data build (non-commercial fan project)';
const run = promisify(execFile);

/** Sprite suffixes that are only cosmetic (or the default form) for the species that use them. */
const COSMETIC_FORMS = new Set(['shield', 'west', 'east', 'shiny', 'baile', 'female', 'male', 'full']);
/** Older spellings on Gen I–IV pages → current move names. */
const MOVE_ALIASES: Record<string, string> = {
  hijumpkick: 'High Jump Kick',
  faintattack: 'Feint Attack',
  vicegrip: 'Vise Grip',
  smellingsalt: 'Smelling Salts',
};

interface ManifestTrainer {
  name: string;
  role: string;
  type?: TypeName;
  page: string;
  /** Value(s) of the party's `game =` field. */
  game: string | string[];
  /** Text one of the party's headings must contain; every matching party becomes a team. */
  heading?: string;
  /** Heading text of each later battle (post-game rematch, title defense), in battle order. */
  rematch?: string | string[];
}

interface ManifestGame {
  id: string;
  label: string;
  region: string;
  /** Version group(s) the page covers; the first sets the generation. */
  versionGroups: number[];
  note?: string;
  /** Tooltip label that picks the level when a page lists several (default: Normal Mode). */
  levelTag?: string;
  trainers: ManifestTrainer[];
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pageUrl = (page: string) => `${WIKI}/wiki/${encodeURIComponent(page.replace(/ /g, '_')).replace(/%2F/g, '/')}`;

async function wikitext(page: string): Promise<string> {
  const file = join(CACHE, `${page.replace(/[^\w()-]+/g, '_')}.wiki`);
  if (!FRESH && existsSync(file)) return readFile(file, 'utf8');
  console.log(`  fetching ${page}`);
  const res = await fetch(`${WIKI}/w/index.php?title=${encodeURIComponent(page)}&action=raw`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`);
  const text = await res.text();
  if (text.startsWith('#REDIRECT')) throw new Error(`${page} redirects: ${text.split('\n')[0]}; use the target page`);
  await writeFile(file, text);
  await sleep(1000); // be polite to the wiki
  return text;
}

/** Name → id lookups over the tables `npm run data` built. */
async function lookups() {
  const [index, moves, abilities, items, versions, types] = await Promise.all([
    readJson<IndexEntry[]>(join(DATA, 'index.json')),
    readJson<MoveTable>(join(DATA, 'moves.json')),
    readJson<AbilityTable>(join(DATA, 'reference', 'abilities.json')),
    readJson<ItemTable>(join(DATA, 'items.json')),
    readJson<VersionGroup[]>(join(DATA, 'versions.json')),
    readJson<TypeData>(join(DATA, 'types.json')),
  ]);
  const byName = (entries: [string, string][]) => new Map(entries.map(([id, name]) => [nameKey(name), Number(id)]));
  return {
    species: new Map(index.map((s) => [s.id, s])),
    moves: byName(Object.entries(moves).map(([id, m]) => [id, m.name])),
    abilities: byName(Object.entries(abilities).map(([id, a]) => [id, a.name])),
    items: byName(Object.entries(items)),
    gen: new Map(versions.map((v) => [v.id, v.gen])),
    types: new Set<string>(types.types),
  };
}
type Lookups = Awaited<ReturnType<typeof lookups>>;

const formKeys = new Map<number, Promise<string[]>>();
function speciesForms(id: number): Promise<string[]> {
  let keys = formKeys.get(id);
  if (!keys) {
    keys = readJson<SpeciesDetail>(join(DATA, 'species', `${id}.json`)).then((s) => (s.forms ?? []).map((f) => f.key));
    formKeys.set(id, keys);
  }
  return keys;
}

/** Our form key for a sprite suffix like "-Alola"; undefined for the default or a cosmetic form. */
async function formOf(raw: RawMember): Promise<string | undefined> {
  const key = raw.form.replace(/^-/, '').toLowerCase();
  if (!key) return undefined;
  if ((await speciesForms(raw.ndex)).includes(key)) return key;
  if (COSMETIC_FORMS.has(key)) return undefined;
  throw new Error(`${raw.pokemon}: unknown form "${raw.form}"`);
}

/** The Mega or Gigantamax form the member changes into, from the page's icon/max fields and its Mega Stone. */
async function battleFormOf(raw: RawMember): Promise<string | undefined> {
  const keys = await speciesForms(raw.ndex);
  let key: string;
  if (raw.gigantamax) key = 'gmax';
  else if (raw.icon === 'mega') {
    const xy = raw.held.match(/ite ([XY])$/)?.[1];
    key = xy ? `mega-${xy.toLowerCase()}` : 'mega';
  } else return undefined;
  if (!keys.includes(key)) throw new Error(`${raw.pokemon}: no form "${key}"`);
  return key;
}

function typeName(ids: Lookups, name: string, who: string): TypeName {
  const type = name.toLowerCase();
  if (!ids.types.has(type)) throw new Error(`${who}: unknown type "${name}"`);
  return type as TypeName;
}

function lookup(table: Map<string, number>, name: string, what: string, who: string): number {
  const id = table.get(nameKey(name));
  if (id === undefined) throw new Error(`${who}: unknown ${what} "${name}"`);
  return id;
}

async function member(raw: RawMember, ids: Lookups, levelTag: RegExp | undefined, who: string): Promise<LeagueMember> {
  const species = ids.species.get(raw.ndex);
  if (!species) throw new Error(`${who}: unknown species #${raw.ndex} ${raw.pokemon}`);
  who = `${who} / ${species.name}`;
  const out: LeagueMember = {
    id: raw.ndex,
    level: parseLevel(raw.level, levelTag),
    moves: raw.moves.map((m) => lookup(ids.moves, MOVE_ALIASES[nameKey(m)] ?? m, 'move', who)),
  };
  const form = await formOf(raw);
  if (form) out.form = form;
  if (raw.ability) out.ability = lookup(ids.abilities, raw.ability, 'ability', who);
  if (raw.held) out.item = lookup(ids.items, plainText(raw.held), 'item', who);
  if (raw.tera) out.tera = typeName(ids, raw.tera, who);
  const battleForm = await battleFormOf(raw);
  if (battleForm) out.battleForm = battleForm;
  return out;
}

/** "Spr B2W2 Shauntal.png" → "spr-b2w2-shauntal": the sprite's file name under media/trainers/. */
const spriteKey = (file: string) => file.replace(/\.png$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Sprite files to download, keyed by `spriteKey`. */
const sprites = new Map<string, string>();

async function trainer(t: ManifestTrainer, game: ManifestGame, ids: Lookups): Promise<LeagueTrainer> {
  const games = ([] as string[]).concat(t.game);
  const who = `${game.id} / ${t.name}`;
  const all = parseParties(await wikitext(t.page)).filter((p) => games.includes(p.game));
  // Raw headings ("Before [[Stark Mountain]]") or their plain text ("Rematch (Easy Mode/Normal Mode)") both match.
  const under = (heading: string) =>
    all.filter((p) => p.headings.some((h) => h.includes(heading) || plainText(h).includes(heading)));
  const levelTag = game.levelTag ? new RegExp(game.levelTag) : undefined;
  const teamsOf = async (parties: RawParty[], heading: string): Promise<LeagueTeam[]> => {
    if (!parties.length) throw new Error(`${who}: no party on "${t.page}" for game ${games} under "${heading}"`);
    const teams: LeagueTeam[] = [];
    for (const p of parties) {
      const team: LeagueTeam = { members: await Promise.all(p.members.map((m) => member(m, ids, levelTag, who))) };
      if (parties.length > 1) team.label = plainText(p.caption) || `Team ${teams.length + 1}`;
      teams.push(team);
    }
    return teams;
  };
  const first = t.heading ? under(t.heading) : all;
  const out: LeagueTrainer = { name: t.name, role: t.role, source: pageUrl(t.page), teams: await teamsOf(first, t.heading ?? '') };
  if (t.type) out.type = typeName(ids, t.type, who);
  const file = first[0].sprite;
  if (file) {
    out.sprite = spriteKey(file);
    const known = sprites.get(out.sprite);
    if (known && known !== file) throw new Error(`${who}: sprites "${known}" and "${file}" share the name ${out.sprite}`);
    sprites.set(out.sprite, file);
  }
  const rematches: LeagueRematch[] = [];
  for (const heading of ([] as string[]).concat(t.rematch ?? [])) {
    const parties = under(heading);
    rematches.push({ label: plainText(parties[0]?.headings.at(-1) ?? heading), teams: await teamsOf(parties, heading) });
  }
  if (rematches.length) out.rematches = rematches;
  return out;
}

const spriteSource = (file: string) => join(SPRITE_CACHE, file.replace(/[^\w.()-]+/g, '_'));

/** Downloads a sprite once into the cache; the `.part` file only takes the cached name once curl has finished. */
async function fetchSprite(file: string) {
  const src = spriteSource(file);
  if (!FRESH && existsSync(src)) return;
  console.log(`  fetching ${file}`);
  const url = `${ARCHIVES}/${encodeURIComponent(file.replace(/ /g, '_'))}`;
  await run('curl', ['-sSfL', '-A', USER_AGENT, '-o', `${src}.part`, url]);
  await rename(`${src}.part`, src);
  await sleep(1000);
}

/** Writes a cached sprite's first frame as WebP: pixel sprites doubled, VS art fitted in 192 px. */
async function writeSprite(key: string, file: string) {
  const src = spriteSource(file);
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', src]);
  const options = Number(stdout) <= 128
    ? ['-vf', 'scale=iw*2:ih*2:flags=neighbor', '-c:v', 'libwebp', '-lossless', '1']
    : ['-vf', 'scale=192:192:force_original_aspect_ratio=decrease:flags=lanczos', '-c:v', 'libwebp', '-quality', '85'];
  await run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-frames:v', '1', ...options, join(SPRITES, `${key}.webp`)]);
}

async function buildGame(g: ManifestGame, ids: Lookups): Promise<LeagueGame> {
  console.log(g.label);
  const gen = ids.gen.get(g.versionGroups[0]);
  if (!gen) throw new Error(`${g.id}: unknown version group ${g.versionGroups[0]}`);
  const trainers: LeagueTrainer[] = [];
  for (const t of g.trainers) trainers.push(await trainer(t, g, ids));
  return { id: g.id, label: g.label, region: g.region, gen, ...(g.note && { note: g.note }), trainers };
}

async function main() {
  await mkdir(SPRITE_CACHE, { recursive: true });
  const ids = await lookups();
  const { games } = await readJson<{ games: ManifestGame[] }>(join(ROOT, 'scripts', 'league-manifest.json'));
  const built: LeagueGame[] = [];
  for (const g of games) built.push(await buildGame(g, ids));
  for (const file of sprites.values()) await fetchSprite(file);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const game of built) await writeFile(join(OUT, `${game.id}.json`), JSON.stringify(game));
  const index = built.map(({ id, label, region, gen }) => ({ id, label, region, gen }));
  await writeFile(join(OUT, 'index.json'), JSON.stringify(index));
  await rm(SPRITES, { recursive: true, force: true });
  await mkdir(SPRITES, { recursive: true });
  for (const [key, file] of sprites) await writeSprite(key, file);
  console.log(`${index.length} games → public/data/league/, ${sprites.size} sprites → public/media/trainers/`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
