import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { ITEM_CATEGORIES } from '../src/data/itemCategories';
import type { ItemReferenceTable, ItemTable } from '../src/data/types';

// The committed output of `npm run data`.
describe('items reference data', () => {
  const items = JSON.parse(
    readFileSync(new URL('../public/data/reference/items.json', import.meta.url), 'utf8'),
  ) as ItemReferenceTable;
  const list = Object.values(items);
  const byName = (name: string) => list.find((it) => it.name === name);

  test('covers held and non-held items', () => {
    assert.ok(list.length > 2000);
    assert.equal(byName('Poké Ball')?.category, 'Poké Balls');
    assert.equal(byName('Rare Candy')?.category, 'Medicine');
  });

  test('every item has a known category, a generation and a price', () => {
    for (const it of list) {
      assert.ok(ITEM_CATEGORIES.includes(it.category), `${it.name}: ${it.category}`);
      assert.ok(it.gen >= 1 && it.gen <= 9, `${it.name}: Gen ${it.gen}`);
      assert.ok(Number.isInteger(it.cost) && it.cost >= 0, `${it.name}: ${it.cost}`);
    }
  });

  test('no effect text starts with "Held:"', () => {
    assert.deepEqual(list.filter((it) => /^held:/i.test(it.effect)).map((it) => it.name), []);
  });

  test('names are unique (game-specific copies name their game) and effects have no placeholders', () => {
    const names = list.map((it) => it.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.includes('Poké Ball (Legends: Arceus)'));
    assert.deepEqual(list.filter((it) => /\[VAR/.test(it.effect)).map((it) => it.name), []);
  });

  test('Oran Berry is a berry and Charizardite X came in Gen VI', () => {
    assert.equal(byName('Oran Berry')?.category, 'Berries');
    assert.equal(byName('Charizardite X')?.gen, 6);
    assert.equal(byName('Charizardite X')?.category, 'Mega Stones');
  });

  test('wild holders are per version group: Snorlax holds Leftovers in Ruby/Sapphire at 100%', () => {
    assert.deepEqual(byName('Leftovers')?.wild[0], [5, 143, 100]);
    assert.ok(list.every((it) => it.wild.every(([game, , rarity]) => game > 0 && rarity > 0 && rarity <= 100)));
  });

  test('prices: 0 marks items that are not sold', () => {
    assert.equal(byName('Poké Ball')?.cost, 200);
    assert.equal(byName('Master Ball')?.cost, 0);
  });
});

describe('held items data', () => {
  const held = JSON.parse(readFileSync(new URL('../public/data/items.json', import.meta.url), 'utf8')) as ItemTable;
  const reference = JSON.parse(
    readFileSync(new URL('../public/data/reference/items.json', import.meta.url), 'utf8'),
  ) as ItemReferenceTable;

  test("every held item has its name and generation from the reference table", () => {
    assert.ok(Object.keys(held).length > 300);
    for (const [id, it] of Object.entries(held)) {
      assert.equal(it.name, reference[Number(id)]?.name, `item ${id}`);
      assert.equal(it.gen, reference[Number(id)].gen, it.name);
    }
  });
});
