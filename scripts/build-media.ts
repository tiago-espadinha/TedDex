/**
 * Media build: mirrors PokeAPI's sprites, artwork and cries into public/media/ so the app
 * never hot-links GitHub at runtime. Needs `ffmpeg` (with libwebp and aac) on PATH.
 *
 *   npm run media             # download missing sources (cached in .cache/media/) and convert
 *   npm run media -- --fresh  # re-download and re-convert everything
 *
 * Reads the species list from public/data/index.json and their forms from species/<id>.json,
 * so run `npm run data` first.
 *
 * Output (all under public/media/; forms use their Pokémon id, e.g. 10034 for Mega Charizard X):
 *   sprites/<id>.webp   96 px front sprite, lossless WebP (precached by the service worker); species and forms
 *   artwork/<id>.webp   475 px official artwork, WebP q80 (cached on first view); species and forms
 *   cries/<id>.m4a      latest cry, AAC 64 kbps mono (iOS Safari can't reliably play OGG); species only
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';
const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'media');
const OUT = join(ROOT, 'public', 'media');
const FRESH = process.argv.includes('--fresh');
const CONCURRENCY = 8;
const TIMEOUT_MS = 30_000;

type Kind = {
  dir: string;
  source: (id: number) => string;
  ext: string;
  ffmpeg: string[];
  /** Also mirror each form's file (forms share their species' cry). */
  forms: boolean;
};

const KINDS: Kind[] = [
  { dir: 'sprites', source: (id) => `${SPRITES}/${id}.png`, ext: 'webp', ffmpeg: ['-c:v', 'libwebp', '-lossless', '1'], forms: true },
  {
    dir: 'artwork',
    source: (id) => `${SPRITES}/other/official-artwork/${id}.png`,
    ext: 'webp',
    ffmpeg: ['-c:v', 'libwebp', '-quality', '80'],
    forms: true,
  },
  {
    dir: 'cries',
    source: (id) => `${CRIES}/${id}.ogg`,
    ext: 'm4a',
    ffmpeg: ['-vn', '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-movflags', '+faststart'],
    forms: false,
  },
];

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
  if (!FRESH && existsSync(out)) return 'skipped';
  const url = kind.source(id);
  const src = await fetchSource(url, join(CACHE, kind.dir, url.split('/').pop()!));
  if (!src) return 'missing';
  // Convert to a temp name first so an interrupted run never leaves a truncated file that looks done.
  const tmp = join(OUT, kind.dir, `.${id}.tmp.${kind.ext}`);
  await run('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, ...kind.ffmpeg, tmp]);
  await rename(tmp, out);
  return 'done';
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
  const index = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'index.json'), 'utf8')) as { id: number }[];
  const ids = index.map((s) => s.id);
  const formIds: number[] = [];
  for (const id of ids) {
    const detail = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'species', `${id}.json`), 'utf8')) as {
      forms?: { pokemonId: number }[];
    };
    for (const f of detail.forms?.slice(1) ?? []) formIds.push(f.pokemonId);
  }

  for (const kind of KINDS) {
    await mkdir(join(CACHE, kind.dir), { recursive: true });
    await mkdir(join(OUT, kind.dir), { recursive: true });
  }

  for (const kind of KINDS) {
    let done = 0;
    let skipped = 0;
    const missing: number[] = [];
    await pool(kind.forms ? [...ids, ...formIds] : ids, async (id) => {
      const result = await convert(kind, id);
      if (result === 'done') done++;
      else if (result === 'skipped') skipped++;
      else missing.push(id);
    });
    console.log(`${kind.dir}: ${done} converted, ${skipped} up to date, ${missing.length} missing`);
    if (missing.length) console.log(`  no source for: ${missing.sort((a, b) => a - b).join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
