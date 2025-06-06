import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { comparePath, comparePickPath, compareSearch, parseCompare, typeHits } from '../src/data/compare';
import type { TypeData } from '../src/data/types';
import typesJson from '../public/data/types.json' with { type: 'json' };

const CHART = typesJson as TypeData;

describe('typeHits', () => {
  test('Blastoise hits Charizard 2x, Charizard hits Blastoise ½x with Fire', () => {
    assert.deepEqual(typeHits(['water'], ['fire', 'flying'], CHART), [{ type: 'water', mult: 2 }]);
    assert.deepEqual(typeHits(['fire', 'flying'], ['water'], CHART), [
      { type: 'flying', mult: 1 },
      { type: 'fire', mult: 0.5 },
    ]);
  });

  test('dual-type defender multiplies, immunity is 0', () => {
    // Electric against Gyarados (Water/Flying) is 4x; against Garchomp (Dragon/Ground) it is 0.
    assert.deepEqual(typeHits(['electric'], ['water', 'flying'], CHART), [{ type: 'electric', mult: 4 }]);
    assert.deepEqual(typeHits(['electric'], ['dragon', 'ground'], CHART), [{ type: 'electric', mult: 0 }]);
  });

  test('ties keep the attacker order', () => {
    assert.deepEqual(
      typeHits(['grass', 'poison'], ['normal'], CHART).map((h) => h.type),
      ['grass', 'poison'],
    );
  });
});

describe('compare URL', () => {
  test('round-trips both slots with forms', () => {
    const state = { a: { id: 6, form: 'mega-x' }, b: { id: 9 } };
    assert.equal(compareSearch(state), 'a=6&af=mega-x&b=9');
    assert.deepEqual(parseCompare(new URLSearchParams(compareSearch(state))), state);
  });

  test('bad or missing ids leave the slot empty', () => {
    assert.deepEqual(parseCompare(new URLSearchParams('a=abc&b=0')), {});
    assert.deepEqual(parseCompare(new URLSearchParams('a=-3&b=9&af=x')), { b: { id: 9 } });
    assert.deepEqual(parseCompare(new URLSearchParams('')), {});
  });

  test('paths', () => {
    assert.equal(comparePath({}), '/compare');
    assert.equal(comparePath({ b: { id: 9 } }), '/compare?b=9');
    assert.equal(comparePickPath('b', { a: { id: 6 } }), '/?compare=b&a=6');
    assert.equal(comparePickPath('a', {}), '/?compare=a');
  });
});
