/**
 * Pokédex device art for the Pokédex list and the new-Pokédex screen: one image per version group in versions.json.
 *
 *   npm run dex-sprites            # needs curl and ffmpeg; run after `npm run data`
 *   npm run dex-sprites -- --fresh # re-download the art
 *
 * Output: public/media/dexes/<version group>.webp, the game's official Pokédex art from Bulbagarden Archives fitted in
 * 160 px (shown at 80). Downloads are cached in .cache/bulbapedia/dexes/. Fails when a game in versions.json has no art.
 */
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { VersionGroup } from '../src/data/types';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'bulbapedia', 'dexes');
const OUT = join(ROOT, 'public', 'media', 'dexes');
const ARCHIVES = 'https://archives.bulbagarden.net/wiki/Special:FilePath';
const FRESH = process.argv.includes('--fresh');
const USER_AGENT = 'material-dex-web data build (non-commercial fan project)';
const run = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Version group id → its Pokédex art on Bulbagarden Archives; remakes without their own art share the original's. */
const ART: Record<number, string> = {
  1: 'RG Pokédex.png', // Red / Blue
  2: 'RG Pokédex.png', // Yellow
  3: 'Pokédex GSC.png', // Gold / Silver
  4: 'Pokédex GSC.png', // Crystal
  5: 'RSE Pokédex.png', // Ruby / Sapphire
  6: 'RSE Pokédex.png', // Emerald
  7: 'Pokédex FRLG.png', // FireRed / LeafGreen
  8: 'DP Pokédex.png', // Diamond / Pearl
  9: 'Pt Pokédex.png', // Platinum
  10: 'Pokédex HGSS m.png', // HeartGold / SoulSilver
  11: 'Pokédex BW art.png', // Black / White
  14: 'Pokédex BW art.png', // Black 2 / White 2
  15: 'XY Pokédex.png', // X / Y
  16: 'ORAS Pokédex.png', // Omega Ruby / Alpha Sapphire
  17: '0479Rotom-Pokédex.png', // Sun / Moon
  18: '0479Rotom-Pokédex.png', // Ultra Sun / Ultra Moon
  19: 'LGPE Pokédex.png', // Let's Go
  20: '0479Rotom-Phone.png', // Sword / Shield
  23: 'DP Pokédex.png', // Brilliant Diamond / Shining Pearl
  24: 'LA Pokédex.png', // Legends: Arceus
  25: '0479Rotom-Phone SV.png', // Scarlet / Violet
};

const cached = (file: string) => join(CACHE, file.replace(/[^\w.()-]+/g, '_'));

/** Downloads an image once into the cache; the `.part` file only takes the cached name once curl has finished. */
async function fetchArt(file: string) {
  const src = cached(file);
  if (!FRESH && existsSync(src)) return;
  console.log(`  fetching ${file}`);
  const url = `${ARCHIVES}/${encodeURIComponent(file.replace(/ /g, '_'))}`;
  await run('curl', ['-sSfL', '-A', USER_AGENT, '-o', `${src}.part`, url]);
  await rename(`${src}.part`, src);
  await sleep(1000); // be polite to the wiki
}

async function main() {
  const versions = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'versions.json'), 'utf8')) as VersionGroup[];
  const missing = versions.filter((v) => !ART[v.id]);
  if (missing.length) throw new Error(`No Pokédex art for ${missing.map((v) => v.label).join(', ')}`);
  await mkdir(CACHE, { recursive: true });
  for (const file of new Set(versions.map((v) => ART[v.id]))) await fetchArt(file);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const v of versions) {
    const vf = 'scale=160:160:force_original_aspect_ratio=decrease:flags=lanczos';
    await run('ffmpeg', ['-v', 'error', '-y', '-i', cached(ART[v.id]), '-frames:v', '1', '-vf', vf, '-c:v', 'libwebp', '-quality', '85', join(OUT, `${v.id}.webp`)]);
  }
  console.log(`${versions.length} Pokédex images → public/media/dexes/`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
