import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Category, IndexEntry } from '../src/data/types';

const index = JSON.parse(readFileSync(new URL('../public/data/index.json', import.meta.url), 'utf8')) as IndexEntry[];
const names = (c: Category) => index.filter((m) => m.tags?.includes(c)).map((m) => m.name);

test('hand-picked categories have every member', () => {
  assert.equal(names('starter').length, 27);
  assert.equal(names('fossil').length, 25);
  assert.equal(names('paradox').length, 20);
  assert.deepEqual(names('eeveelution'), ['Eevee', 'Vaporeon', 'Jolteon', 'Flareon', 'Espeon', 'Umbreon', 'Leafeon', 'Glaceon', 'Sylveon']);
});

test('flag, form and evolution categories pick the right species', () => {
  for (const [category, name] of [
    ['legendary', 'Mewtwo'], ['mythical', 'Mew'], ['baby', 'Pichu'], ['mega', 'Charizard'], ['regional', 'Vulpix'], ['stone', 'Vaporeon'],
  ] as const) {
    assert.ok(names(category).includes(name), `${name} is ${category}`);
  }
  assert.ok(!names('legendary').includes('Mew'));
  assert.ok(!names('stone').includes('Eevee'));
});
