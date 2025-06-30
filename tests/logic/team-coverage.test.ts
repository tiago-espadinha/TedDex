import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { averageStats, defensiveCoverage, offensiveCoverage } from '../../src/data/coverage';
import type { TypeData } from '../../src/data/types';
import typesJson from '../../public/data/types.json' with { type: 'json' };

const CHART = typesJson as TypeData;
const row = <T extends { type: string }>(rows: T[], type: string) => rows.find((r) => r.type === type)!;

describe('defensiveCoverage', () => {
  test('one row per attacking type with weak and resist counts', () => {
    const { rows } = defensiveCoverage([['fire', 'flying'], ['water'], ['grass']], CHART);
    assert.equal(rows.length, 18);
    assert.deepEqual(row(rows, 'electric'), { type: 'electric', mults: [2, 2, 0.5], count: 2, resist: 1, score: -1 });
    assert.deepEqual(row(rows, 'ice'), { type: 'ice', mults: [1, 0.5, 2], count: 1, resist: 1, score: 0 });
  });

  test('score is +1 per member resisting and −1 per member weak, 4× and ¼× alike', () => {
    // Charizard and Blastoise.
    const { rows } = defensiveCoverage([['fire', 'flying'], ['water']], CHART);
    assert.equal(row(rows, 'water').score, 0);
    assert.equal(row(rows, 'rock').score, -1);
    assert.equal(row(rows, 'grass').score, 0);
    assert.equal(row(rows, 'fire').score, 2);
  });

  test('an immunity scores +1 like a resist', () => {
    // Charizard is immune to ground, Blastoise neutral.
    assert.equal(row(defensiveCoverage([['fire', 'flying'], ['water']], CHART).rows, 'ground').score, 1);
  });

  test('biggest threat is the lowest score, even when another type has more weak members', () => {
    // Fighting hits both Normals 2× but Flying and Poison resist it (0); Rock hits only Flying 2× (−1).
    const { threat } = defensiveCoverage([['normal'], ['normal'], ['flying'], ['poison']], CHART);
    assert.equal(threat.type, 'rock');
    assert.equal(threat.score, -1);
  });

  test('ties at the lowest score go to the type more members are weak to', () => {
    // Electric, rock, flying and poison all score −1; electric hits two members 2×, the others one.
    const { threat } = defensiveCoverage([['fire', 'flying'], ['water'], ['grass']], CHART);
    assert.equal(threat.type, 'electric');
    assert.equal(threat.count, 2);
  });

  test('an immunity offsets a weakness in the score', () => {
    // Fighting and ghost each hit one member 2× and the other is immune (0); dark hits Ghost 2× (−1).
    const { threat } = defensiveCoverage([['normal'], ['ghost']], CHART);
    assert.equal(threat.type, 'dark');
    assert.equal(threat.score, -1);
  });

  test('equal ties keep the first type in chart order', () => {
    assert.equal(defensiveCoverage([['fire'], ['water']], CHART).threat.type, 'ground');
  });

  test('a threat count of 0 when nobody is weak to anything', () => {
    assert.equal(defensiveCoverage([[]], CHART).threat.count, 0);
  });

  test('STAB coverage counts the defending types some member type hits 2×', () => {
    assert.equal(defensiveCoverage([['normal']], CHART).stabHits, 0);
    assert.equal(defensiveCoverage([['ground'], ['fire']], CHART).stabHits, 8);
  });
});

describe('averageStats', () => {
  test('means of each stat and the total, rounded half up', () => {
    const charizard = { stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 }, total: 534 };
    const blastoise = { stats: { hp: 79, atk: 83, def: 100, spa: 85, spd: 105, spe: 78 }, total: 530 };
    assert.deepEqual(averageStats([charizard, blastoise]), {
      stats: { hp: 79, atk: 84, def: 89, spa: 97, spd: 95, spe: 89 },
      total: 532,
    });
  });

  test('one member averages to itself', () => {
    const mon = { stats: { hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6 }, total: 21 };
    assert.deepEqual(averageStats([mon]), mon);
  });
});

describe('offensiveCoverage', () => {
  test('members without damaging moves get null cells and do not count', () => {
    const { rows, hits } = offensiveCoverage([['electric', 'ice'], []], CHART);
    assert.deepEqual(row(rows, 'water'), { type: 'water', mults: [2, null], count: 1 });
    assert.equal(hits, 5);
  });

  test('walled by lists types nobody hits even neutrally', () => {
    assert.deepEqual(offensiveCoverage([['normal'], ['normal']], CHART).walls, ['rock', 'ghost', 'steel']);
    assert.deepEqual(offensiveCoverage([['fire'], ['ghost']], CHART).walls, []);
  });

  test('a resisted type is not a wall when another member hits it neutrally', () => {
    const { rows, walls } = offensiveCoverage([['fire'], ['ghost']], CHART);
    assert.deepEqual(row(rows, 'water').mults, [0.5, 1]);
    assert.ok(!walls.includes('water'));
  });
});
