import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import type { IndexEntry, SpeciesDetail } from '../src/data/types';
import { dataEntry } from './data-files';

// The committed output of `npm run data`.
const index = JSON.parse(readFileSync('public/data/index.json', 'utf8')) as IndexEntry[];
const species = (id: number) => dataEntry<SpeciesDetail>('species', id);
const formsOf = (id: number) => index.find((m) => m.id === id)?.forms ?? [];

describe('index.json forms', () => {
  test("each species' index forms are its species file's forms after the default, with the same battle data", () => {
    for (const m of index.filter((x) => x.forms)) {
      const detail = species(m.id).forms!.slice(1);
      assert.deepEqual(
        m.forms!.map(({ key, label, pokemonId, name, types, total }) => ({
          key,
          label,
          pokemonId,
          name,
          types,
          total,
        })),
        detail.map(({ key, label, pokemonId, name, types, total }) => ({ key, label, pokemonId, name, types, total })),
        m.name,
      );
    }
  });

  test('Mega Charizard X is a Fire/Dragon mega with its own media id', () => {
    const megaX = formsOf(6).find((f) => f.key === 'mega-x');
    assert.deepEqual(megaX && [megaX.kind, megaX.types, megaX.pokemonId], ['mega', ['fire', 'dragon'], 10034]);
  });

  test("Galarian Darmanitan's forms read Galarian first and keep their saved keys", () => {
    const names = (forms: { key: string; label: string; name: string }[]) =>
      forms.filter((f) => f.key.startsWith('galar')).map((f) => [f.key, f.label, f.name]);
    const expected = [
      ['galar-standard', 'Galarian', 'Galarian Darmanitan'],
      ['galar-zen', 'Galarian Zen', 'Galarian Zen Darmanitan'],
    ];
    assert.deepEqual(names(formsOf(555)), expected);
    assert.deepEqual(names(species(555).forms!), expected);
  });

  test('forms fall into the right switch', () => {
    const kind = (id: number, key: string) => formsOf(id).find((f) => f.key === key)?.kind;
    assert.equal(kind(383, 'primal'), 'mega');
    assert.equal(kind(978, 'curly-mega'), 'mega');
    assert.equal(kind(849, 'amped-gmax'), 'gmax');
    assert.equal(kind(555, 'galar-zen'), 'regional');
    assert.equal(kind(128, 'paldea-aqua-breed'), 'regional');
    assert.equal(kind(479, 'heat'), 'other');
  });

  test('species with a Mega or Primal form are in the Megas category', () => {
    for (const id of [6, 383, 678, 978]) assert.ok(index.find((m) => m.id === id)?.tags?.includes('mega'), String(id));
  });
});
