import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { abilityInGame, formInGame, itemInGame, learnable, moveChoices, otherAbilities } from '../src/data/memberOptions';
import type { AbilityTable, ItemReferenceTable, Learnsets, MoveTable, SpeciesDetail } from '../src/data/types';
import { dataEntry, readData } from './data-files';

const moves = readData<MoveTable>('moves.json');
const abilities = readData<AbilityTable>('reference/abilities.json');
const pikachu = dataEntry<SpeciesDetail>('species', 25);
const charizard = dataEntry<SpeciesDetail>('species', 6);
const raichu = dataEntry<SpeciesDetail>('species', 26);
const items = readData<ItemReferenceTable>('reference/items.json');
const learnsets = dataEntry<Learnsets>('learnsets', 25);
const SPORE = 147;
const THUNDERBOLT = 85;
const THUNDER_PUNCH = 9;
const RED_BLUE = 1;
const SCARLET_VIOLET = 25;

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

describe('moveChoices in a game', () => {
  test("offers exactly Pikachu's Red / Blue learnset", () => {
    const rb = learnsets[RED_BLUE];
    const expected = new Set([...rb.level.map(([m]) => m), ...rb.machine, ...rb.tutor, ...rb.egg]);
    const offered = moveChoices(learnsets, moves, false, RED_BLUE);
    assert.deepEqual(new Set(offered), expected);
    assert.ok(offered.includes(THUNDERBOLT));
    assert.ok(!offered.includes(THUNDER_PUNCH));
    assert.ok(moveChoices(learnsets, moves).includes(THUNDER_PUNCH));
  });

  test('offers nothing for a game the species is not in', () => {
    assert.deepEqual(moveChoices({ [RED_BLUE]: learnsets[RED_BLUE] }, moves, false, SCARLET_VIOLET), []);
  });

  test('still offers every move in god mode', () => {
    assert.equal(moveChoices(learnsets, moves, true, RED_BLUE).length, Object.keys(moves).length);
  });
});

describe('learnable', () => {
  test('is the union of every game without a game, and one game with one', () => {
    assert.ok(learnable(learnsets).has(THUNDER_PUNCH));
    assert.ok(!learnable(learnsets, RED_BLUE).has(THUNDER_PUNCH));
    assert.equal(learnable(learnsets, 9999).size, 0);
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

describe('availability in a game', () => {
  const gen = (name: string, table: Record<number, { name: string; gen: number }>) => Object.values(table).find((e) => e.name === name)!.gen;
  const form = (mon: SpeciesDetail, key: string) => mon.forms!.find((f) => f.key === key)!;
  const [X_Y, SUN_MOON, SWORD_SHIELD] = [15, 17, 20];

  test('Gen 1 and 2 games have no abilities; hidden ones start in Gen 5; each from its own generation', () => {
    assert.ok(!abilityInGame(1, 1));
    assert.ok(!abilityInGame(2, gen('Static', abilities)));
    assert.ok(abilityInGame(3, gen('Static', abilities)));
    assert.ok(!abilityInGame(4, gen('Lightning Rod', abilities), true));
    assert.ok(abilityInGame(5, gen('Lightning Rod', abilities), true));
    assert.ok(!abilityInGame(5, gen('Tough Claws', abilities)));
    assert.ok(abilityInGame(6, gen('Tough Claws', abilities)));
  });

  test('Gen 1 games have no held items; each item from its generation', () => {
    assert.ok(!itemInGame(1, 1));
    assert.ok(itemInGame(2, gen('Leftovers', items)));
    assert.ok(!itemInGame(4, gen('Eviolite', items)));
    assert.ok(itemInGame(5, gen('Eviolite', items)));
  });

  test('Megas only in Gen 6 and 7 games, Gigantamax only in Sword / Shield, regional forms from their game', () => {
    assert.ok(!formInGame(form(charizard, 'mega-x'), RED_BLUE));
    assert.ok(formInGame(form(charizard, 'mega-x'), X_Y));
    assert.ok(!formInGame(form(charizard, 'mega-x'), SWORD_SHIELD));
    assert.ok(formInGame(form(charizard, 'gmax'), SWORD_SHIELD));
    assert.ok(!formInGame(form(charizard, 'gmax'), SCARLET_VIOLET));
    assert.ok(!formInGame(form(raichu, 'alola'), X_Y));
    assert.ok(formInGame(form(raichu, 'alola'), SUN_MOON));
    assert.ok(formInGame(form(charizard, ''), RED_BLUE));
  });

  test('any game has everything', () => {
    assert.ok(abilityInGame(undefined, 9, true));
    assert.ok(itemInGame(undefined, 9));
    assert.ok(formInGame(form(charizard, 'mega-x')));
  });
});
