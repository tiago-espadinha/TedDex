import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Fuse from 'fuse.js';
import { DEFAULT_FILTERS, type DexFilters } from '../src/data/dexState';
import { FUSE_OPTIONS, applyFilters } from '../src/data/filter';
import type { IndexEntry } from '../src/data/types';

/** A grid row with made-up stats and size; only the fields a test sorts by matter. */
const mon = (id: number, name: string, types: IndexEntry['types'], gen: number, total: number, atk = 50, weightKg = 10): IndexEntry => ({
  id, name, types, gen, total, stats: { hp: 50, atk, def: 50, spa: 50, spd: 50, spe: 50 }, heightM: 1, weightKg,
});

const ALL: IndexEntry[] = [
  mon(1, 'Bulbasaur', ['grass', 'poison'], 1, 318, 49, 6.9),
  mon(6, 'Charizard', ['fire', 'flying'], 1, 534, 84, 90.5),
  mon(25, 'Pikachu', ['electric'], 1, 320, 55, 6),
  mon(250, 'Ho-Oh', ['fire', 'flying'], 2, 680, 130, 199),
  mon(255, 'Torchic', ['fire'], 3, 310, 60, 2.5),
  mon(315, 'Roselia', ['grass', 'poison'], 3, 400, 60, 2),
];
const fuse = new Fuse(ALL, FUSE_OPTIONS);

const ids = (f: Partial<DexFilters>) => applyFilters(ALL, fuse, { ...DEFAULT_FILTERS, ...f }).map((m) => m.id);

describe('applyFilters', () => {
  test('no filters keeps dex order', () => {
    assert.deepEqual(ids({}), [1, 6, 25, 250, 255, 315]);
  });

  test('number search matches ids that start with it, with or without # and leading zeros', () => {
    assert.deepEqual(ids({ query: '25' }), [25, 250, 255]);
    assert.deepEqual(ids({ query: '#0025' }), [25, 250, 255]);
    assert.deepEqual(ids({ query: '6' }), [6]);
  });

  test('a type word filters by type instead of name', () => {
    assert.deepEqual(ids({ query: 'Fire ' }), [6, 250, 255]);
  });

  test('name search is fuzzy and case-insensitive', () => {
    assert.deepEqual(ids({ query: 'PIKACHU' }), [25]);
    assert.deepEqual(ids({ query: 'charzard' }), [6]);
    assert.deepEqual(ids({ query: 'zzzz' }), []);
  });

  test('name search without a Fuse index leaves the list as is', () => {
    assert.equal(applyFilters(ALL, null, { ...DEFAULT_FILTERS, query: 'pika' }).length, ALL.length);
  });

  test('generations are a union', () => {
    assert.deepEqual(ids({ gens: [2, 3] }), [250, 255, 315]);
  });

  test('one type matches single and dual types', () => {
    assert.deepEqual(ids({ types: ['fire'] }), [6, 250, 255]);
  });

  test('several types match any of them', () => {
    assert.deepEqual(ids({ types: ['flying', 'fire'] }), [6, 250, 255]);
    assert.deepEqual(ids({ types: ['fire', 'grass'] }), [1, 6, 250, 255, 315]);
    assert.deepEqual(ids({ types: ['fire', 'grass', 'electric'] }), [1, 6, 25, 250, 255, 315]);
  });

  test('a type word combines with type filters', () => {
    assert.deepEqual(ids({ query: 'fire', types: ['flying'] }), [6, 250]);
    assert.deepEqual(ids({ query: 'fire', types: ['fire'] }), [6, 250, 255]);
    assert.deepEqual(ids({ query: 'fire', types: ['fire', 'flying'] }), [6, 250, 255]);
    assert.deepEqual(ids({ query: 'fire', types: ['grass'] }), []);
    assert.deepEqual(ids({ query: 'grass', types: ['poison'], gens: [3] }), [315]);
  });

  test('search, generation and type filters combine', () => {
    assert.deepEqual(ids({ query: '25', gens: [2, 3], types: ['fire'] }), [250, 255]);
  });

  test('sort by name', () => {
    assert.deepEqual(ids({ sort: 'name' }), [1, 6, 250, 25, 315, 255]);
  });

  test('sort by base total, highest first, ties by number', () => {
    const tied = [...ALL, mon(7, 'Tie', ['water'], 1, 320)];
    const out = applyFilters(tied, null, { ...DEFAULT_FILTERS, sort: 'total' }).map((m) => m.id);
    assert.deepEqual(out, [250, 6, 315, 7, 25, 1, 255]);
  });

  test('sort by a stat, highest first, ties by number', () => {
    assert.deepEqual(ids({ sort: 'atk' }), [250, 6, 255, 315, 25, 1]);
  });

  test('sort by weight, heaviest first', () => {
    assert.deepEqual(ids({ sort: 'weight' }), [250, 6, 1, 25, 255, 315]);
  });

  test('sorting does not mutate the input', () => {
    const before = ALL.map((m) => m.id);
    ids({ sort: 'name' });
    assert.deepEqual(ALL.map((m) => m.id), before);
  });
});
