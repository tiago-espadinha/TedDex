import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catchChance, evYieldParts, formatPrice, genderText } from '../src/data/format';

test('EV yield lists the stats in stat order', () => {
  assert.deepEqual(evYieldParts({ spa: 1 }), [{ stat: 'spa', text: '1 Sp. Atk' }]);
  assert.deepEqual(evYieldParts({ spe: 1, atk: 2 }), [
    { stat: 'atk', text: '2 Atk' },
    { stat: 'spe', text: '1 Speed' },
  ]);
  assert.deepEqual(evYieldParts({}), []);
});

test('catch chance is rate / 3 / 255 with one decimal', () => {
  assert.equal(catchChance(45), '5.9%');
  assert.equal(catchChance(255), '33.3%');
  assert.equal(catchChance(3), '0.4%');
});

test('gender ratio from eighths', () => {
  assert.equal(genderText(1), '87.5% ♂ · 12.5% ♀');
  assert.equal(genderText(4), '50% ♂ · 50% ♀');
  assert.equal(genderText(0), '100% ♂');
  assert.equal(genderText(8), '100% ♀');
  assert.equal(genderText(-1), 'Genderless');
});

test('prices in Pokédollars, a dash when not sold', () => {
  assert.equal(formatPrice(200), '₽200');
  assert.equal(formatPrice(4000), '₽4,000');
  assert.equal(formatPrice(0), '—');
});
