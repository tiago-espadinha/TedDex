import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { describe, test } from 'node:test';
import type { AbilityNameTable, AbilityTable } from '../../src/data/types';

// The committed output of `npm run data`.
describe('ability names data', () => {
  const url = new URL('../../public/data/abilities.json', import.meta.url);
  const names = JSON.parse(readFileSync(url, 'utf8')) as AbilityNameTable;
  const reference = JSON.parse(
    readFileSync(new URL('../../public/data/reference/abilities.json', import.meta.url), 'utf8'),
  ) as AbilityTable;

  test('has every ability of the reference table with its name and generation', () => {
    assert.deepEqual(Object.keys(names), Object.keys(reference));
    for (const [id, a] of Object.entries(names)) {
      assert.equal(a.name, reference[Number(id)].name, `ability ${id}`);
      assert.equal(a.gen, reference[Number(id)].gen, a.name);
    }
  });

  test('stays small enough for the team screens', () => {
    assert.ok(statSync(url).size < 20_000);
  });
});
