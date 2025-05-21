import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { encountersIn } from '../src/data/locations';
import type { Locations } from '../src/data/types';

const DATA: Locations = {
  strings: ['', 'Route 29', 'Grass or cave', 'In the morning, During the day', 'Route 1 (East)', 'Alolan Form'],
  games: {
    15: [[1, 2, 2, 4, 30, 1, 3, 0]],
    27: [[4, 2, 3, 3, 30, 0, 0, 5]],
    31: [[1, 2, 3, 5, 0, 0, 0, 0]],
  },
};

describe('encountersIn', () => {
  test('looks up the strings and formats levels and chance', () => {
    assert.deepEqual(encountersIn(DATA, 15), [
      { area: 'Route 29', method: 'Grass or cave', levels: 'Lv. 2–4', chance: 'Up to 30%', note: 'In the morning, During the day', form: '' },
    ]);
  });

  test('shows a single level and the form name', () => {
    assert.deepEqual(encountersIn(DATA, 27), [
      { area: 'Route 1 (East)', method: 'Grass or cave', levels: 'Lv. 3', chance: '30%', note: '', form: 'Alolan Form' },
    ]);
  });

  test('leaves the chance empty when it is unknown', () => {
    assert.equal(encountersIn(DATA, 31)[0].chance, '');
  });

  test('a game the species is not in has no encounters', () => {
    assert.deepEqual(encountersIn(DATA, 1), []);
  });
});
