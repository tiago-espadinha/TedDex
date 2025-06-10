import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { caughtCount, dexCounts, gameDexes, lastSpecies, nextState } from '../src/data/pokedex';
import type { Pokedexes } from '../src/data/types';

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

describe('nextState', () => {
  test('cycles not seen, seen, caught, shiny and back', () => {
    assert.deepEqual([0, 1, 2, 3].map((s) => nextState(s as 0 | 1 | 2 | 3)), [1, 2, 3, 0]);
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
    assert.deepEqual(gameDexes(data, 15).map((d) => d.name), ['Central Kalos', 'Coastal Kalos']);
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
