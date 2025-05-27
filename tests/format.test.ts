import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evYieldText, genderText } from '../src/data/format';

test('EV yield lists the stats in stat order', () => {
  assert.equal(evYieldText({ spa: 1 }), '1 Sp. Atk');
  assert.equal(evYieldText({ spe: 1, atk: 2 }), '2 Atk, 1 Speed');
  assert.equal(evYieldText({}), 'None');
});

test('gender ratio from eighths', () => {
  assert.equal(genderText(1), '87.5% ♂ · 12.5% ♀');
  assert.equal(genderText(4), '50% ♂ · 50% ♀');
  assert.equal(genderText(0), '100% ♂');
  assert.equal(genderText(8), '100% ♀');
  assert.equal(genderText(-1), 'Genderless');
});
