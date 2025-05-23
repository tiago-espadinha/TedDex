import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { applyForm, memberView } from '../src/data/forms';
import type { FormVariant, IndexEntry, SpeciesDetail } from '../src/data/types';

const stats = (n: number) => ({ hp: n, atk: n, def: n, spa: n, spd: n, spe: n });
const variant = (over: Partial<FormVariant>): FormVariant => ({
  pokemonId: 6,
  key: '',
  label: 'Charizard',
  name: 'Charizard',
  types: ['fire', 'flying'],
  stats: stats(89),
  total: 534,
  abilities: [{ name: 'Blaze', hidden: false }],
  heightM: 1.7,
  weightKg: 90.5,
  ...over,
});
const megaX = variant({
  pokemonId: 10034,
  key: 'mega-x',
  label: 'Mega X',
  name: 'Mega Charizard X',
  types: ['fire', 'dragon'],
  stats: stats(105),
  total: 634,
  abilities: [{ name: 'Tough Claws', hidden: false }],
  weightKg: 110.5,
});
const charizard: SpeciesDetail = {
  id: 6,
  slug: 'charizard',
  name: 'Charizard',
  genus: 'Flame Pokémon',
  types: ['fire', 'flying'],
  gen: 1,
  heightM: 1.7,
  weightKg: 90.5,
  stats: stats(89),
  total: 534,
  abilities: [{ name: 'Blaze', hidden: false }],
  flavor: 'Spits fire.',
  legendary: false,
  mythical: false,
  evolutionChainId: 2,
  forms: [variant({}), megaX],
};

describe('applyForm', () => {
  test('swaps in the battle data and media id of the chosen form', () => {
    const { view, form, mediaId } = applyForm(charizard, 'mega-x');
    assert.equal(form, megaX);
    assert.equal(mediaId, 10034);
    assert.equal(view.name, 'Mega Charizard X');
    assert.deepEqual(view.types, ['fire', 'dragon']);
    assert.equal(view.total, 634);
    assert.deepEqual(view.abilities, [{ name: 'Tough Claws', hidden: false }]);
    assert.equal(view.weightKg, 110.5);
  });

  test('keeps species-level facts: number, genus, flavor, evolution chain', () => {
    const { view } = applyForm(charizard, 'mega-x');
    assert.equal(view.id, 6);
    assert.equal(view.genus, 'Flame Pokémon');
    assert.equal(view.flavor, 'Spits fire.');
    assert.equal(view.evolutionChainId, 2);
  });

  test('falls back to the default form for no key, an unknown key, or a species without forms', () => {
    for (const key of [null, '', 'mega-z']) {
      const { view, form, mediaId } = applyForm(charizard, key);
      assert.equal(view, charizard);
      assert.equal(form, undefined);
      assert.equal(mediaId, 6);
    }
    assert.equal(applyForm({ ...charizard, forms: undefined }, 'mega-x').view.name, 'Charizard');
  });
});

describe('memberView', () => {
  const grid: IndexEntry = { id: 6, name: 'Charizard', types: ['fire', 'flying'], gen: 1, total: 534 };

  test("uses the form's name, types and media id when the member has a form", () => {
    assert.deepEqual(memberView({ speciesId: 6, formKey: 'mega-x' }, grid, charizard), {
      name: 'Mega Charizard X',
      types: ['fire', 'dragon'],
      mediaId: 10034,
    });
  });

  test('uses the grid row for the default form, or while the species file is not loaded', () => {
    const plain = { name: 'Charizard', types: ['fire', 'flying'], mediaId: 6 };
    assert.deepEqual(memberView({ speciesId: 6 }, grid, charizard), plain);
    assert.deepEqual(memberView({ speciesId: 6, formKey: 'mega-x' }, grid), plain);
    assert.deepEqual(memberView({ speciesId: 6, formKey: 'mega-z' }, grid, charizard), plain);
  });

  test('is undefined for a species it knows nothing about', () => {
    assert.equal(memberView({ speciesId: 6 }), undefined);
  });
});
