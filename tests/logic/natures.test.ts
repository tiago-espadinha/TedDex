import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NATURES, dislikedFlavor, likedFlavor } from '../../src/data/natures';

const nature = (name: string) => NATURES.find((n) => n.name === name)!;

test('a nature likes the flavour of the stat it raises and dislikes the one it lowers', () => {
  assert.deepEqual([likedFlavor(nature('Adamant')), dislikedFlavor(nature('Adamant'))], ['Spicy', 'Dry']);
  assert.deepEqual([likedFlavor(nature('Timid')), dislikedFlavor(nature('Timid'))], ['Sweet', 'Spicy']);
  assert.deepEqual([likedFlavor(nature('Calm')), dislikedFlavor(nature('Calm'))], ['Bitter', 'Spicy']);
  assert.deepEqual([likedFlavor(nature('Bold')), dislikedFlavor(nature('Bold'))], ['Sour', 'Spicy']);
});

test('neutral natures have no preference', () => {
  assert.equal(likedFlavor(nature('Hardy')), undefined);
  assert.equal(dislikedFlavor(nature('Serious')), undefined);
});
