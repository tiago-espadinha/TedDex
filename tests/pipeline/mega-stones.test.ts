import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { megaStoneFor } from '../../scripts/megaStones';
import { formKind } from '../../src/data/forms';
import type { IndexEntry, SpeciesDetail } from '../../src/data/types';
import { dataEntry, readData } from '../helpers/data-files';

const STONES = [
  { id: 1, name: 'Charizardite X' },
  { id: 2, name: 'Charizardite Y' },
  { id: 3, name: 'Garchompite' },
  { id: 4, name: 'Garchompite Z' },
  { id: 5, name: 'Tatsugirinite' },
  { id: 6, name: 'Latiasite' },
  { id: 7, name: 'Latiosite' },
];

describe('megaStoneFor', () => {
  test('matches the X / Y / Z suffix', () => {
    assert.equal(megaStoneFor('Charizard', 'mega-x', STONES), 1);
    assert.equal(megaStoneFor('Charizard', 'mega-y', STONES), 2);
    assert.equal(megaStoneFor('Garchomp', 'mega', STONES), 3);
    assert.equal(megaStoneFor('Garchomp', 'mega-z', STONES), 4);
  });
  test('shares one stone between forms and tells close names apart', () => {
    assert.equal(megaStoneFor('Tatsugiri', 'curly-mega', STONES), 5);
    assert.equal(megaStoneFor('Tatsugiri', 'stretchy-mega', STONES), 5);
    assert.equal(megaStoneFor('Latios', 'mega', STONES), 7);
  });
  test('throws when no stone fits', () => {
    assert.throws(() => megaStoneFor('Venusaur', 'mega', STONES), /No Mega Stone/);
    assert.throws(() => megaStoneFor('Charizard', 'mega', STONES), /No Mega Stone/);
  });
});

describe('mega triggers in the data', () => {
  const trigger = (id: number, key: string) =>
    dataEntry<SpeciesDetail>('species', id).forms?.find((f) => f.key === key)?.trigger;

  test('every Mega and Primal has a trigger, and no other form does', () => {
    for (const row of readData<IndexEntry[]>('index.json')) {
      for (const f of dataEntry<SpeciesDetail>('species', row.id).forms ?? []) {
        assert.equal(!!f.trigger, !!f.key && formKind(f.key) === 'mega', `${f.name}`);
      }
    }
  });
  test('stones, orbs and Dragon Ascent', () => {
    assert.equal(trigger(6, 'mega-x')?.name, 'Charizardite X');
    assert.equal(trigger(6, 'mega-y')?.name, 'Charizardite Y');
    assert.deepEqual(trigger(383, 'primal'), { kind: 'item', id: 467, name: 'Red Orb' });
    assert.deepEqual(trigger(382, 'primal'), { kind: 'item', id: 468, name: 'Blue Orb' });
    assert.equal(trigger(384, 'mega')?.kind, 'move');
    assert.equal(trigger(384, 'mega')?.name, 'Dragon Ascent');
  });
});
