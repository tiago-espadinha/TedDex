import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Fuse from 'fuse.js';
import { DEFAULT_FILTERS, type DexFilters } from '../src/data/dexState';
import { FUSE_OPTIONS, applyFilters, dexRows, favouriteKey } from '../src/data/filter';
import { ITEM_CATEGORY_WORDS, filterItems } from '../src/data/itemFilter';
import { filterMoves, type MoveFilters } from '../src/data/moveFilter';
import { searchByName, searchKey } from '../src/data/reference';
import type { FormKind, IndexEntry, ItemReferenceTable, MoveInfo } from '../src/data/types';
import { readData } from './data-files';

// Search operators and keywords on the committed output of `npm run data`.
describe('Dex search on the real index', () => {
  const index = readData<IndexEntry[]>('index.json');
  const search = (query: string, kinds: FormKind[] = [], f: Partial<DexFilters> = {}, favourites?: Set<string>) => {
    const rows = dexRows(index, kinds);
    return applyFilters(rows, new Fuse(rows, FUSE_OPTIONS), { ...DEFAULT_FILTERS, ...f, query }, favourites);
  };
  const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

  test('no filter lists every species', () => {
    assert.equal(search('').length, 1025);
  });

  test('a query with no operator or keyword matches the name search as before', () => {
    const rows = dexRows(index, []);
    const hits = new Set(new Fuse(rows, FUSE_OPTIONS).search('char').map((r) => r.item));
    const before = rows.filter((m) => hits.has(m)).map((m) => m.id);
    assert.ok(before.includes(6));
    assert.deepEqual(ids(search('char')), before);
    assert.deepEqual(ids(search('CHAR ')), before);
    assert.deepEqual(ids(search('#25')).slice(0, 2), [25, 250]);
    assert.ok(search('fire').every((m) => m.types.includes('fire')));
  });

  test('grass & poison lists only the Grass/Poison dual types, in either order', () => {
    const hits = search('grass & poison');
    assert.ok(hits.every((m) => m.types.includes('grass') && m.types.includes('poison')));
    for (const id of [1, 2, 3, 43]) assert.ok(ids(hits).includes(id), String(id));
    assert.ok(hits.length < 30);
    assert.deepEqual(ids(search('poison & grass')), ids(hits));
  });

  test('fire | water is the union of both types', () => {
    const fire = search('fire');
    const water = search('water');
    const union = new Set([...ids(fire), ...ids(water)]);
    assert.deepEqual(new Set(ids(search('fire | water'))), union);
    assert.ok(union.size > fire.length && union.size > water.length);
  });

  test('!megas drops the Mega rows only; megas lists them with their species, as the Mega category does', () => {
    const all = search('', ['mega']);
    const megaRows = all.filter((m) => m.form?.kind === 'mega');
    assert.ok(megaRows.length > 0);
    const without = search('!megas', ['mega']);
    assert.ok(!without.some((m) => m.form?.kind === 'mega'));
    assert.equal(without.length, all.length - megaRows.length);
    assert.ok(ids(without).includes(6));
    for (const q of ['mega', 'megas']) assert.equal(search(q, ['mega']).length, all.filter((m) => m.tags?.includes('mega')).length, q);
    assert.deepEqual(ids(search('!megas')), ids(search('')));
  });

  test('!regional drops the regional rows only, also inside a group', () => {
    const all = search('', ['regional']);
    const without = search('!regional', ['regional']);
    assert.ok(!without.some((m) => m.form?.kind === 'regional'));
    assert.ok(ids(without).includes(37));
    assert.ok(without.length < all.length);
    assert.ok(ids(search('!(regional | fire)', ['regional'])).includes(19));
    assert.ok(!search('!(regional | fire)', ['regional']).some((m) => m.form?.kind === 'regional' || m.types.includes('fire')));
  });

  test('every Category keyword lists its category, singular and plural', () => {
    for (const [word, tag] of [['starter', 'starter'], ['starters', 'starter'], ['fossils', 'fossil'], ['legendaries', 'legendary'], ['legendary', 'legendary'],
      ['mythical', 'mythical'], ['paradox', 'paradox'], ['babies', 'baby'], ['baby', 'baby'], ['regional', 'regional'], ['eeveelutions', 'eeveelution'], ['stone', 'stone']] as const) {
      const hits = search(word);
      assert.ok(hits.length > 0, word);
      assert.deepEqual(ids(hits), index.filter((m) => m.tags?.includes(tag)).map((m) => m.id), word);
    }
  });

  test('favourites come from the saved set', () => {
    const favourites = new Set([favouriteKey(25), favouriteKey(6)]);
    assert.deepEqual(ids(search('favourites', [], {}, favourites)), [6, 25]);
    assert.deepEqual(ids(search('favourite & electric', [], {}, favourites)), [25]);
  });

  test('a generation, a name and a keyword combine', () => {
    assert.ok(search('gen 3').every((m) => m.gen === 3));
    assert.equal(search('gen 3').length, index.filter((m) => m.gen === 3).length);
    assert.deepEqual(ids(search('char & fire')).slice(0, 3), [4, 5, 6]);
    assert.ok(ids(search('pikachu | 1')).includes(25));
  });

  test('the sheet and the query combine with AND', () => {
    assert.ok(search('fire | water', [], { gens: [1] }).every((m) => m.gen === 1 && (m.types.includes('fire') || m.types.includes('water'))));
    assert.deepEqual(ids(search('grass', [], { types: ['poison'] })), ids(search('grass & poison')));
  });

  test('typing an operator never throws or blanks the list', () => {
    const everyone = search('').length;
    for (const q of ['&', '|', '!', '(', ')', '& |', '!!', '()']) assert.equal(search(q).length, everyone, q);
    const char = ids(search('char'));
    for (const q of ['char &', 'char |', '& char', '| char', 'char & !', 'char!', 'char)', '(char', 'char & ()']) assert.deepEqual(ids(search(q)), char, q);
    assert.ok(search('!char').length > 0);
    assert.ok(search('gra&').length > 0);
  });
});

test('no name holds an operator but the one "&" that still matches', () => {
  const names = [
    ...readData<IndexEntry[]>('index.json').flatMap((m) => [m.name, ...(m.forms ?? []).map((form) => form.name)]),
    ...Object.values(readData<Record<string, MoveInfo>>('moves.json')).map((m) => m.name),
    ...Object.values(readData<ItemReferenceTable>('reference/items.json')).map((i) => i.name),
  ];
  assert.deepEqual(names.filter((name) => /[&|!]/.test(name)), ['B&W Grass Tablecloth']);
});

describe('Moves search on the real data', () => {
  const table = readData<Record<string, MoveInfo>>('moves.json');
  const moves = Object.values(table).map((move) => ({ name: move.name, move }));
  const DEFAULT: MoveFilters = { query: '', categories: [], gens: [], types: [], sort: 'name' };
  const search = (query: string, f: Partial<MoveFilters> = {}) => filterMoves(moves, { ...DEFAULT, ...f, query });

  test('fire & special lists the special Fire moves, A to Z', () => {
    const hits = search('fire & special');
    assert.ok(hits.length > 0 && hits.every(({ move }) => move.type === 'fire' && move.category === 'special'));
    assert.ok(hits.some((m) => m.name === 'Flamethrower'));
    assert.deepEqual(hits.map((m) => m.name), [...hits.map((m) => m.name)].sort((a, b) => a.localeCompare(b)));
  });

  test('a plain name ranks as before, a space and all', () => {
    assert.deepEqual(search('thunder punch').map((m) => m.name), ['Thunder Punch']);
    assert.deepEqual(search('bolt'), searchByName(moves, 'bolt'));
  });

  test('a name, a type and a negation combine; sheet filters still apply', () => {
    const punches = search('punch & !fire');
    assert.ok(punches.length > 0 && punches.every(({ name, move }) => /punch/i.test(name) && move.type !== 'fire'));
    assert.ok(search('status | fire', { gens: [1] }).every(({ move }) => move.gen === 1 && (move.category === 'status' || move.type === 'fire')));
  });

  test('a lone keyword also lists the names holding the word; with operators it is exact', () => {
    const rock = search('rock');
    assert.ok(rock.some((m) => m.name === 'Rock Climb' && m.move.type === 'normal'));
    assert.ok(rock.some((m) => m.name === 'Stone Edge'));
    assert.ok(search('rock & !special').every(({ move }) => move.type === 'rock'));
  });

  test('typing an operator never blanks the list', () => {
    for (const q of ['&', '|', '!', '(', ')']) assert.equal(search(q).length, moves.length, q);
    assert.deepEqual(search('bolt &'), search('bolt'));
    assert.deepEqual(search('bolt & !.'), search('bolt'));
  });
});

describe('Items search on the real data', () => {
  const items = Object.values(readData<ItemReferenceTable>('reference/items.json')).map((item) => ({ name: item.name, item }));
  const search = (query: string) => filterItems(items, { query, categories: [], gens: [] });

  test('berry | !held lists everything but the held items that are not berries', () => {
    const hits = search('berry | !held');
    assert.ok(hits.length > 0);
    assert.ok(hits.some(({ item }) => item.category === 'Berries'));
    assert.ok(!hits.some(({ item }) => item.category === 'Held items'));
    assert.equal(hits.length, items.filter(({ item }) => item.category !== 'Held items').length);
  });

  test('a category with an "&" in its name works by either part or typed in full', () => {
    const tms = items.filter(({ item }) => item.category === 'TMs & TRs').length;
    for (const q of ['tms & trs', 'tr & tm']) assert.equal(search(q).length, tms, q);
    assert.ok(search('tms').length >= tms);
  });

  test('a real item name stays a name search, the Poké Ball included', () => {
    const balls = search('Poké Ball');
    assert.ok(balls.length > 0 && balls.every((e) => /pok.\s?ball/i.test(e.name)));
    assert.deepEqual(search("Parcel (Let's Go)").map((e) => e.name), ["Parcel (Let's Go)"]);
  });

  test('no category word is the exact name of an item', () => {
    assert.deepEqual(items.filter((e) => searchKey(e.name) in ITEM_CATEGORY_WORDS).map((e) => e.name), []);
  });

  test('a lone keyword also lists the names holding the word; with operators it is exact', () => {
    assert.ok(search('tr').some((e) => e.name === 'Metronome'));
    assert.ok(!search('tr & !berry').some((e) => e.name === 'Metronome'));
  });

  test('a name with an "&" in it is still found', () => {
    assert.ok(search('B&W Grass Tablecloth').some((e) => e.name === 'B&W Grass Tablecloth'));
  });
});
