import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  chunkPath,
  packLearnsets,
  packLocations,
  toChunks,
  unpackLearnsets,
  unpackLocations,
  type PackedLocations,
} from '../../src/data/chunks';
import type { IndexEntry, ItemReferenceTable, Locations, MoveTable, SpeciesDetail } from '../../src/data/types';
import { dataEntry, readData } from '../helpers/data-files';

describe('chunks', () => {
  test('ids map to 64-id chunk files', () => {
    assert.equal(chunkPath('species', 1), '/data/species/c0.json');
    assert.equal(chunkPath('species', 63), '/data/species/c0.json');
    assert.equal(chunkPath('reference/places', 64), '/data/reference/places/c1.json');
    assert.deepEqual(
      [
        ...toChunks([
          [1, 'a'],
          [64, 'b'],
          [2, 'c'],
        ]),
      ],
      [
        [0, { 1: 'a', 2: 'c' }],
        [1, { 64: 'b' }],
      ],
    );
  });

  test('learnsets round-trip, storing each distinct list once', () => {
    const learnsets = {
      1: { level: [[33, 1]] as [number, number][], machine: [5, 6], tutor: [], egg: [] },
      2: { level: [[33, 1]] as [number, number][], machine: [5, 6, 7], tutor: [], egg: [] },
    };
    const packed = packLearnsets(learnsets);
    assert.equal(packed.lists.length, 4);
    assert.deepEqual(unpackLearnsets(JSON.parse(JSON.stringify(packed))), learnsets);
  });

  test('locations share one string table per chunk and resolve to the same text', () => {
    const a: Locations = { strings: ['', 'Route 1', 'Walk'], games: { 1: [[1, 2, 2, 5, 40, 0, 0, 0]] } };
    const b: Locations = { strings: ['', 'Walk', 'Route 2'], games: { 2: [[2, 1, 3, 4, 10, 1, 0, 0]] } };
    const packed: PackedLocations = JSON.parse(JSON.stringify(packLocations({ 1: a, 2: b })));
    assert.deepEqual(packed.strings, ['', 'Route 1', 'Walk', 'Route 2']);
    const text = (l: Locations) =>
      Object.values(l.games)
        .flat()
        .map(([area, method]) => [l.strings[area], l.strings[method]]);
    assert.deepEqual(text(unpackLocations(packed, 1)!), text(a));
    assert.deepEqual(text(unpackLocations(packed, 2)!), text(b));
    assert.equal(unpackLocations(packed, 3), undefined);
  });
});

describe('chunked data output', () => {
  const index = readData<IndexEntry[]>('index.json');
  const ids = (kind: string, keysOf = (file: Record<string, unknown>) => Object.keys(file)) =>
    new Set(
      readdirSync(new URL(`../../public/data/${kind}/`, import.meta.url)).flatMap((f) =>
        keysOf(readData(`${kind}/${f}`)).map(Number),
      ),
    );

  test('every species has its detail, learnsets and locations entry', () => {
    const species = ids('species');
    const learnsets = ids('learnsets');
    const locations = ids('locations', (file) => Object.keys((file as unknown as PackedLocations).species));
    for (const { id } of index) assert.ok(species.has(id) && learnsets.has(id) && locations.has(id), `species ${id}`);
  });

  test('every evolution chain, move and item a screen links to has its entry', () => {
    const chains = ids('evolution');
    for (const { id } of index) {
      const chain = dataEntry<SpeciesDetail>('species', id).evolutionChainId;
      if (chain) assert.ok(chains.has(chain), `chain ${chain}`);
    }
    const moves = ids('reference/moves');
    for (const id of Object.keys(readData<MoveTable>('moves.json'))) assert.ok(moves.has(Number(id)), `move ${id}`);
    const places = ids('reference/places');
    for (const id of Object.keys(readData<ItemReferenceTable>('reference/items.json')))
      assert.ok(places.has(Number(id)), `item ${id}`);
  });
});
