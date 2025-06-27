import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  activeItemFilters,
  filterItems,
  itemFilterParams,
  readItemFilters,
  type ItemFilters,
} from '../src/data/itemFilter';
import type { ItemInfo } from '../src/data/types';

const item = (name: string, over: Partial<ItemInfo>): { name: string; item: ItemInfo } => ({
  name,
  item: { name, category: 'Held items', gen: 2, cost: 0, effect: '', wild: [], ...over },
});
const ITEMS = [
  item('Oran Berry', { category: 'Berries', cost: 80 }),
  item('Leftovers', { cost: 4000 }),
  item('Charizardite X', { category: 'Mega Stones', gen: 6 }),
  item('Poké Ball', { category: 'Poké Balls', gen: 1, cost: 200 }),
  item('Life Orb', { gen: 4 }),
  item('★And15', { category: 'Key items', gen: 8, cost: 20 }),
];
const DEFAULT: ItemFilters = { query: '', categories: [], gens: [] };
const names = (f: Partial<ItemFilters>) => filterItems(ITEMS, { ...DEFAULT, ...f }).map((i) => i.name);

describe('filterItems', () => {
  test('default is A to Z', () => {
    assert.deepEqual(names({}), ['Charizardite X', 'Leftovers', 'Life Orb', 'Oran Berry', 'Poké Ball', '★And15']);
  });

  test('names that start with a symbol come after the rest, also when searching', () => {
    assert.deepEqual(names({ query: 'an' }), ['Oran Berry', '★And15']);
    assert.deepEqual(names({ query: 'a' }).at(-1), '★And15');
  });

  test('category and generation are each a union and combine', () => {
    assert.deepEqual(names({ categories: ['Berries'] }), ['Oran Berry']);
    assert.deepEqual(names({ gens: [6] }), ['Charizardite X']);
    assert.deepEqual(names({ categories: ['Held items', 'Poké Balls'], gens: [1, 2] }), ['Leftovers', 'Poké Ball']);
  });

  test('the query narrows the filtered list', () => {
    assert.deepEqual(names({ query: 'l', categories: ['Held items'] }), ['Leftovers', 'Life Orb']);
    assert.deepEqual(names({ query: 'pokeball' }), ['Poké Ball']);
  });
});

describe('item filters in the URL', () => {
  test('round-trip through slugs and drop unknown values', () => {
    const f: ItemFilters = { query: 'orb', categories: ['Poké Balls', 'TMs & TRs'], gens: [1, 6] };
    const params = itemFilterParams(f);
    assert.deepEqual(params, { q: 'orb', cat: 'pokeballs,tmstrs', gen: '1,6' });
    assert.deepEqual(readItemFilters(new URLSearchParams(params)), f);
    assert.deepEqual(readItemFilters(new URLSearchParams('cat=nope,berries&gen=0,3,12')), {
      query: '',
      categories: ['Berries'],
      gens: [3],
    });
  });

  test('empty filters leave no params and count zero', () => {
    assert.deepEqual(itemFilterParams(DEFAULT), {});
    assert.equal(activeItemFilters(DEFAULT), 0);
    assert.equal(activeItemFilters({ query: 'x', categories: ['Berries'], gens: [1, 2] }), 3);
  });
});
