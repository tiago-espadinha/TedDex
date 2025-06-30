# Deployment

TedDex is a static site, live at <https://teddex.vercel.app/> on Vercel's free tier. There is no server, database,
environment variable or CI.

## Configuration

`vercel.json` sets:

- **Build:** `npm run build`, output `dist`.
- **Single-page fallback:** unknown paths serve `/index.html`, except `/assets`, `/data`, `/media` and `/icons`, so a
  missing file stays a 404.
- **Caching:** a long immutable cache on the hashed `/assets`. Everything else keeps Vercel's default `max-age=0,
  must-revalidate`, so `sw.js` and `index.html` are always checked and installed apps pick up updates.

`.vercelignore` uploads only what the build needs: `src`, `public`, `tests`, the `scripts` that end in `.ts` or `.json`,
and the root config files. `tests` and `scripts` go too because `tsc -b` checks them.

## First deploy

1. `npx vercel login`, then `npx vercel` in the project root: link a new project and accept the detected settings.
2. `npx vercel --prod`, and note the `*.vercel.app` URL. Or import the Git repository in the Vercel dashboard.

## Before a release

```bash
npx tsc -b && npm run lint && npm run format:check && npm test && npm run build
```

## After a release

1. Check that `/` and a deep link such as `/pokemon/25` load, then reload the deep link, at 375, 768 and 1280 px.
2. On a mobile device, open the URL, add it to the home screen (in iOS Safari, **Share › Add to Home Screen**), and open it once online.
3. Browse a few Pokémon, turn on airplane mode and reopen it: the Dex, a detail page and teams should still work.

The service worker only runs in a production build, and only over HTTPS or on localhost, so testing offline on a phone
needs a deploy.

## Other hosts

Any static host with HTTPS works with the same build, fallback and headers.
