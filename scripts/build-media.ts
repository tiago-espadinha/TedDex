/**
 * Media build: mirrors PokeAPI's sprites, artwork and cries into public/media/ so the app
 * never hot-links GitHub at runtime. Needs `ffmpeg` (with libwebp and aac) on PATH.
 *
 *   npm run media             # download missing sources (cached in .cache/media/) and convert
 *   npm run media -- --fresh  # re-download and re-convert everything
 *   npm run media -- --redo=artwork,cries  # re-convert those kinds from the cache (after changing their options)
 *
 * Reads the species list from public/data/index.json, their forms from the species/ chunks and the items from
 * reference/items.json (with their PokeAPI names from the CSV cache), so run `npm run data` first.
 *
 * Output (all under public/media/; forms use their Pokémon id, e.g. 10034 for Mega Charizard X):
 *   sprites/<id>.webp   96 px front sprite, lossless WebP (precached by the service worker); species and forms
 *   sprites/shiny/<id>.webp  the same, shiny; species only
 *   artwork/<id>.webp   368 px official artwork (2× the 184 px hero), WebP q65 (cached on first view); species and forms
 *   cries/<id>.m4a      latest cry, AAC 40 kbps mono (iOS Safari can't reliably play OGG); species only
 *   items/<id>.webp     item sprite, 48–64 px WebP (precached); every item in reference/items.json
 *   guide/<name>.webp   pixel-art sprites for the Guide menu rows, doubled, lossless (precached)
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const ITEM_SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
// PokeAPI has no pixel-art Mint (its Gen 8 items are 160 px renders); PokéSprite draws the stat Mints.
const POKESPRITE_ITEMS = 'https://raw.githubusercontent.com/msikma/pokesprite/master/items';
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';
const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'media');
const OUT = join(ROOT, 'public', 'media');
const FRESH = process.argv.includes('--fresh');
const REDO = new Set(process.argv.find((a) => a.startsWith('--redo='))?.slice('--redo='.length).split(',') ?? []);
const CONCURRENCY = 8;
const TIMEOUT_MS = 30_000;

type Kind = {
  dir: string;
  source: (id: number) => string;
  ext: string;
  /** ffmpeg output options; a function picks them per source file. */
  ffmpeg: string[] | ((src: string) => Promise<string[]>);
  /** Which ids to mirror: species, species and their forms (forms share their species' cry), or items. */
  ids: 'species' | 'forms' | 'items';
};

const KINDS: Kind[] = [
  { dir: 'sprites', source: (id) => `${SPRITES}/${id}.png`, ext: 'webp', ffmpeg: ['-c:v', 'libwebp', '-lossless', '1'], ids: 'forms' },
  // Shiny sprites for the Pokédex tracker's shiny cells, which track species only.
  { dir: 'sprites/shiny', source: (id) => `${SPRITES}/shiny/${id}.png`, ext: 'webp', ffmpeg: ['-c:v', 'libwebp', '-lossless', '1'], ids: 'species' },
  {
    dir: 'artwork',
    source: (id) => `${SPRITES}/other/official-artwork/${id}.png`,
    ext: 'webp',
    ffmpeg: ['-vf', 'scale=368:368:force_original_aspect_ratio=decrease:flags=lanczos', '-c:v', 'libwebp', '-quality', '65', '-compression_level', '6'],
    ids: 'forms',
  },
  {
    dir: 'cries',
    source: (id) => `${CRIES}/${id}.ogg`,
    ext: 'm4a',
    ffmpeg: ['-vn', '-c:a', 'aac', '-b:a', '40k', '-ac', '1', '-movflags', '+faststart'],
    ids: 'species',
  },
  // PokeAPI names item sprites by identifier; `itemIdentifiers` is filled from the CSV cache before the run.
  { dir: 'items', source: (id) => `${ITEM_SPRITES}/${itemIdentifiers.get(id)}.png`, ext: 'webp', ffmpeg: itemSpriteOptions, ids: 'items' },
];
const itemIdentifiers = new Map<number, string>();

const PIXEL_OPTIONS = ['-vf', 'scale=iw*2:ih*2:flags=neighbor', '-c:v', 'libwebp', '-lossless', '1'];

/**
 * Older item sprites are 24–32 px pixel art, newer ones 160 px renders. Pixel art is doubled with nearest-neighbour
 * and kept lossless; renders shrink to 64 px, lossy. Both then display sharp at the same size without
 * `image-rendering`, and 2,000 renders stay small enough to precache.
 */
async function itemSpriteOptions(src: string): Promise<string[]> {
  const width = (await readFile(src)).readUInt32BE(16); // PNG IHDR width
  return width <= 32
    ? PIXEL_OPTIONS
    : ['-vf', 'scale=64:64:force_original_aspect_ratio=decrease:flags=lanczos', '-c:v', 'libwebp', '-quality', '75'];
}

/** Downloads (or reuses) the source file; returns null when PokeAPI has no file for this id. */
async function fetchSource(url: string, file: string): Promise<string | null> {
  if (!FRESH && existsSync(file)) return file;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Download failed for ${url}: ${res.status}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

async function convert(kind: Kind, id: number): Promise<'done' | 'skipped' | 'missing'> {
  const out = join(OUT, kind.dir, `${id}.${kind.ext}`);
  if (!FRESH && !REDO.has(kind.dir) && existsSync(out)) return 'skipped';
  const url = kind.source(id);
  const src = await fetchSource(url, join(CACHE, kind.dir, url.split('/').pop()!));
  if (!src) return 'missing';
  // Convert to a temp name first so an interrupted run never leaves a truncated file that looks done.
  const tmp = join(OUT, kind.dir, `.${id}.tmp.${kind.ext}`);
  const options = typeof kind.ffmpeg === 'function' ? await kind.ffmpeg(src) : kind.ffmpeg;
  await run('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, ...options, tmp]);
  await rename(tmp, out);
  return 'done';
}

/**
 * Guide menu sprites: the Fighting TM, the Speed (Timid) Mint, and the Rusted Sword over the Rusted Shield in one
 * 64 px image. The rusted sprites are already doubled pixel art: each is cropped to its art and placed at even
 * offsets so the pair fills the box without breaking the pixel grid.
 */
async function buildGuideSprites() {
  const dir = join(OUT, 'guide');
  await mkdir(dir, { recursive: true });
  const fetchItem = async (url: string, name: string) => {
    const src = await fetchSource(url, join(CACHE, 'guide', name));
    if (!src) throw new Error(`Guide sprite missing: ${url}`);
    return src;
  };
  const ffmpeg = (inputs: string[], options: string[], name: string) =>
    run('ffmpeg', ['-loglevel', 'error', '-y', ...inputs.flatMap((i) => ['-i', i]), ...options, join(dir, `${name}.webp`)]);

  await mkdir(join(CACHE, 'guide'), { recursive: true });
  await ffmpeg([await fetchItem(`${ITEM_SPRITES}/tm-fighting.png`, 'tm-fighting.png')], PIXEL_OPTIONS, 'tm');
  await ffmpeg([await fetchItem(`${POKESPRITE_ITEMS}/mint/speed.png`, 'mint-speed.png')], PIXEL_OPTIONS, 'mint');
  const sword = await fetchItem(`${ITEM_SPRITES}/rusted-sword.png`, 'rusted-sword.png');
  const shield = await fetchItem(`${ITEM_SPRITES}/rusted-shield.png`, 'rusted-shield.png');
  // Both sprites carry a white sticker border (and near-white pixels where it meets the art): clear it to alpha 0.
  // colorkey would set every other pixel opaque, so geq keeps the source alpha instead.
  const unsticker = "format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(r(X,Y),200)*gt(g(X,Y),200)*gt(b(X,Y),200),0,alpha(X,Y))'";
  const pair = [
    'color=c=black@0:s=64x64,format=rgba[bg]',
    `[0]${unsticker},crop=42:40:12:10[sword]`,
    `[1]${unsticker},crop=44:36:10:14[shield]`,
    '[bg][shield]overlay=14:24:format=rgb[back]',
    '[back][sword]overlay=4:4:format=rgb,format=rgba',
  ].join(';');
  await ffmpeg([sword, shield], ['-filter_complex', pair, '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1'], 'types');
  console.log('guide: 3 sprites');
}

/** Runs `task` over `items` with at most CONCURRENCY in flight. */
async function pool<T>(items: T[], task: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function main() {
  await run('ffmpeg', ['-version']).catch(() => {
    throw new Error('ffmpeg not found on PATH: install it to build media');
  });
  const unknown = [...REDO].filter((dir) => !KINDS.some((kind) => kind.dir === dir));
  if (unknown.length) throw new Error(`--redo: unknown kind ${unknown.join(', ')} (kinds: ${KINDS.map((k) => k.dir).join(', ')})`);
  const index = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'index.json'), 'utf8')) as { id: number }[];
  const ids = index.map((s) => s.id);
  const formIds: number[] = [];
  const speciesDir = join(ROOT, 'public', 'data', 'species');
  for (const file of await readdir(speciesDir)) {
    const chunk = JSON.parse(await readFile(join(speciesDir, file), 'utf8')) as Record<number, { forms?: { pokemonId: number }[] }>;
    for (const detail of Object.values(chunk)) for (const f of detail.forms?.slice(1) ?? []) formIds.push(f.pokemonId);
  }
  const itemIds = Object.keys(JSON.parse(await readFile(join(ROOT, 'public', 'data', 'reference', 'items.json'), 'utf8'))).map(Number);
  const itemsCsv = await readFile(join(ROOT, '.cache', 'csv', 'items.csv'), 'utf8').catch(() => {
    throw new Error('.cache/csv/items.csv not found: run `npm run data` first');
  });
  for (const line of itemsCsv.split('\n').slice(1)) {
    const [id, identifier] = line.split(',');
    if (identifier) itemIdentifiers.set(Number(id), identifier);
  }
  const idsFor = { species: ids, forms: [...ids, ...formIds], items: itemIds };

  for (const kind of KINDS) {
    await mkdir(join(CACHE, kind.dir), { recursive: true });
    await mkdir(join(OUT, kind.dir), { recursive: true });
  }

  for (const kind of KINDS) {
    let done = 0;
    let skipped = 0;
    const missing: number[] = [];
    await pool(idsFor[kind.ids], async (id) => {
      const result = await convert(kind, id);
      if (result === 'done') done++;
      else if (result === 'skipped') skipped++;
      else missing.push(id);
    });
    console.log(`${kind.dir}: ${done} converted, ${skipped} up to date, ${missing.length} missing`);
    if (missing.length) console.log(`  no source for: ${missing.sort((a, b) => a - b).join(', ')}`);
  }
  await buildGuideSprites();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
