# Tests

`npm test` runs every folder below with Node's test runner through tsx, and is the check to run before a commit.

## `logic/`

Pure functions in `src/data/`, on small inline fixtures: filters, search, coverage maths, backup parsing. The only built file they read is `types.json`, for the type chart. They take about a second, so run them while working with `npm run test:logic`.

## `pipeline/`

The build scripts' parsers and joins in `scripts/`: Bulbapedia wikitext, encounter summaries, Mega stones. A few also check the output those scripts committed, so `availability.test.ts` fails after `npm run data` until `npm run availability` has run again.

## `data/`

The built output in `public/data/` and `public/media/`, and the app's logic running on it: every chunk, form, learnset and sprite. `npm run test:data` runs this folder only; after rebuilding data run `npm test`, as some `pipeline/` and `design/` tests read the output too.

## `design/`

The design rules that can be checked without a browser, mostly from source: the CSS structure, type scale, colour contrast, motion durations, the boot screen and the design drift script.

## `helpers/`

Shared readers, not tests: `css.ts` reads the stylesheets, `data-files.ts` the built data, `trainer-data.ts` the League and Gym folders. CSS tests read through `css.ts`; prefer `data-files.ts` for built data, though some tests still read it directly.

## Coverage

`npm run test:coverage` runs everything with Node's built-in coverage and reports `src/data/`. Node counts only the modules a test loaded, so `logic/data-modules.test.ts` loads them all and an untested one shows up low instead of missing. `types.ts` is left out, as it has no runtime code. The report has no threshold. Its temporary files go under `node_modules/.tmp`, as they can overflow a small `/tmp`.

## What is not automated

The UI. No test renders a component or drives a browser, so screens, gestures, view transitions and the iPhone behaviour are checked by hand at 390×844.
