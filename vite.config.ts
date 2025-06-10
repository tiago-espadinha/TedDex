import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Sprite folders under public/media/: kept offline by the app's warm-up (src/data/spriteCache.ts), not the precache. */
const SPRITE_DIRS = ['sprites', 'sprites/shiny', 'items', 'guide', 'trainers', 'dexes'];
const MEDIA = fileURLToPath(new URL('./public/media/', import.meta.url));
const spriteFiles = Object.fromEntries(
  SPRITE_DIRS.map((dir) => [dir, readdirSync(`${MEDIA}${dir}`).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort()]),
);
/** Changes whenever any sprite does, so the app refetches them into a fresh cache. */
const spriteVersion = (() => {
  const hash = createHash('sha256');
  for (const dir of SPRITE_DIRS) for (const name of spriteFiles[dir]) hash.update(`${dir}/${name}`).update(readFileSync(`${MEDIA}${dir}/${name}.webp`));
  return hash.digest('hex').slice(0, 12);
})();

/** Artwork (species and forms) and cries, cached on first view: the runtime cache must hold all of them. */
const mediaFiles = ['artwork', 'cries'].reduce((n, dir) => n + readdirSync(`${MEDIA}${dir}`).length, 0);

/** Emits data/sprites.json (version + file names per folder) for the warm-up; it is precached with the other data. */
const spriteList = (): Plugin => ({
  name: 'sprite-list',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'data/sprites.json', source: JSON.stringify({ version: spriteVersion, files: spriteFiles }) });
  },
});

export default defineConfig({
  plugins: [
    react(),
    spriteList(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-180.png'],
      manifest: {
        name: 'TedDex',
        short_name: 'TedDex',
        description: 'An offline-first dex and team builder.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6F5F2',
        theme_color: '#F6F5F2',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell and every data file are precached; sprites (~3,600 files) would bloat the precache manifest,
        // so the app warms the sprite cache below in the background instead. Either way the dex works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Same folders as SPRITE_DIRS (sprites/shiny is under sprites/), spelled out: Workbox copies this function into sw.js as source.
            urlPattern: ({ url }) => /^\/media\/(sprites|items|guide|trainers|dexes)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: `sprites-${spriteVersion}`, cacheableResponse: { statuses: [200] } },
          },
          {
            // Artwork and cries (~27 MB in total) are cached the first time they are seen.
            // Range support lets Safari play a cached cry, since it requests audio in byte ranges.
            // Room for every artwork and cry, with headroom for new forms.
            // A media rebuild keeps the URLs (a copy cached earlier stays valid), so ignore Vary (the warm-up fetch and Safari's audio request differ).
            urlPattern: ({ url }) => /^\/media\/(artwork|cries)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'media',
              rangeRequests: true,
              matchOptions: { ignoreVary: true },
              expiration: { maxEntries: Math.ceil(mediaFiles * 1.1), maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
