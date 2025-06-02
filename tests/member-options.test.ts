import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { moveChoices, otherAbilities } from '../src/data/memberOptions';
import type { AbilityTable, Learnsets, MoveTable, SpeciesDetail } from '../src/data/types';

const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8')) as T;
const moves = read<MoveTable>('moves.json');
const abilities = read<AbilityTable>('reference/abilities.json');
const pikachu = read<SpeciesDetail>('species/25.json');
const learnsets = read<Learnsets>('learnsets/25.json');
const SPORE = 147;
const THUNDERBOLT = 85;

describe('moveChoices', () => {
  test('offers only the moves Pikachu learns', () => {
    const legal = moveChoices(learnsets, moves);
    assert.ok(legal.includes(THUNDERBOLT));
    assert.ok(!legal.includes(SPORE));
  });

  test('offers every move in god mode, Spore included, sorted by name', () => {
    const all = moveChoices(learnsets, moves, true);
    assert.equal(all.length, Object.keys(moves).length);
    assert.ok(all.includes(SPORE));
    const names = all.map((id) => moves[id].name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('otherAbilities', () => {
  test("adds Huge Power for Pikachu and leaves out Pikachu's own abilities", () => {
    const names = otherAbilities(pikachu.abilities, abilities).map((a) => a.name);
    assert.ok(names.includes('Huge Power'));
    assert.ok(!names.includes('Static'));
    assert.equal(names.length, Object.keys(abilities).length - pikachu.abilities.length);
  });
});
