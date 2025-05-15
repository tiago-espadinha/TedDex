# Material Dex Web

An offline-first, installable web app (PWA) dex and team builder, built mobile-first for iPhone.
Unofficial, non-commercial fan project. Data from [PokeAPI](https://pokeapi.co).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

To try it on an iPhone, run `npm run dev -- --host`, open the shown network URL in Safari on the same Wi-Fi,
then **Share › Add to Home Screen**. The service worker (offline mode) only runs in a production build
(`npm run build && npm run preview -- --host`) and only over HTTPS or localhost, so deploy to test offline on the phone.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck + production build into `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build |
| `npm run data` | Rebuild `public/data/` from PokeAPI's CSV dump (cached in `.cache/`; `-- --fresh` to re-download) |
| `npm run media` | Rebuild `public/media/` (WebP sprites/artwork, M4A cries) from PokeAPI's repos; needs `ffmpeg` |
| `npm run lint` | oxlint |
| `python3 scripts/make-icons.py public/icons` | Re-render the PNG app icons (needs Pillow) |

## Deploy

Any static host with HTTPS works. Cloudflare Pages or Vercel: build command `npm run build`, output `dist`,
and a single-page-app fallback to `/index.html` (both detect Vite automatically).

## Project layout

```
scripts/build-data.ts   PokeAPI CSV → public/data/*.json
public/data/            generated data (committed, so the app runs without the build step)
src/main.tsx            router + app shell (bottom nav, toasts, scroll restoration)
src/styles.css          Design A tokens (light + dark) and all component styles
src/data/               data loading, IndexedDB (Dexie) teams, filters, settings, type colours
src/components/         icons, type chips, bottom nav, toast
src/screens/            Dex grid, filter sheet, detail, teams, coverage, reference, more
```

## Status

See `CLAUDE.md` for what's done, what's next and the conventions to follow.
