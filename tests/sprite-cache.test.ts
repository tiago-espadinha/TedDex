import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingSprites, spriteUrls, staleSpriteCaches } from '../src/data/spriteCache';

test('sprite list expands to media URLs per folder', () => {
  assert.deepEqual(spriteUrls({ version: 'v1', files: { sprites: ['1', '10034'], guide: ['tm'] } }), [
    '/media/sprites/1.webp',
    '/media/sprites/10034.webp',
    '/media/guide/tm.webp',
  ]);
});

test('only sprites the cache lacks are fetched', () => {
  const list = { version: 'v1', files: { sprites: ['1', '2'], items: ['17'] } };
  assert.deepEqual(missingSprites(list, ['http://localhost/media/sprites/2.webp']), ['/media/sprites/1.webp', '/media/items/17.webp']);
  assert.equal(missingSprites(list, []).length, 3);
});

test('only sprite caches of other versions are stale', () => {
  assert.deepEqual(staleSpriteCaches(['sprites-old', 'sprites-v2', 'media', 'workbox-precache-v2'], 'v2'), ['sprites-old']);
});
