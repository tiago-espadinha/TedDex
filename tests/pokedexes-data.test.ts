import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { gameDexes } from '../src/data/pokedex';
import type { Pokedexes, VersionGroup } from '../src/data/types';
import { readData } from './data-files';

// The committed output of `npm run data`.
describe('regional Pokédex data', () => {
  const data = readData<Pokedexes>('pokedexes.json');
  const versions = readData<VersionGroup[]>('versions.json');
  const dexesOf = (label: string) => gameDexes(data, versions.find((v) => v.label === label)!.id);
  const sizes = (label: string) => dexesOf(label).map((d) => d.species.length);

  test('every game has at least one regional dex', () => {
    for (const v of versions) assert.ok(gameDexes(data, v.id).length > 0, v.label);
  });

  test('Red / Blue lists the 151 of Kanto, Bulbasaur to Mew', () => {
    const [kanto] = dexesOf('Red / Blue');
    assert.equal(sizes('Red / Blue').length, 1);
    assert.equal(kanto.species.length, 151);
    assert.deepEqual([kanto.species[0], kanto.species.at(-1)], [1, 151]);
  });

  test('X / Y keeps its three Kalos dexes apart, in order', () => {
    assert.deepEqual(
      dexesOf('X / Y').map((d) => d.name),
      ['Central Kalos', 'Coastal Kalos', 'Mountain Kalos'],
    );
    assert.deepEqual(sizes('X / Y'), [153, 153, 151]);
  });

  test('Sword / Shield and Scarlet / Violet include their expansion dexes', () => {
    assert.deepEqual(
      dexesOf('Sword / Shield').map((d) => d.name),
      ['Galar', 'Isle of Armor', 'Crown Tundra'],
    );
    assert.deepEqual(
      dexesOf('Scarlet / Violet').map((d) => d.name),
      ['Paldea', 'Kitakami', 'Blueberry'],
    );
  });

  test('Unova numbers from 0 (Victini)', () => {
    const [unova] = dexesOf('Black / White');
    assert.equal(unova.first, 0);
    assert.equal(unova.species[0], 494);
  });

  test('species ids are national dex ids, each once per dex', () => {
    for (const d of data.dexes) {
      assert.equal(new Set(d.species).size, d.species.length, d.name);
      assert.ok(
        d.species.every((id) => id >= 1 && id <= 1025),
        d.name,
      );
    }
  });
});
