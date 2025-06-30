import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parsePeek, peekPage, peekValue } from '../../src/data/peek';

describe('peek param', () => {
  test('round-trips each kind', () => {
    for (const kind of ['move', 'ability', 'item'] as const) {
      assert.deepEqual(parsePeek(peekValue({ kind, id: 9 })), { kind, id: 9 });
    }
  });

  test('rejects anything else', () => {
    for (const bad of [null, '', 'move', 'move-', 'move-0', 'move-07', 'move-1.5', 'type-3', 'Move-1', 'move-1x']) {
      assert.equal(parsePeek(bad), undefined, String(bad));
    }
  });

  test('opens the matching Guide page', () => {
    assert.equal(peekPage({ kind: 'move', id: 85 }), '/reference/moves/85');
    assert.equal(peekPage({ kind: 'ability', id: 9 }), '/reference/abilities/9');
    assert.equal(peekPage({ kind: 'item', id: 247 }), '/reference/items/247');
  });
});
