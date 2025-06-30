import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadIndex, loadedIndex } from '../../src/data/api';

test('the index is readable synchronously only once it has loaded, and not after a failure', async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response('', { status: 500 })) as typeof fetch;
    await assert.rejects(loadIndex());
    assert.equal(loadedIndex(), undefined);

    const rows = [{ id: 1 }];
    globalThis.fetch = (async () => new Response(JSON.stringify(rows))) as typeof fetch;
    const pending = loadIndex();
    assert.equal(loadedIndex(), undefined);
    await pending;
    assert.deepEqual(loadedIndex(), rows);
  } finally {
    globalThis.fetch = realFetch;
  }
});
