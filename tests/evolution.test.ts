import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { branches, currentForm, evolutionLines, shortCondition } from '../src/data/evolution';
import type { EvolutionMember, SpeciesDetail } from '../src/data/types';
import { dataEntry } from './data-files';

const linesOf = (id: number, formKey = '') => {
  const chain = dataEntry<EvolutionMember[]>('evolution', dataEntry<SpeciesDetail>('species', id).evolutionChainId!);
  return evolutionLines(chain, id, formKey);
};
/** Each line as "id:form" stages, for compact comparisons. */
const shape = (id: number, formKey = '') => linesOf(id, formKey).map((l) => l.stages.map((s) => `${s.id}:${s.form}`));

describe('evolutionLines', () => {
  test('a plain chain is one row', () => {
    const [line, ...rest] = linesOf(6);
    assert.equal(rest.length, 0);
    assert.deepEqual(line.stages.map((s) => s.conditions), [[], ['Lv. 16'], ['Lv. 36']]);
    assert.equal(branches(line.stages), false);
  });
  test('regional lines follow the main one, without regional-only members in the main line', () => {
    assert.deepEqual(shape(52), [
      ['52:', '53:'],
      ['52:alola', '53:alola'],
      ['52:galar', '863:'],
    ]);
    assert.deepEqual(shape(27), [['27:', '28:'], ['27:alola', '28:alola']]);
    assert.deepEqual(linesOf(27)[1].stages[1].conditions, ['Use Ice Stone']);
  });
  test('a region seen from its first form keeps the plain ancestors and later forms', () => {
    assert.deepEqual(shape(439), [['439:', '122:'], ['439:', '122:galar', '866:']]);
    assert.deepEqual(shape(25), [['172:', '25:', '26:'], ['172:', '25:', '26:alola']]);
  });
  test('every page of the species shows the same lines; a non-regional form keeps its own line', () => {
    assert.deepEqual(shape(52, 'galar'), shape(52));
    assert.deepEqual(shape(6, 'mega-x'), shape(6));
    assert.deepEqual(shape(849, 'low-key')[0], ['848:', '849:low-key']);
  });
  test('branching chains', () => {
    assert.equal(branches(linesOf(133)[0].stages), true);
    assert.equal(linesOf(133)[0].stages.length, 9);
    assert.equal(branches(linesOf(265)[0].stages), true);
  });
});

describe('currentForm', () => {
  test('the form itself, its region, or the default', () => {
    assert.equal(currentForm(linesOf(52), 52, 'galar'), 'galar');
    assert.equal(currentForm(linesOf(555), 555, 'galar-zen'), 'galar-standard');
    assert.equal(currentForm(linesOf(6), 6, 'mega-x'), '');
  });
});

describe('shortCondition', () => {
  test('shortens the usual methods', () => {
    assert.equal(shortCondition('Lv. 16'), 'Lv 16');
    assert.equal(shortCondition('Use Water Stone'), 'Water Stone');
    assert.equal(shortCondition('Level up · high friendship · during the day'), 'Friendship, day');
    assert.equal(shortCondition('Level up · high friendship · knowing a Fairy-type move'), 'Friendship, Fairy move');
    assert.equal(shortCondition('Lv. 7 · 50% chance'), 'Lv 7, random');
    assert.equal(shortCondition('Lv. 20 · Attack > Defense'), 'Lv 20, Atk > Def');
    assert.equal(shortCondition('Level up · holding Razor Claw · at night'), 'Hold Razor Claw, night');
    assert.equal(shortCondition('Level up · knowing Mimic'), 'Know Mimic');
    assert.equal(shortCondition('Trade holding Metal Coat'), 'Trade, hold Metal Coat');
  });
  test('keeps what has no short form', () => {
    assert.equal(shortCondition('Level up'), 'Level up');
    assert.equal(shortCondition('Use Rage Fist 20 times'), 'Use Rage Fist 20 times');
    assert.equal(shortCondition('Trade'), 'Trade');
  });
});
