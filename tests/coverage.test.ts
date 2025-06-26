import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { attackingTypes, defensiveMultipliers, offensiveMultipliers } from '../src/data/api';
import { matchupGroups } from '../src/data/coverage';
import type { MoveTable, TypeData } from '../src/data/types';
import typesJson from '../public/data/types.json' with { type: 'json' };

// The real chart from `npm run data`, so the tests also catch a bad data build.
const CHART = typesJson as TypeData;

describe('defensiveMultipliers', () => {
  test('covers every attacking type', () => {
    assert.equal(Object.keys(defensiveMultipliers(['normal'], CHART)).length, 18);
  });

  test('single type', () => {
    const m = defensiveMultipliers(['fire'], CHART);
    assert.equal(m.water, 2);
    assert.equal(m.grass, 0.5);
    assert.equal(m.normal, 1);
  });

  test('dual types multiply: 4x, 0.25x and immunity wins', () => {
    const charizard = defensiveMultipliers(['fire', 'flying'], CHART);
    assert.equal(charizard.rock, 4);
    assert.equal(charizard.grass, 0.25);
    assert.equal(charizard.ground, 0);
    assert.equal(charizard.water, 2);
  });

  test('no types means neutral to everything', () => {
    assert.ok(Object.values(defensiveMultipliers([], CHART)).every((x) => x === 1));
  });
});

describe('offensiveMultipliers', () => {
  test('best factor of any attacking type against each defending type', () => {
    const m = offensiveMultipliers(['electric', 'ice'], CHART);
    assert.equal(m.water, 2);
    assert.equal(m.dragon, 2);
    assert.equal(m.ground, 2);
    assert.equal(m.grass, 2);
    assert.equal(m.electric, 1);
    assert.equal(m.steel, 1);
    assert.equal(offensiveMultipliers(['fire'], CHART).water, 0.5);
  });

  test('an immunity stays 0 unless another type hits', () => {
    assert.equal(offensiveMultipliers(['normal'], CHART).ghost, 0);
    assert.equal(offensiveMultipliers(['normal', 'fighting'], CHART).ghost, 0);
    assert.equal(offensiveMultipliers(['normal', 'dark'], CHART).ghost, 2);
  });

  test('no attacking types gives 0 everywhere', () => {
    const m = offensiveMultipliers([], CHART);
    assert.equal(Object.keys(m).length, 18);
    assert.ok(Object.values(m).every((x) => x === 0));
  });
});

describe('attackingTypes', () => {
  const MOVES: MoveTable = {
    1: {
      name: 'Thunderbolt',
      type: 'electric',
      category: 'special',
      power: 90,
      accuracy: 100,
      pp: 15,
      priority: 0,
      gen: 1,
    },
    2: {
      name: 'Thunder Wave',
      type: 'electric',
      category: 'status',
      power: null,
      accuracy: 90,
      pp: 20,
      priority: 0,
      gen: 1,
    },
    3: {
      name: 'Volt Tackle',
      type: 'electric',
      category: 'physical',
      power: 120,
      accuracy: 100,
      pp: 15,
      priority: 0,
      gen: 1,
    },
    4: {
      name: 'Calm Mind',
      type: 'psychic',
      category: 'status',
      power: null,
      accuracy: null,
      pp: 20,
      priority: 0,
      gen: 1,
    },
    5: { name: 'Surf', type: 'water', category: 'special', power: 90, accuracy: 100, pp: 15, priority: 0, gen: 1 },
  };

  test('unique types of damaging moves, status moves ignored', () => {
    assert.deepEqual(attackingTypes([1, 2, 3, 4, 5], MOVES), ['electric', 'water']);
    assert.deepEqual(attackingTypes([4], MOVES), []);
  });

  test('missing moves and unknown ids are ignored', () => {
    assert.deepEqual(attackingTypes(undefined, MOVES), []);
    assert.deepEqual(attackingTypes([999, 5], MOVES), ['water']);
  });
});

describe('matchupGroups', () => {
  const names = (types: Parameters<typeof matchupGroups>[0]) =>
    matchupGroups(types, CHART).map((g) => [g.label, g.hits.map((h) => `${h.type} ${h.mult}`)]);

  test('Charizard (Fire/Flying): Rock 4× first, Ground immunity', () => {
    assert.deepEqual(names(['fire', 'flying']), [
      ['Weak to', ['rock 4', 'water 2', 'electric 2']],
      ['Resists', ['fighting 0.5', 'steel 0.5', 'fire 0.5', 'fairy 0.5', 'bug 0.25', 'grass 0.25']],
      ['Immune to', ['ground 0']],
    ]);
  });

  test('Blastoise (Water): weak to Grass and Electric, no immunity group', () => {
    assert.deepEqual(names(['water']), [
      ['Weak to', ['grass 2', 'electric 2']],
      ['Resists', ['steel 0.5', 'fire 0.5', 'water 0.5', 'ice 0.5']],
    ]);
  });
});
