import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { missingSprites, spriteUrls, staleSpriteCaches } from '../src/data/spriteCache';

test('sprite list expands to media URLs per folder', () => {
  assert.deepEqual(spriteUrls({ version: 'v1', files: { sprites: ['1', '10034'], guide: ['tm'] } }), [
    '/media/sprites/1.webp',
    '/media/sprites/10034.webp',
    '/media/guide/tm.webp',
  ]);
  assert.deepEqual(spriteUrls({ version: 'v1', files: { 'sprites/shiny': ['6'] } }), ['/media/sprites/shiny/6.webp']);
});

test('every species has a shiny sprite, and only species do', () => {
  const index = JSON.parse(readFileSync('public/data/index.json', 'utf8')) as { id: number }[];
  const shiny = readdirSync('public/media/sprites/shiny').filter((f) => f.endsWith('.webp')).map((f) => Number(f.slice(0, -5)));
  assert.deepEqual(shiny.sort((a, b) => a - b), index.map((s) => s.id).sort((a, b) => a - b));
});

test('only sprites the cache lacks are fetched', () => {
  const list = { version: 'v1', files: { sprites: ['1', '2'], items: ['17'] } };
  assert.deepEqual(missingSprites(list, ['http://localhost/media/sprites/2.webp']), ['/media/sprites/1.webp', '/media/items/17.webp']);
  assert.equal(missingSprites(list, []).length, 3);
});

test('only sprite caches of other versions are stale', () => {
  assert.deepEqual(staleSpriteCaches(['sprites-old', 'sprites-v2', 'media', 'workbox-precache-v2'], 'v2'), ['sprites-old']);
});
