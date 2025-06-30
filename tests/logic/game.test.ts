import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { knownGame, parseGamePref, shownGame } from '../../src/data/game';

describe('parseGamePref', () => {
  test('reads a version group id', () => {
    assert.equal(parseGamePref('6'), 6);
  });

  test('anything else is latest', () => {
    for (const v of [null, '', 'latest', '0', '-3', '2.5', 'emerald']) assert.equal(parseGamePref(v), 'latest');
  });
});

describe('knownGame', () => {
  const versions = [{ id: 1 }, { id: 6 }];

  test('keeps a game the data has, and latest', () => {
    assert.equal(knownGame(6, versions), 6);
    assert.equal(knownGame('latest', versions), 'latest');
  });

  test('a saved game the data lost is latest', () => {
    assert.equal(knownGame(99, versions), 'latest');
  });
});

describe('shownGame', () => {
  test('latest is the newest the species has', () => {
    assert.equal(shownGame([3, 20], 'latest'), 20);
    assert.equal(shownGame([], 'latest'), undefined);
  });

  test('the chosen game, or nothing when the species is not in it', () => {
    assert.equal(shownGame([3, 20], 3), 3);
    assert.equal(shownGame([3, 20], 1), undefined);
  });
});
