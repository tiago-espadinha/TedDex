import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Fuse from 'fuse.js';
import { CATEGORY_LABELS, DEFAULT_FILTERS, type DexCategory } from '../src/data/dexState';
import { FUSE_OPTIONS, applyFilters, dexRows } from '../src/data/filter';
import { ITEM_CATEGORIES } from '../src/data/itemCategories';
import { ITEM_CATEGORY_WORDS, filterItems } from '../src/data/itemFilter';
import { filterMoves, type MoveFilters } from '../src/data/moveFilter';
import { parseQuery } from '../src/data/query';
import { searchKey } from '../src/data/reference';
import { SEARCH_HINTS, type HintList } from '../src/data/searchHints';
import type { IndexEntry, ItemReferenceTable, MoveInfo } from '../src/data/types';
import { readData } from './data-files';

// What the tips sheet promises, on the committed output of `npm run data`.
const rows = dexRows(readData<IndexEntry[]>('index.json'), []);
const fuse = new Fuse(rows, FUSE_OPTIONS);
const moves = Object.values(readData<Record<string, MoveInfo>>('moves.json')).map((move) => ({ name: move.name, move }));
const items = Object.values(readData<ItemReferenceTable>('reference/items.json')).map((item) => ({ name: item.name, item }));
const moveFilters = (query: string): MoveFilters => ({ query, categories: [], gens: [], types: [], sort: 'name' });

const SEARCH: Record<HintList, (query: string) => string[]> = {
  dex: (query) => applyFilters(rows, fuse, { ...DEFAULT_FILTERS, query }).map((m) => m.name),
  moves: (query) => filterMoves(moves, moveFilters(query)).map((m) => m.name),
  items: (query) => filterItems(items, { query, categories: [], gens: [] }).map((i) => i.name),
};

/** For each example: names it must list and names it must leave out. */
const EXPECTED: Record<string, { has: string[]; not: string[] }> = {
  'fire & flying': { has: ['Charizard', 'Moltres'], not: ['Charmander', 'Pidgey'] },
  'grass & !poison': { has: ['Chikorita'], not: ['Bulbasaur', 'Charmander'] },
  '(fire | water) & gen 1': { has: ['Charmander', 'Squirtle'], not: ['Bulbasaur', 'Torchic'] },
  'legendary & !dragon': { has: ['Mewtwo'], not: ['Rayquaza', 'Pikachu'] },
  'fire & special': { has: ['Flamethrower'], not: ['Fire Punch', 'Surf'] },
  'physical & !normal': { has: ['Earthquake'], not: ['Tackle', 'Surf'] },
  '(fire | ice) & punch': { has: ['Fire Punch', 'Ice Punch'], not: ['Thunder Punch', 'Flamethrower'] },
  'thunder punch | surf': { has: ['Thunder Punch', 'Surf'], not: ['Fire Punch'] },
  'mega stone & char': { has: ['Charizardite X', 'Charizardite Y'], not: ['Venusaurite', 'Charcoal'] },
  'balls & !(great | ultra)': { has: ['Poké Ball', 'Master Ball'], not: ['Great Ball', 'Ultra Ball', 'Potion'] },
  'plate | jewel': { has: ['Flame Plate', 'Fire Gem'], not: ['Potion'] },
  'medicine & potion': { has: ['Potion', 'Super Potion'], not: ['Antidote'] },
};

describe('search tips', () => {
  for (const list of Object.keys(SEARCH_HINTS) as HintList[]) {
    for (const { query } of SEARCH_HINTS[list].examples) {
      test(`${list}: "${query}" uses an operator and lists what it says`, () => {
        assert.notEqual(parseQuery(query)?.kind, 'term');
        const expected = EXPECTED[query];
        assert.ok(expected, 'no expectation for this example');
        const names = SEARCH[list](query);
        for (const name of expected.has) assert.ok(names.includes(name), `missing ${name}`);
        for (const name of expected.not) assert.ok(!names.includes(name), `should leave out ${name}`);
      });
    }
  }

  const words = (list: HintList, label: string) => SEARCH_HINTS[list].keywords.find((k) => k.label === label)!.words;

  test('the Dex category words are every Category, and list the same rows as the filter', () => {
    const shown = words('dex', 'Category');
    assert.deepEqual([...shown].sort(), Object.keys(CATEGORY_LABELS).sort());
    for (const word of shown) {
      const byFilter = applyFilters(rows, fuse, { ...DEFAULT_FILTERS, category: word as DexCategory });
      assert.deepEqual(SEARCH.dex(word), byFilter.map((m) => m.name), word);
    }
  });

  test('the Dex number, type and generation words narrow by that keyword', () => {
    assert.deepEqual(SEARCH.dex('25').slice(0, 1), ['Pikachu']);
    assert.deepEqual(SEARCH.dex('#25'), SEARCH.dex('25'));
    const dex = (query: string) => applyFilters(rows, fuse, { ...DEFAULT_FILTERS, query });
    for (const word of words('dex', 'Type')) {
      assert.ok(dex(word).length > 0 && dex(word).every((m) => m.types.includes(word as never)), word);
    }
    assert.ok(dex('gen 3').length > 0 && dex('gen 3').every((m) => m.gen === 3));
  });

  test('the Moves words are keywords, not only names', () => {
    // With an operator a keyword is exact; alone it also lists the names holding the word.
    const exact = (word: string) => filterMoves(moves, moveFilters(`${word} & !zzz`));
    for (const word of words('moves', 'Type')) assert.ok(exact(word).length > 0 && exact(word).every(({ move }) => move.type === word), word);
    for (const word of words('moves', 'Category')) assert.ok(exact(word).length > 0 && exact(word).every(({ move }) => move.category === word), word);
  });

  test('the Items words reach every category, each with its own word', () => {
    const reached = words('items', 'Category').map((word) => ITEM_CATEGORY_WORDS[searchKey(word)]);
    assert.ok(!reached.includes(undefined as never));
    assert.deepEqual([...reached].sort(), [...ITEM_CATEGORIES].sort());
  });
});
