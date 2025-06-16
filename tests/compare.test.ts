import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { comparePath, comparePickPath, compareSearch, parseCompare } from '../src/data/compare';

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
