import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  activeDexFilters,
  caughtCount,
  customView,
  dexCounts,
  dexFilterParams,
  dexViews,
  filterDexCells,
  gameDexes,
  lastSpecies,
  nextState,
  readDexFilters,
  type DexFilters,
} from '../src/data/pokedex';
import type { Pokedexes, TypeName } from '../src/data/types';

describe('lastSpecies', () => {
  test('lists the national dex up to the generation', () => {
    assert.equal(lastSpecies(1), 151);
    assert.equal(lastSpecies(4), 493);
    assert.equal(lastSpecies(8), 905);
    assert.equal(lastSpecies(9), 1025);
  });

  test('any game lists every species', () => {
    assert.equal(lastSpecies(undefined), 1025);
  });
});

describe('customView', () => {
  test('lists only the picked species, in national order with national numbers', () => {
    assert.deepEqual(customView([143, 25, 133]), {
      key: 'custom',
      label: 'Custom',
      cells: [
        { id: 25, no: 25 },
        { id: 133, no: 133 },
        { id: 143, no: 143 },
      ],
    });
  });
});

describe('nextState', () => {
  test('cycles not seen, seen, caught, shiny and back', () => {
    assert.deepEqual(
      [0, 1, 2, 3].map((s) => nextState(s as 0 | 1 | 2 | 3)),
      [1, 2, 3, 0],
    );
  });
});

describe('dexCounts', () => {
  test('seen includes caught and shiny, caught includes shiny', () => {
    assert.deepEqual(dexCounts({ 1: 1, 4: 2, 7: 3, 25: 2 }, 151), { seen: 4, caught: 3, shiny: 1, total: 151 });
  });

  test('ignores species past the last one', () => {
    assert.deepEqual(dexCounts({ 1: 3, 152: 3, 1025: 1 }, 151), { seen: 1, caught: 1, shiny: 1, total: 151 });
  });
});

describe('gameDexes', () => {
  const data: Pokedexes = {
    dexes: [
      { id: 12, name: 'Central Kalos', first: 1, species: [650] },
      { id: 13, name: 'Coastal Kalos', first: 1, species: [138] },
    ],
    groups: { 15: [12, 13] },
  };

  test("lists a game's dexes in its order", () => {
    assert.deepEqual(
      gameDexes(data, 15).map((d) => d.name),
      ['Central Kalos', 'Coastal Kalos'],
    );
  });

  test('a game the data lacks has none', () => {
    assert.deepEqual(gameDexes(data, 99), []);
  });
});

describe('caughtCount', () => {
  test('counts caught and shiny species of the list only', () => {
    assert.equal(caughtCount({ 1: 1, 4: 2, 7: 3, 25: 2 }, [1, 4, 7]), 2);
  });
});

describe('dexViews', () => {
  const views = dexViews(
    [
      { id: 4, name: 'Hoenn', first: 1, species: [252, 253] },
      { id: 8, name: 'Unova', first: 0, species: [494, 495] },
    ],
    3,
  );

  test('numbers each regional dex from its first, then lists National', () => {
    assert.deepEqual(
      views.map((v) => [v.key, v.label]),
      [
        ['4', 'Hoenn'],
        ['8', 'Unova'],
        ['national', 'National'],
      ],
    );
    assert.deepEqual(views[0].cells, [
      { id: 252, no: 1 },
      { id: 253, no: 2 },
    ]);
    assert.deepEqual(views[1].cells, [
      { id: 494, no: 0 },
      { id: 495, no: 1 },
    ]);
  });

  test('National lists species 1 to last', () => {
    assert.deepEqual(views[2].cells, [
      { id: 1, no: 1 },
      { id: 2, no: 2 },
      { id: 3, no: 3 },
    ]);
  });
});

describe('filterDexCells', () => {
  const species = new Map<number, { name: string; types: TypeName[] }>([
    [258, { name: 'Mudkip', types: ['water'] }],
    [259, { name: 'Marshtomp', types: ['water', 'ground'] }],
    [252, { name: 'Treecko', types: ['grass'] }],
    [255, { name: 'Torchic', types: ['fire'] }],
  ]);
  const cells = [252, 255, 258, 259].map((id, i) => ({ id, no: i + 1 }));
  const states = { 252: 2, 258: 2, 259: 1 } as const;
  const run = (f: Partial<DexFilters>) =>
    filterDexCells(cells, states, species, { query: '', states: [], types: [], ...f }).map((c) => c.id);

  test('no filters keep every cell', () => {
    assert.deepEqual(run({}), [252, 255, 258, 259]);
  });

  test('caught and water lists only caught water species', () => {
    assert.deepEqual(run({ states: [2], types: ['water'] }), [258]);
  });

  test('states and types are any-of', () => {
    assert.deepEqual(run({ states: [0, 1] }), [255, 259]);
    assert.deepEqual(run({ types: ['grass', 'ground'] }), [252, 259]);
  });

  test('search matches names, not-seen species included', () => {
    assert.deepEqual(run({ query: 'mud' }), [258]);
    assert.deepEqual(run({ query: 'tor' }), [255]);
  });

  test("a number matches the view's number", () => {
    assert.deepEqual(run({ query: '3' }), [258]);
  });
});

describe('dex filter params', () => {
  test('round-trip through the URL, empty values left out', () => {
    const f: DexFilters = { query: 'mud', states: [0, 2], types: ['water'] };
    const params = dexFilterParams(f);
    assert.deepEqual(params, { q: 'mud', state: '0,2', type: 'water' });
    assert.deepEqual(readDexFilters(new URLSearchParams(params)), f);
    assert.deepEqual(dexFilterParams({ query: '', states: [], types: [] }), {});
  });

  test('unknown states and types are dropped', () => {
    assert.deepEqual(readDexFilters(new URLSearchParams('state=,2,7,x,2&type=water,fake')), {
      query: '',
      states: [2],
      types: ['water'],
    });
  });

  test('the badge counts states and types', () => {
    assert.equal(activeDexFilters({ query: 'x', states: [0, 1], types: ['fire'] }), 3);
  });
});
