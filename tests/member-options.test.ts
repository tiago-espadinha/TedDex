import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NO_MOVE_FILTERS, abilityIdByName, activeMoveChoiceFilters, learnable, memberAbility, moveChoices, otherAbilities, withMove, type MoveChoiceFilters } from '../src/data/memberOptions';
import type { AbilityTable, Learnsets, MoveTable, SpeciesDetail } from '../src/data/types';
import { dataEntry, readData } from './data-files';

const moves = readData<MoveTable>('moves.json');
const abilities = readData<AbilityTable>('reference/abilities.json');
const pikachu = dataEntry<SpeciesDetail>('species', 25);
const calyrex = dataEntry<SpeciesDetail>('species', 898);
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

describe('moveChoices with filters', () => {
  const rb = learnsets[RED_BLUE];
  const filters = (f: Partial<MoveChoiceFilters>): MoveChoiceFilters => ({ ...NO_MOVE_FILTERS, ...f });

  test("Game = Red / Blue offers exactly Pikachu's Red / Blue learnset", () => {
    const expected = new Set([...rb.level.map(([m]) => m), ...rb.machine, ...rb.tutor, ...rb.egg]);
    const offered = moveChoices(learnsets, moves, false, filters({ game: RED_BLUE }));
    assert.deepEqual(new Set(offered), expected);
    assert.ok(offered.includes(THUNDERBOLT));
    assert.ok(!offered.includes(THUNDER_PUNCH));
    assert.ok(moveChoices(learnsets, moves).includes(THUNDER_PUNCH));
  });

  test('Type = Electric narrows the Red / Blue list to its Electric moves', () => {
    const offered = moveChoices(learnsets, moves, false, filters({ game: RED_BLUE, types: ['electric'] }));
    const expected = moveChoices(learnsets, moves, false, filters({ game: RED_BLUE })).filter((id) => moves[id].type === 'electric');
    assert.deepEqual(offered, expected);
    assert.ok(offered.includes(THUNDERBOLT));
    assert.ok(offered.length > 1);
  });

  test('learn method and category narrow too', () => {
    const level = moveChoices(learnsets, moves, false, filters({ game: RED_BLUE, methods: ['level'] }));
    assert.deepEqual(new Set(level), new Set(rb.level.map(([m]) => m)));
    const status = moveChoices(learnsets, moves, false, filters({ categories: ['status'] }));
    assert.ok(status.length > 0 && status.every((id) => moves[id].category === 'status'));
  });

  test('offers nothing for a game the species is not in', () => {
    assert.deepEqual(moveChoices({ [RED_BLUE]: rb }, moves, false, filters({ game: SCARLET_VIOLET })), []);
  });

  test('god mode offers every move until a game or method is picked; types still apply', () => {
    assert.equal(moveChoices(learnsets, moves, true, filters({ types: [] })).length, Object.keys(moves).length);
    assert.deepEqual(moveChoices(learnsets, moves, true, filters({ game: RED_BLUE })), moveChoices(learnsets, moves, false, filters({ game: RED_BLUE })));
    const grass = moveChoices(learnsets, moves, true, filters({ types: ['grass'] }));
    assert.ok(grass.includes(SPORE) && grass.every((id) => moves[id].type === 'grass'));
  });

  test('counts the active filters', () => {
    assert.equal(activeMoveChoiceFilters(NO_MOVE_FILTERS), 0);
    assert.equal(activeMoveChoiceFilters(filters({ game: RED_BLUE, methods: ['egg'], types: ['fire', 'water'] })), 4);
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

describe('memberAbility', () => {
  const hidden = pikachu.abilities.find((a) => a.hidden)!;

  test("finds the form's own ability with its id and hidden flag", () => {
    assert.deepEqual(memberAbility(pikachu.abilities, hidden.name, abilities), { id: hidden.id, hidden: true });
    assert.deepEqual(memberAbility(pikachu.abilities, hidden.name), { id: hidden.id, hidden: true });
  });

  test('finds a god mode ability in the full table, not hidden; no id before the table loads', () => {
    const hugePower = Number(Object.entries(abilities).find(([, a]) => a.name === 'Huge Power')![0]);
    assert.deepEqual(memberAbility(pikachu.abilities, 'Huge Power', abilities), { id: hugePower, hidden: false });
    assert.deepEqual(memberAbility(pikachu.abilities, 'Huge Power'), { id: undefined, hidden: false });
  });

  test("tells same-named abilities apart by the form's own: As One on each Calyrex rider", () => {
    const own = (key: string) => calyrex.forms!.find((f) => f.key === key)!.abilities;
    assert.equal(memberAbility(own('shadow'), 'As One', abilities)?.id, 267);
    assert.equal(memberAbility(own('ice'), 'As One', abilities)?.id, 266);
  });

  test('no ability set', () => {
    assert.equal(memberAbility(pikachu.abilities, undefined, abilities), undefined);
  });
});

describe('abilityIdByName', () => {
  const entry = (name: string) => ({ name, effect: '', details: '', gen: 3, species: [] });
  const table: AbilityTable = { 9: entry('Static'), 266: entry('As One'), 267: entry('As One') };

  test('finds the id, the first one when a name repeats', () => {
    assert.equal(abilityIdByName(table, 'Static'), 9);
    assert.equal(abilityIdByName(table, 'As One'), 266);
  });

  test('is undefined for an unknown name', () => {
    assert.equal(abilityIdByName(table, 'Levitate'), undefined);
  });
});

describe('withMove', () => {
  const UNKNOWN = 999999;
  const [A, B, C, D, E] = [1, 2, 3, 4, 5];

  test('slots count the moves shown, past a stored move the data lost', () => {
    assert.deepEqual(withMove([UNKNOWN, A, B], moves, 1), [A]);
    assert.deepEqual(withMove([UNKNOWN, A, B], moves, 1, C), [A, C]);
    assert.deepEqual(withMove([UNKNOWN, A, B, C], moves, 3, D), [A, B, C, D]);
  });

  test('replaces, adds at the end and removes', () => {
    assert.deepEqual(withMove([A, B], moves, 0, C), [C, B]);
    assert.deepEqual(withMove([A, B], moves, 2, C), [A, B, C]);
    assert.deepEqual(withMove([A, B], moves, 0), [B]);
  });

  test('keeps a move from repeating or a fifth from joining', () => {
    assert.deepEqual(withMove([A, B], moves, 0, B), [A, B]);
    assert.deepEqual(withMove([A, B, C, D], moves, 4, E), [A, B, C, D]);
  });
});
