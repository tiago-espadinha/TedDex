import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { defensiveCoverage, offensiveCoverage } from '../src/data/coverage';
import type { TypeData } from '../src/data/types';
import typesJson from '../public/data/types.json' with { type: 'json' };

const CHART = typesJson as TypeData;
const row = <T extends { type: string }>(rows: T[], type: string) => rows.find((r) => r.type === type)!;

describe('defensiveCoverage', () => {
  test('one row per attacking type with weak and resist counts', () => {
    const { rows } = defensiveCoverage([['fire', 'flying'], ['water'], ['grass']], CHART);
    assert.equal(rows.length, 18);
    assert.deepEqual(row(rows, 'electric'), { type: 'electric', mults: [2, 2, 0.5], count: 2, resist: 1 });
    assert.deepEqual(row(rows, 'ice'), { type: 'ice', mults: [1, 0.5, 2], count: 1, resist: 1 });
  });

  test('biggest threat is the type most members are weak to', () => {
    const { threat } = defensiveCoverage([['fire', 'flying'], ['water'], ['grass']], CHART);
    assert.equal(threat.type, 'electric');
    assert.equal(threat.count, 2);
  });

  test('ties go to the type fewer members resist, an immunity counting as a resist', () => {
    // Fighting, ghost and dark each hit one member 2×; Ghost is immune to fighting and Normal to ghost.
    const { threat } = defensiveCoverage([['normal'], ['ghost']], CHART);
    assert.equal(threat.type, 'dark');
    assert.equal(threat.resist, 0);
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
