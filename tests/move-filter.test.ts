import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { filterMoves, moveFilterParams, readMoveFilters, type MoveFilters } from '../src/data/moveFilter';
import type { MoveInfo } from '../src/data/types';

const move = (name: string, over: Partial<MoveInfo>): { name: string; move: MoveInfo } => ({
  name,
  move: { name, type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 30, priority: 0, gen: 1, ...over },
});
const MOVES = [
  move('Quick Attack', { priority: 1 }),
  move('Thunderbolt', { type: 'electric', category: 'special', power: 90, pp: 15 }),
  move('Swift', { category: 'special', power: 60, accuracy: null, pp: 20 }),
  move('Protect', { category: 'status', power: null, accuracy: null, pp: 10, priority: 4, gen: 2 }),
  move('Close Combat', { type: 'fighting', power: 120, pp: 5, gen: 4 }),
];
const DEFAULT: MoveFilters = { query: '', categories: [], gens: [], types: [], sort: 'name' };
const names = (f: Partial<MoveFilters>) => filterMoves(MOVES, { ...DEFAULT, ...f }).map((m) => m.name);

describe('filterMoves', () => {
  test('default is A to Z', () => {
    assert.deepEqual(names({}), ['Close Combat', 'Protect', 'Quick Attack', 'Swift', 'Thunderbolt']);
  });

  test('category, generation and type filters are each a union and combine', () => {
    assert.deepEqual(names({ categories: ['special', 'status'] }), ['Protect', 'Swift', 'Thunderbolt']);
    assert.deepEqual(names({ gens: [2, 4] }), ['Close Combat', 'Protect']);
    assert.deepEqual(names({ types: ['normal'], categories: ['physical'] }), ['Quick Attack']);
  });

  test('sorts put the highest first; no power or PP last, never-miss first for accuracy', () => {
    assert.deepEqual(names({ sort: 'power' }), ['Close Combat', 'Thunderbolt', 'Swift', 'Quick Attack', 'Protect']);
    assert.deepEqual(names({ sort: 'accuracy' }), ['Protect', 'Swift', 'Close Combat', 'Quick Attack', 'Thunderbolt']);
    assert.deepEqual(names({ sort: 'priority' }).slice(0, 2), ['Protect', 'Quick Attack']);
    assert.deepEqual(names({ sort: 'pp' }), ['Quick Attack', 'Swift', 'Thunderbolt', 'Protect', 'Close Combat']);
  });

  test('search narrows before the sort', () => {
    assert.deepEqual(names({ query: 'th', sort: 'power' }), ['Thunderbolt']);
  });
});

describe('move filter URL params', () => {
  test('round-trip and defaults left out', () => {
    const f: MoveFilters = { query: 'bolt', categories: ['special'], gens: [1, 4], types: ['electric'], sort: 'power' };
    assert.deepEqual(readMoveFilters(new URLSearchParams(moveFilterParams(f))), f);
    assert.deepEqual(moveFilterParams(DEFAULT), {});
  });

  test('unknown values are dropped', () => {
    assert.deepEqual(readMoveFilters(new URLSearchParams('cat=magic,status&gen=0,3,12&type=wood&sort=speed')), {
      ...DEFAULT, categories: ['status'], gens: [3],
    });
  });
});
