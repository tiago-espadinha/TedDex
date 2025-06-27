import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  abilityFilterParams,
  activeAbilityFilters,
  filterAbilities,
  readAbilityFilters,
  type AbilityFilters,
} from '../src/data/abilityFilter';

const ABILITIES = [
  { name: 'Intimidate', gen: 3 },
  { name: 'Levitate', gen: 3 },
  { name: 'Protean', gen: 6 },
  { name: 'Intrepid Sword', gen: 8 },
];
const DEFAULT: AbilityFilters = { query: '', gens: [] };
const names = (f: Partial<AbilityFilters>) => filterAbilities(ABILITIES, { ...DEFAULT, ...f }).map((a) => a.name);

describe('filterAbilities', () => {
  test('no filters lists everything A to Z', () => {
    assert.deepEqual(names({}), ['Intimidate', 'Intrepid Sword', 'Levitate', 'Protean']);
  });

  test('generations are a union and combine with the query', () => {
    assert.deepEqual(names({ gens: [3] }), ['Intimidate', 'Levitate']);
    assert.deepEqual(names({ gens: [6, 8] }), ['Intrepid Sword', 'Protean']);
    assert.deepEqual(names({ query: 'int', gens: [3] }), ['Intimidate']);
    assert.deepEqual(names({ gens: [1] }), []);
  });
});

describe('ability filters in the URL', () => {
  test('round-trip and drop unknown generations', () => {
    const f: AbilityFilters = { query: 'lev', gens: [3, 6] };
    const params = abilityFilterParams(f);
    assert.deepEqual(params, { q: 'lev', gen: '3,6' });
    assert.deepEqual(readAbilityFilters(new URLSearchParams(params)), f);
    assert.deepEqual(readAbilityFilters(new URLSearchParams('gen=0,3,x,12')), { query: '', gens: [3] });
  });

  test('empty filters leave no params and count zero', () => {
    assert.deepEqual(abilityFilterParams(DEFAULT), {});
    assert.equal(activeAbilityFilters(DEFAULT), 0);
    assert.equal(activeAbilityFilters({ query: 'x', gens: [3, 4] }), 2);
  });
});
