import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Fuse from 'fuse.js';
import { DEFAULT_FILTERS, type DexFilters } from '../src/data/dexState';
import { applyFilters } from '../src/data/filter';
import type { IndexEntry } from '../src/data/types';

const ALL: IndexEntry[] = [
  { id: 1, name: 'Bulbasaur', types: ['grass', 'poison'], gen: 1, total: 318 },
  { id: 6, name: 'Charizard', types: ['fire', 'flying'], gen: 1, total: 534 },
  { id: 25, name: 'Pikachu', types: ['electric'], gen: 1, total: 320 },
  { id: 250, name: 'Ho-Oh', types: ['fire', 'flying'], gen: 2, total: 680 },
  { id: 255, name: 'Torchic', types: ['fire'], gen: 3, total: 310 },
  { id: 315, name: 'Roselia', types: ['grass', 'poison'], gen: 3, total: 400 },
];
// Same options as DexScreen.
const fuse = new Fuse(ALL, { keys: ['name'], threshold: 0.3, ignoreLocation: true });

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

  test('two types are an exact dual-type match, in any order', () => {
    assert.deepEqual(ids({ types: ['flying', 'fire'] }), [6, 250]);
    assert.deepEqual(ids({ types: ['fire', 'grass'] }), []);
  });

  test('search, generation and type filters combine', () => {
    assert.deepEqual(ids({ query: '25', gens: [2, 3], types: ['fire'] }), [250, 255]);
  });

  test('sort by name', () => {
    assert.deepEqual(ids({ sort: 'name' }), [1, 6, 250, 25, 315, 255]);
  });

  test('sort by base total, highest first, ties by number', () => {
    const tied = [...ALL, { id: 7, name: 'Tie', types: ['water'], gen: 1, total: 320 } satisfies IndexEntry];
    const out = applyFilters(tied, null, { ...DEFAULT_FILTERS, sort: 'total' }).map((m) => m.id);
    assert.deepEqual(out, [250, 6, 315, 7, 25, 1, 255]);
  });

  test('sorting does not mutate the input', () => {
    const before = ALL.map((m) => m.id);
    ids({ sort: 'name' });
    assert.deepEqual(ALL.map((m) => m.id), before);
  });
});
