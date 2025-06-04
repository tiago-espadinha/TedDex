import assert from 'node:assert/strict';
import { test } from 'node:test';
import { teamType } from '../src/data/teamType';

test('the trainer type wins', () => {
  assert.equal(teamType('ice', [['water', 'psychic'], ['water']]), 'ice');
});

test('without one, the type most members share', () => {
  assert.equal(teamType(undefined, [['normal', 'flying'], ['psychic'], ['water', 'flying'], ['fire', 'flying']]), 'flying');
});

test('a tie goes to the type met first', () => {
  assert.equal(teamType(undefined, [['dragon', 'flying'], ['water'], ['dragon'], ['water']]), 'dragon');
});

test('an empty team has no type', () => {
  assert.equal(teamType(undefined, []), undefined);
});
