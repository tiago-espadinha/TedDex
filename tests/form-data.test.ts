import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, test } from 'node:test';
import { packLearnsets, unpackLearnsets, unpackLocations, type PackedLearnsets, type PackedLocations } from '../src/data/chunks';
import { chainInForm } from '../src/data/evolution';
import { hasOwnFormData } from '../src/data/forms';
import { encountersIn, locationsOfForm } from '../src/data/locations';
import type { EvolutionMember, IndexEntry, MoveTable, SpeciesDetail } from '../src/data/types';
import { dataEntry, readData } from './data-files';

const ICE_BALL = 301;
const ICICLE_SPEAR = 333;
const SUN_MOON = 17;
const learnsetChunk = (n: number) => readData<Record<number, PackedLearnsets>>(`learnsets/c${n}.json`);
const evolution = (chainId: number) => dataEntry<EvolutionMember[]>('evolution', chainId);
const chainOf = (id: number) => evolution(dataEntry<SpeciesDetail>('species', id).evolutionChainId!);

describe('form learnsets', () => {
  test('pack and unpack a form beside its species, falling back to the species', () => {
    const species = { 1: { level: [[33, 1]] as [number, number][], machine: [5], tutor: [], egg: [] } };
    const alola = { 1: { level: [[333, 1]] as [number, number][], machine: [5], tutor: [], egg: [] } };
    const packed: PackedLearnsets = JSON.parse(JSON.stringify(packLearnsets(species, { alola })));
    assert.deepEqual(unpackLearnsets(packed, 'alola'), alola);
    assert.deepEqual(unpackLearnsets(packed), species);
    assert.deepEqual(unpackLearnsets(packed, 'mega'), species);
    assert.equal(packLearnsets(species).forms, undefined);
  });

  test('in Sun/Moon Alolan Sandshrew learns Ice Ball by level and Icicle Spear by egg; Sandshrew neither', () => {
    const sunMoon = (formKey?: string) => unpackLearnsets(learnsetChunk(0)[27], formKey)[SUN_MOON];
    assert.ok(sunMoon('alola').level.some(([m, level]) => m === ICE_BALL && level === 7));
    assert.ok(sunMoon('alola').egg.includes(ICICLE_SPEAR));
    assert.ok(!sunMoon().level.some(([m]) => m === ICE_BALL) && !sunMoon().egg.includes(ICICLE_SPEAR));
  });

  test("every form learnset is a shipped form's with its own data, and its moves are in moves.json", () => {
    const moves = readData<MoveTable>('moves.json');
    for (const file of readdirSync(new URL('../public/data/learnsets/', import.meta.url))) {
      for (const [id, entry] of Object.entries(readData<Record<number, PackedLearnsets>>(`learnsets/${file}`))) {
        const keys = new Set(dataEntry<SpeciesDetail>('species', Number(id)).forms?.map((f) => f.key));
        for (const key of Object.keys(entry.forms ?? {})) {
          assert.ok(keys.has(key) && hasOwnFormData(key), `${id} ${key}`);
          for (const set of Object.values(unpackLearnsets(entry, key))) {
            for (const m of [...set.level.map(([move]) => move), ...set.machine, ...set.tutor, ...set.egg]) assert.ok(moves[m], `${id} ${key} move ${m}`);
          }
        }
      }
    }
  });

  test('Megas and Gigantamax learn as their species', () => {
    for (const id of [3, 6, 12]) assert.equal(learnsetChunk(0)[id].forms, undefined, String(id));
  });
});

describe('form evolutions', () => {
  const names = (stages: { id: number; form: string }[]) => stages.map((s) => `${s.id}${s.form && `-${s.form}`}`);

  test('Alolan Sandshrew evolves into Alolan Sandslash with an Ice Stone; Sandshrew by level', () => {
    const alola = chainInForm(chainOf(27), 27, 'alola');
    assert.deepEqual(names(alola), ['27-alola', '28-alola']);
    assert.deepEqual(alola[1].conditions, ['Use Ice Stone']);
    assert.deepEqual(chainInForm(chainOf(27), 27, '')[1].conditions, ['Lv. 22']);
  });

  test('Galarian Meowth leads to Perrserker, Alolan Meowth to Alolan Persian', () => {
    assert.deepEqual(names(chainInForm(chainOf(52), 52, 'galar')), ['52-galar', '863']);
    assert.deepEqual(names(chainInForm(chainOf(52), 52, 'alola')), ['52-alola', '53-alola']);
  });

  test('Alolan Raichu comes from plain Pikachu; a Mega sees the plain chain', () => {
    assert.deepEqual(names(chainInForm(chainOf(26), 26, 'alola')), ['172', '25', '26-alola']);
    assert.deepEqual(names(chainInForm(chainOf(6), 6, 'mega-x')), ['4', '5', '6']);
  });

  test("Galarian Zen Darmanitan follows the Galarian line and keeps its own card", () => {
    assert.deepEqual(names(chainInForm(chainOf(555), 555, 'galar-zen')), ['554-galar', '555-galar-zen']);
  });
});

describe('form locations', () => {
  const locations = (id: number) => unpackLocations(readData<PackedLocations>(`locations/c${Math.floor(id / 64)}.json`), id)!;
  const rowCount = (l: ReturnType<typeof locations>) => Object.values(l.games).flat().length;

  test("Alolan Sandshrew's rows are apart from Sandshrew's and carry no form label", () => {
    const all = locations(27);
    const alola = locationsOfForm(all, 'alola');
    const plain = locationsOfForm(all, '');
    assert.ok(rowCount(alola) > 0 && rowCount(plain) > 0);
    assert.equal(rowCount(alola) + rowCount(plain), rowCount(all));
    for (const game of Object.keys(alola.games)) for (const e of encountersIn(alola, Number(game))) assert.equal(e.form, '');
  });

  test("battle-only forms are found as their species; a regional form never shows the species' rows", () => {
    const plain = (id: number) => rowCount(locationsOfForm(locations(id), ''));
    assert.equal(rowCount(locationsOfForm(locations(555), 'zen')), plain(555));
    assert.equal(rowCount(locationsOfForm(locations(6), 'mega-x')), plain(6));
    assert.equal(locationsOfForm(locations(76), 'alola').games[1], undefined); // Golem is in Red, Alolan Golem isn't
    assert.equal(rowCount(locationsOfForm({ strings: [''], games: { 1: [[0, 0, 5, 5, 0, 0, 0, 0]] } }, 'alola')), 0);
  });

  test('species with no own-form rows keep every row in the plain view', () => {
    const index = readData<IndexEntry[]>('index.json');
    for (const { id, forms } of index.slice(0, 151)) {
      if (forms?.some((f) => hasOwnFormData(f.key))) continue;
      assert.equal(rowCount(locationsOfForm(locations(id), '')), rowCount(locations(id)), String(id));
    }
  });
});
