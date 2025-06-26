import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Fuse from 'fuse.js';
import { DEFAULT_FILTERS, isPicking, parseFormKinds, type DexFilters } from '../src/data/dexState';
import { FUSE_OPTIONS, applyFilters, dexRows, favouriteKey } from '../src/data/filter';
import type { FormKind, IndexEntry, IndexForm } from '../src/data/types';

/** A grid row with made-up stats and size; only the fields a test sorts by matter. */
const mon = (
  id: number,
  name: string,
  types: IndexEntry['types'],
  gen: number,
  total: number,
  atk = 50,
  weightKg = 10,
): IndexEntry => ({
  id,
  name,
  types,
  gen,
  total,
  stats: { hp: 50, atk, def: 50, spa: 50, spd: 50, spe: 50 },
  heightM: 1,
  weightKg,
});

const ALL: IndexEntry[] = [
  { ...mon(1, 'Bulbasaur', ['grass', 'poison'], 1, 318, 49, 6.9), tags: ['starter'] },
  { ...mon(6, 'Charizard', ['fire', 'flying'], 1, 534, 84, 90.5), tags: ['mega'] },
  mon(25, 'Pikachu', ['electric'], 1, 320, 55, 6),
  { ...mon(250, 'Ho-Oh', ['fire', 'flying'], 2, 680, 130, 199), tags: ['legendary'] },
  { ...mon(255, 'Torchic', ['fire'], 3, 310, 60, 2.5), tags: ['starter'] },
  mon(315, 'Roselia', ['grass', 'poison'], 3, 400, 60, 2),
];
const fuse = new Fuse(ALL, FUSE_OPTIONS);

const ids = (f: Partial<DexFilters>) => applyFilters(ALL, fuse, { ...DEFAULT_FILTERS, ...f }).map((m) => m.id);

describe('applyFilters', () => {
  test('no filters keeps dex order', () => {
    assert.deepEqual(ids({}), [1, 6, 25, 250, 255, 315]);
  });

  test('number search matches ids that start with it, with or without # and leading zeros', () => {
    assert.deepEqual(ids({ query: '25' }), [25, 250, 255]);
    assert.deepEqual(ids({ query: '#0025' }), [25, 250, 255]);
    assert.deepEqual(ids({ query: '6' }), [6]);
  });

  test('a type word filters by type instead of name', () => {
    assert.deepEqual(ids({ query: 'Fire ' }), [6, 250, 255]);
  });

  test('name search is fuzzy and case-insensitive', () => {
    assert.deepEqual(ids({ query: 'PIKACHU' }), [25]);
    assert.deepEqual(ids({ query: 'charzard' }), [6]);
    assert.deepEqual(ids({ query: 'zzzz' }), []);
  });

  test('name search without a Fuse index leaves the list as is', () => {
    assert.equal(applyFilters(ALL, null, { ...DEFAULT_FILTERS, query: 'pika' }).length, ALL.length);
  });

  test('generations are a union', () => {
    assert.deepEqual(ids({ gens: [2, 3] }), [250, 255, 315]);
  });

  test('one type matches single and dual types', () => {
    assert.deepEqual(ids({ types: ['fire'] }), [6, 250, 255]);
  });

  test('several types match any of them', () => {
    assert.deepEqual(ids({ types: ['flying', 'fire'] }), [6, 250, 255]);
    assert.deepEqual(ids({ types: ['fire', 'grass'] }), [1, 6, 250, 255, 315]);
    assert.deepEqual(ids({ types: ['fire', 'grass', 'electric'] }), [1, 6, 25, 250, 255, 315]);
  });

  test('a type word combines with type filters', () => {
    assert.deepEqual(ids({ query: 'fire', types: ['flying'] }), [6, 250]);
    assert.deepEqual(ids({ query: 'fire', types: ['fire'] }), [6, 250, 255]);
    assert.deepEqual(ids({ query: 'fire', types: ['fire', 'flying'] }), [6, 250, 255]);
    assert.deepEqual(ids({ query: 'fire', types: ['grass'] }), []);
    assert.deepEqual(ids({ query: 'grass', types: ['poison'], gens: [3] }), [315]);
  });

  test('search, generation and type filters combine', () => {
    assert.deepEqual(ids({ query: '25', gens: [2, 3], types: ['fire'] }), [250, 255]);
  });

  test('a category keeps only its species and combines with the other filters', () => {
    assert.deepEqual(ids({ category: 'starter' }), [1, 255]);
    assert.deepEqual(ids({ category: 'starter', types: ['fire'] }), [255]);
    assert.deepEqual(ids({ category: 'baby' }), []);
  });

  test('Favourites keeps the rows whose species and form are favourites, and combines with the other filters', () => {
    const megaX = {
      key: 'mega-x',
      label: 'Mega X',
      name: 'Mega Charizard X',
      kind: 'mega',
      pokemonId: 10034,
      types: ['fire', 'dragon'],
      stats: ALL[1].stats,
      total: 634,
      heightM: 1.7,
      weightKg: 110.5,
    } as IndexForm;
    const rows = dexRows([ALL[0], { ...ALL[1], forms: [megaX] }, ...ALL.slice(2)], ['mega']);
    const run = (favs: string[], f: Partial<DexFilters> = {}) =>
      applyFilters(rows, null, { ...DEFAULT_FILTERS, category: 'favourite', ...f }, new Set(favs)).map((m) =>
        favouriteKey(m.id, m.form?.key),
      );
    const favs = [favouriteKey(1), favouriteKey(6, 'mega-x'), favouriteKey(255)];
    assert.deepEqual(favs, ['1', '6:mega-x', '255']);
    // The form is a favourite, not its species: only the form row shows.
    assert.deepEqual(run(favs), ['1', '6:mega-x', '255']);
    assert.deepEqual(run(favs, { types: ['fire'] }), ['6:mega-x', '255']);
    assert.deepEqual(run(favs, { gens: [1] }), ['1', '6:mega-x']);
    assert.deepEqual(run([]), []);
    // Without the form's row (its Dex switch off), a favourite form shows nothing.
    assert.deepEqual(
      applyFilters(ALL, null, { ...DEFAULT_FILTERS, category: 'favourite' }, new Set(favs)).map((m) => m.id),
      [1, 255],
    );
    // Still loading: nothing matches yet.
    assert.deepEqual(applyFilters(ALL, null, { ...DEFAULT_FILTERS, category: 'favourite' }).length, 0);
  });

  test('sort by name', () => {
    assert.deepEqual(ids({ sort: 'name' }), [1, 6, 250, 25, 315, 255]);
  });

  test('sort by base total, highest first, ties by number', () => {
    const tied = [...ALL, mon(7, 'Tie', ['water'], 1, 320)];
    const out = applyFilters(tied, null, { ...DEFAULT_FILTERS, sort: 'total' }).map((m) => m.id);
    assert.deepEqual(out, [250, 6, 315, 7, 25, 1, 255]);
  });

  test('sort by a stat, highest first, ties by number', () => {
    assert.deepEqual(ids({ sort: 'atk' }), [250, 6, 255, 315, 25, 1]);
  });

  test('sort by weight, heaviest first', () => {
    assert.deepEqual(ids({ sort: 'weight' }), [250, 6, 1, 25, 255, 315]);
  });

  test('sorting does not mutate the input', () => {
    const before = ALL.map((m) => m.id);
    ids({ sort: 'name' });
    assert.deepEqual(
      ALL.map((m) => m.id),
      before,
    );
  });
});

/** A form for the index: its kind, types and base total; stats and size don't matter here. */
const form = (
  key: string,
  kind: IndexForm['kind'],
  pokemonId: number,
  name: string,
  types: IndexForm['types'],
  total: number,
  atk = 50,
): IndexForm => ({
  key,
  label: name.split(' ')[0],
  kind,
  pokemonId,
  name,
  types,
  total,
  stats: { hp: 50, atk, def: 50, spa: 50, spd: 50, spe: 50 },
  heightM: 1,
  weightKg: 10,
});

const WITH_FORMS: IndexEntry[] = [
  {
    ...mon(6, 'Charizard', ['fire', 'flying'], 1, 534, 84),
    tags: ['mega'],
    forms: [
      form('mega-x', 'mega', 10034, 'Mega Charizard X', ['fire', 'dragon'], 634, 130),
      form('mega-y', 'mega', 10035, 'Mega Charizard Y', ['fire', 'flying'], 634, 104),
      form('gmax', 'gmax', 10196, 'Gigantamax Charizard', ['fire', 'flying'], 534, 84),
    ],
  },
  {
    ...mon(37, 'Vulpix', ['fire'], 1, 299),
    tags: ['regional'],
    forms: [form('alola', 'regional', 10103, 'Alolan Vulpix', ['ice'], 299)],
  },
  {
    ...mon(479, 'Rotom', ['electric', 'ghost'], 4, 440),
    forms: [form('heat', 'other', 10008, 'Heat Rotom', ['electric', 'fire'], 520)],
  },
  mon(149, 'Dragonite', ['dragon', 'flying'], 1, 600, 134),
];

/** Rows for the switched-on kinds, filtered; each as its species number plus form key ("6", "6:mega-x"). */
const rowKeys = (kinds: FormKind[], f: Partial<DexFilters> = {}) => {
  const rows = dexRows(WITH_FORMS, kinds);
  return applyFilters(rows, new Fuse(rows, FUSE_OPTIONS), { ...DEFAULT_FILTERS, ...f }).map((r) =>
    r.form ? `${r.id}:${r.form.key}` : `${r.id}`,
  );
};

describe('dexRows', () => {
  test('with every switch off there is one row per species, without the form lists', () => {
    const rows = dexRows(WITH_FORMS, []);
    assert.deepEqual(
      rows.map((r) => r.id),
      [6, 37, 479, 149],
    );
    assert.ok(rows.every((r) => !('forms' in r) && !r.form));
  });

  test('each switch adds only its kind, right after the species', () => {
    assert.deepEqual(rowKeys(['mega']), ['6', '6:mega-x', '6:mega-y', '37', '479', '149']);
    assert.deepEqual(rowKeys(['regional']), ['6', '37', '37:alola', '479', '149']);
    assert.deepEqual(rowKeys(['gmax']), ['6', '6:gmax', '37', '479', '149']);
    assert.deepEqual(rowKeys(['other']), ['6', '37', '479', '479:heat', '149']);
  });

  test("a form row has the form's types and stats with the species' name, number, generation and tags", () => {
    const megaX = dexRows(WITH_FORMS, ['mega'])[1];
    assert.deepEqual(megaX.types, ['fire', 'dragon']);
    assert.equal(megaX.total, 634);
    assert.deepEqual([megaX.name, megaX.id, megaX.gen, megaX.tags], ['Charizard', 6, 1, ['mega']]);
    assert.deepEqual(megaX.form, {
      key: 'mega-x',
      label: 'Mega',
      name: 'Mega Charizard X',
      kind: 'mega',
      pokemonId: 10034,
    });
  });

  test('Fire+Dragon includes Mega Charizard X only with Megas on', () => {
    assert.ok(rowKeys(['mega'], { types: ['fire', 'dragon'] }).includes('6:mega-x'));
    assert.ok(!rowKeys([], { types: ['fire', 'dragon'] }).includes('6:mega-x'));
    assert.deepEqual(rowKeys(['mega'], { query: 'dragon' }), ['6:mega-x', '149']);
  });

  test('search finds forms by name and number', () => {
    assert.deepEqual(rowKeys(['regional'], { query: 'alolan' }), ['37:alola']);
    assert.deepEqual(rowKeys(['other'], { query: 'heat rotom' }), ['479:heat']);
    assert.deepEqual(rowKeys(['mega', 'gmax'], { query: '6' }), ['6', '6:mega-x', '6:mega-y', '6:gmax']);
    assert.deepEqual(rowKeys(['mega'], { query: 'charizard' }), ['6', '6:mega-x', '6:mega-y']);
  });

  test('sorts and generation filters apply to form rows', () => {
    assert.deepEqual(rowKeys(['mega', 'other'], { sort: 'total' }).slice(0, 4), ['6:mega-x', '6:mega-y', '149', '6']);
    assert.deepEqual(rowKeys(['mega'], { sort: 'atk' }).slice(0, 2), ['149', '6:mega-x']);
    assert.deepEqual(rowKeys(['other'], { gens: [4] }), ['479', '479:heat']);
    assert.deepEqual(rowKeys(['mega', 'regional'], { sort: 'name' }), [
      '6',
      '6:mega-x',
      '6:mega-y',
      '149',
      '479',
      '37',
      '37:alola',
    ]);
  });
});

describe('parseFormKinds', () => {
  test('reads the stored list in Settings order and ignores unknown words', () => {
    assert.deepEqual(parseFormKinds('gmax,mega,shiny'), ['mega', 'gmax']);
    assert.deepEqual(parseFormKinds(''), []);
  });
  test('nothing stored switches on every kind but Gigantamax; a stored choice, all off included, is kept', () => {
    assert.deepEqual(parseFormKinds(null), ['mega', 'regional', 'other']);
    assert.deepEqual(parseFormKinds('gmax'), ['gmax']);
  });
});

describe('isPicking', () => {
  test('pick mode is a team id or a Compare side', () => {
    const at = (search: string) => isPicking(new URLSearchParams(search));
    assert.equal(at('pick=3'), true);
    assert.equal(at('compare=b&a=6'), true);
    assert.equal(at(''), false);
    assert.equal(at('pick='), false);
    assert.equal(at('pick=x'), false);
    assert.equal(at('compare=c'), false);
  });
});
