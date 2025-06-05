import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseGamePref, resolveGame } from '../src/data/game';

describe('parseGamePref', () => {
  test('reads a version group id', () => {
    assert.equal(parseGamePref('6'), 6);
  });

  test('anything else is latest', () => {
    for (const v of [null, '', 'latest', '0', '-3', '2.5', 'emerald']) assert.equal(parseGamePref(v), 'latest');
  });
});

describe('resolveGame', () => {
  const pikachu = [1, 2, 3, 6, 20];

  test('latest picks the newest game without a note', () => {
    assert.deepEqual(resolveGame(pikachu, 'latest'), { group: 20 });
  });

  test('a game the species is in is shown as chosen', () => {
    assert.deepEqual(resolveGame(pikachu, 6), { group: 6 });
  });

  test('a game the species is not in falls back to its latest', () => {
    assert.deepEqual(resolveGame(pikachu, 25), { group: 20, missed: 25 });
    assert.deepEqual(resolveGame([20, 25], 1), { group: 25, missed: 1 });
  });

  test('no games, nothing to show', () => {
    assert.equal(resolveGame([], 6), undefined);
  });
});
