import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EGG_GROUP_COLOR, eggGroupSlug } from '../../src/data/eggGroups';
import type { EggGroupTable, IndexEntry, SpeciesDetail } from '../../src/data/types';
import { dataEntry, readData } from '../helpers/data-files';

// The committed output of `npm run data`.
const groups = readData<EggGroupTable>('egg-groups.json');
const index = readData<IndexEntry[]>('index.json');
const species = index.map((m) => dataEntry<SpeciesDetail>('species', m.id));

describe('egg-groups.json', () => {
  test('each group lists exactly the species whose files name it, in national order', () => {
    const names = new Set(species.flatMap((s) => s.eggGroups));
    assert.deepEqual(
      Object.values(groups)
        .map((g) => g.name)
        .sort(),
      [...names].sort(),
    );
    for (const [slug, { name, species: ids }] of Object.entries(groups)) {
      assert.equal(slug, eggGroupSlug(name));
      assert.deepEqual(
        ids,
        species.filter((s) => s.eggGroups.includes(name)).map((s) => s.id),
        name,
      );
    }
  });

  test('Charmander is in both Monster and Dragon; Ditto is alone in its group', () => {
    assert.ok(groups.monster.species.includes(4));
    assert.ok(groups.dragon.species.includes(4));
    assert.ok(groups.dragon.species.includes(6));
    assert.deepEqual(groups.ditto.species, [132]);
  });

  test('slugs are URL-safe and every group has a chip colour', () => {
    assert.equal(eggGroupSlug('Water 1'), 'water-1');
    assert.equal(eggGroupSlug('Human-Like'), 'human-like');
    for (const [slug, { name }] of Object.entries(groups)) {
      assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(EGG_GROUP_COLOR[name], name);
    }
  });
});
