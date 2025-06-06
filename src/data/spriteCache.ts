/**
 * Keeps every sprite offline without listing ~3,600 files in the service worker's precache manifest.
 * The build emits data/sprites.json (precached); once the service worker controls the page, each listed sprite
 * is fetched through it, and its CacheFirst route (vite.config.ts) stores it in `sprites-<version>`.
 * Each launch fetches only the sprites missing from that cache, so an interrupted run resumes.
 */
export interface SpriteList {
  version: string;
  /** File names without `.webp`, per folder under /media/. */
  files: Record<string, string[]>;
}

/** Parallel fetches: enough to finish in seconds, few enough to leave the network to the screen. */
const PARALLEL = 6;

export const spriteUrls = (list: SpriteList) =>
  Object.entries(list.files).flatMap(([dir, names]) => names.map((name) => `/media/${dir}/${name}.webp`));

/** Listed sprites not yet in the cache (`cached` are the cached requests' URLs). */
export function missingSprites(list: SpriteList, cached: string[]) {
  const have = new Set(cached.map((url) => new URL(url, 'http://x').pathname));
  return spriteUrls(list).filter((url) => !have.has(url));
}

/** Sprite caches of other versions, to delete. */
export const staleSpriteCaches = (cacheNames: string[], version: string) =>
  cacheNames.filter((name) => name.startsWith('sprites-') && name !== `sprites-${version}`);

async function controlled() {
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return;
  await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
}

export async function warmSprites() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return;
  await controlled();
  const res = await fetch('/data/sprites.json');
  if (!res.ok) return;
  const list = (await res.json()) as SpriteList;
  for (const name of staleSpriteCaches(await caches.keys(), list.version)) await caches.delete(name);
  const cache = await caches.open(`sprites-${list.version}`);
  // Reversed so pop() takes Pokémon sprites, the Dex's first screen, first.
  const queue = missingSprites(list, (await cache.keys()).map((r) => r.url)).reverse();
  const worker = async () => {
    for (let url = queue.pop(); url; url = queue.pop()) await fetch(url).catch(() => {}); // a miss is retried next launch
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
}
