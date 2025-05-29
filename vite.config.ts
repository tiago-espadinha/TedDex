import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
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
        // App shell, every data file and every sprite are precached, so the dex works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}', 'media/sprites/*.webp', 'media/items/*.webp'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Artwork and cries (~31 MB in total) are cached the first time they are seen.
            // Range support lets Safari play a cached cry, since it requests audio in byte ranges.
            // Up to 2100 entries: artwork + cry for each of the 1025 species, with headroom.
            // Files never change, so ignore Vary (the warm-up fetch and Safari's audio request differ).
            urlPattern: ({ url }) => /^\/media\/(artwork|cries)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'media',
              rangeRequests: true,
              matchOptions: { ignoreVary: true },
              expiration: { maxEntries: 2100, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
