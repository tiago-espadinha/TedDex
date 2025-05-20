import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { searchByName, searchKey } from '../src/data/reference';

const MOVES = [{ name: 'Thunder' }, { name: 'U-turn' }, { name: 'Thunderbolt' }, { name: 'Bolt Strike' }, { name: 'Absorb' }];
const names = (list: { name: string }[]) => list.map((m) => m.name);

describe('searchByName', () => {
  test('an empty query lists everything A–Z', () => {
    assert.deepEqual(names(searchByName(MOVES, '  ')), ['Absorb', 'Bolt Strike', 'Thunder', 'Thunderbolt', 'U-turn']);
  });

  test('names starting with the query come before names that only contain it', () => {
    assert.deepEqual(names(searchByName(MOVES, 'bolt')), ['Bolt Strike', 'Thunderbolt']);
  });

  test('ignores case, punctuation, spaces and accents', () => {
    assert.deepEqual(names(searchByName(MOVES, 'UTURN')), ['U-turn']);
    assert.deepEqual(names(searchByName(MOVES, 'bolt str')), ['Bolt Strike']);
    assert.equal(searchKey('Poké Ball'), 'pokeball');
  });

  test('no match gives an empty list', () => {
    assert.deepEqual(searchByName(MOVES, 'zzz'), []);
  });
});
