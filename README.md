# TedDex

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

| Command                                      | What it does                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`                                | Dev server with hot reload                                                                        |
| `npm run build`                              | Typecheck + production build into `dist/` (includes the service worker)                           |
| `npm run preview`                            | Serve the production build                                                                        |
| `npm run data`                               | Rebuild `public/data/` from PokeAPI's CSV dump (cached in `.cache/`; `-- --fresh` to re-download) |
| `npm run media`                              | Rebuild `public/media/` (WebP sprites/artwork, M4A cries) from PokeAPI's repos; needs `ffmpeg`    |
| `npm run lint`                               | oxlint                                                                                            |
| `npm run format`                             | Format the code with Oxfmt (`npm run format:check` only checks)                                   |
| `python3 scripts/make-icons.py public/icons` | Re-render the app icons and favicon from `public/teddex.svg` (needs Inkscape)                     |

## Deploy

Hosted on Vercel's free tier. `vercel.json` sets the build (`npm run build` → `dist`), the single-page-app
fallback to `/index.html` (except `/assets`, `/data`, `/media`, `/icons`, so a missing file stays a 404) and
a long immutable cache on the hashed `/assets`. Everything else keeps Vercel's default `max-age=0,
must-revalidate`, so `sw.js` and `index.html` are always checked and installed apps pick up updates.
`.vercelignore` keeps local-only folders out of the upload.

1. `npx vercel login`, then `npx vercel` in the project root: link a new project, accept the detected settings.
2. `npx vercel --prod` and note the `*.vercel.app` URL. (Or import the Git repo in the Vercel dashboard.)
3. Check the URL: `/` and a deep link such as `/pokemon/25` load; reload a deep link; at 375, 768 and 1280 px.
4. On the iPhone: open the URL in Safari, **Share › Add to Home Screen**, open it once online, browse a few
   Pokémon, then switch on airplane mode and reopen it: the Dex, a detail page and teams still work.

Any other static host with HTTPS works with the same build, fallback and headers.

## Project layout

```
scripts/build-data.ts   PokeAPI CSV → public/data/*.json
public/data/            generated data (committed, so the app runs without the build step)
src/main.tsx            router + app shell (bottom nav, toasts, scroll restoration)
src/styles/             layer order, tokens (the only literal colours), base, shared rules, motion
src/data/               data loading, IndexedDB (Dexie) teams, filters, settings, type colours
src/components/<Name>/  one folder per shared component (icons, type chips, bottom nav, search field, toast)
src/hooks/              shared hooks (modal sheet, nav hiding, pager, keyboard inset)
src/screens/<feature>/  dex, detail, teams, pokedex, guide and settings screens
```

## Status

See `CLAUDE.md` for what's done, what's next and the conventions to follow.
