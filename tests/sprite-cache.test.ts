import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { monImageChain } from '../src/data/api';
import { missingSprites, spriteUrls, staleSpriteCaches } from '../src/data/spriteCache';

test('sprite list expands to media URLs per folder', () => {
  assert.deepEqual(spriteUrls({ version: 'v1', files: { sprites: ['1', '10034'], guide: ['tm'] } }), [
    '/media/sprites/1.webp',
    '/media/sprites/10034.webp',
    '/media/guide/tm.webp',
  ]);
  assert.deepEqual(spriteUrls({ version: 'v1', files: { 'sprites/shiny': ['6'] } }), ['/media/sprites/shiny/6.webp']);
});

const mediaIds = (dir: string) =>
  readdirSync(`public/media/${dir}`)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => Number(f.slice(0, -5)));
const byNumber = (ids: number[]) => [...ids].sort((a, b) => a - b);

/** Forms PokeAPI has no shiny file for (Mega Zygarde has no plain sprite either); they fall back to their species. */
const NO_SHINY = {
  'sprites/shiny': [10301],
  'artwork/shiny': [10158, 10159, 10277, 10309, 10318, 10322, 10323],
};

for (const [dir, missing] of Object.entries(NO_SHINY)) {
  test(`${dir} has every species and form but the listed gaps`, () => {
    const index = JSON.parse(readFileSync('public/data/index.json', 'utf8')) as { id: number }[];
    const forms = readdirSync('public/data/species').flatMap((file) =>
      Object.values(
        JSON.parse(readFileSync(`public/data/species/${file}`, 'utf8')) as Record<
          string,
          { forms?: { pokemonId: number }[] }
        >,
      ).flatMap((mon) => (mon.forms ?? []).slice(1).map((form) => form.pokemonId)),
    );
    const expected = [...index.map((s) => s.id), ...forms].filter((id) => !missing.includes(id));
    assert.deepEqual(byNumber(mediaIds(dir)), byNumber(expected));
  });
}

test('only sprites the cache lacks are fetched', () => {
  const list = { version: 'v1', files: { sprites: ['1', '2'], items: ['17'] } };
  assert.deepEqual(missingSprites(list, ['http://localhost/media/sprites/2.webp']), [
    '/media/sprites/1.webp',
    '/media/items/17.webp',
  ]);
  assert.equal(missingSprites(list, []).length, 3);
});

test('only sprite caches of other versions are stale', () => {
  assert.deepEqual(staleSpriteCaches(['sprites-old', 'sprites-v2', 'media', 'workbox-precache-v2'], 'v2'), [
    'sprites-old',
  ]);
});

test('a shiny image tries artwork, then sprite, for the form, then the species, then plain', () => {
  assert.deepEqual(monImageChain({ id: 10034, speciesId: 6, art: true, shiny: true }), [
    '/media/artwork/shiny/10034.webp',
    '/media/sprites/shiny/10034.webp',
    '/media/artwork/shiny/6.webp',
    '/media/sprites/shiny/6.webp',
    '/media/artwork/10034.webp',
    '/media/sprites/10034.webp',
    '/media/sprites/6.webp',
  ]);
  assert.deepEqual(monImageChain({ id: 6, speciesId: 6, art: false, shiny: true }), [
    '/media/sprites/shiny/6.webp',
    '/media/sprites/6.webp',
  ]);
});

test('a plain image never tries a shiny file', () => {
  assert.deepEqual(monImageChain({ id: 6, speciesId: 6, art: true }), [
    '/media/artwork/6.webp',
    '/media/sprites/6.webp',
  ]);
  assert.deepEqual(monImageChain({ id: 10034, speciesId: 6, art: false }), [
    '/media/sprites/10034.webp',
    '/media/sprites/6.webp',
  ]);
});
