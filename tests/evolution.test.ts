import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  branches,
  currentForm,
  evolutionLine,
  megaForms,
  megaGroups,
  megaSpecies,
  shortCondition,
  targetsOf,
} from '../src/data/evolution';
import type { EvolutionMember, IndexEntry, SpeciesDetail } from '../src/data/types';
import { dataEntry, readData } from './data-files';

const lineOf = (id: number, formKey = '') => {
  const chain = dataEntry<EvolutionMember[]>('evolution', dataEntry<SpeciesDetail>('species', id).evolutionChainId!);
  return evolutionLine(chain, id, formKey);
};
/** The line as "id:form" stages, for compact comparisons. */
const shape = (id: number, formKey = '') => lineOf(id, formKey).map((s) => `${s.id}:${s.form}`);

describe('evolutionLine', () => {
  test('a plain chain is one row', () => {
    const line = lineOf(6);
    assert.deepEqual(
      line.map((s) => s.conditions),
      [[], ['Lv. 16'], ['Lv. 36']],
    );
    assert.equal(branches(line), false);
  });
  test('a form follows only its own line, from every stage', () => {
    for (const id of [19, 20]) {
      assert.deepEqual(shape(id), ['19:', '20:']);
      assert.deepEqual(shape(id, 'alola'), ['19:alola', '20:alola']);
    }
    assert.deepEqual(shape(79), ['79:', '80:', '199:']);
    assert.deepEqual(shape(80, 'galar'), ['79:galar', '80:galar', '199:galar']);
    assert.deepEqual(lineOf(27, 'alola')[1].conditions, ['Use Ice Stone']);
  });
  test('each region of a species has its own line', () => {
    assert.deepEqual(shape(52), ['52:', '53:']);
    assert.deepEqual(shape(52, 'alola'), ['52:alola', '53:alola']);
    assert.deepEqual(shape(52, 'galar'), ['52:galar', '863:']);
  });
  test('a species only a regional form reaches shows that line', () => {
    assert.deepEqual(shape(863), ['52:galar', '863:']);
    assert.deepEqual(shape(865), ['83:galar', '865:']);
    assert.deepEqual(shape(862), ['263:galar', '264:galar', '862:']);
    assert.deepEqual(shape(903), ['215:hisui', '903:']);
  });
  test('a form with nothing to follow shows no line', () => {
    assert.deepEqual(shape(83), []);
    assert.deepEqual(shape(83, 'galar'), ['83:galar', '865:']);
  });
  test('a region that starts after the base is a fork, on all its pages', () => {
    assert.deepEqual(shape(104), ['104:', '105:', '105:alola']);
    assert.deepEqual(shape(105), shape(104));
    assert.deepEqual(shape(105, 'alola'), shape(104));
    assert.deepEqual(shape(102), ['102:', '103:', '103:alola']);
    assert.deepEqual(shape(25), ['172:', '25:', '26:', '26:alola']);
    assert.deepEqual(shape(109), ['109:', '110:', '110:galar']);
    assert.deepEqual(shape(439), ['439:', '122:', '122:galar', '866:']);
    assert.deepEqual(shape(866), shape(439));
    assert.deepEqual(shape(704), ['704:', '705:', '706:', '705:hisui', '706:hisui']);
    assert.equal(branches(lineOf(104)), true);
  });
  test('only the branch names its region, on its own arrow', () => {
    const regions = (id: number) => lineOf(id).map((s) => s.region);
    assert.deepEqual(regions(104), [undefined, undefined, 'Alola']);
    assert.deepEqual(regions(704), [undefined, undefined, undefined, 'Hisui', undefined]);
    assert.deepEqual(lineOf(104)[2].conditions, ['Lv. 28 · at night']);
    assert.equal(lineOf(52, 'galar').filter((s) => s.region).length, 0);
  });
  test('a stage leads only to what its own form evolves into', () => {
    const stages = lineOf(439);
    const [, mime, galarian, rime] = stages;
    assert.deepEqual(targetsOf(stages, mime), []);
    assert.deepEqual(targetsOf(stages, galarian), [rime]);
    assert.deepEqual(targetsOf(stages, stages[0]), [mime, galarian]);
  });
  test('both forms of a fork keep their own next stage', () => {
    const stages = lineOf(704);
    const [, sliggoo, goodra, hisuianSliggoo, hisuianGoodra] = stages;
    assert.deepEqual(targetsOf(stages, sliggoo), [goodra]);
    assert.deepEqual(targetsOf(stages, hisuianSliggoo), [hisuianGoodra]);
  });
  test('a non-regional form sees the plain chain or its own steps', () => {
    assert.deepEqual(shape(6, 'mega-x'), shape(6));
    assert.deepEqual(shape(849, 'low-key'), ['848:', '849:low-key']);
  });
  test('branching chains', () => {
    assert.equal(branches(lineOf(133)), true);
    assert.equal(lineOf(133).length, 9);
    assert.equal(branches(lineOf(265)), true);
  });
});

describe('megaSpecies', () => {
  const index = readData<IndexEntry[]>('index.json');
  const of = (id: number) => {
    const chainId = dataEntry<SpeciesDetail>('species', id).evolutionChainId;
    return megaSpecies(chainId ? dataEntry<EvolutionMember[]>('evolution', chainId) : [], index, id);
  };
  test('every stage sees the Megas of its chain', () => {
    assert.deepEqual(of(1), [3]);
    assert.deepEqual(of(2), [3]);
    assert.deepEqual(of(4), [6]);
    assert.deepEqual(of(133), []);
  });
  test('the species shown comes first', () => {
    assert.deepEqual(of(475), [475, 282]);
    assert.deepEqual(of(280), [282, 475]);
  });
  test('a species with no chain keeps its own Primal', () => {
    assert.deepEqual(of(382), [382]);
  });
});

describe('megaForms', () => {
  const names = (ownerIds: number[], formKey: string) =>
    megaForms(
      ownerIds.map((id) => dataEntry<SpeciesDetail>('species', id)),
      formKey,
    ).map(({ form }) => form.name);
  test('a default form lists the Megas of its chain', () => {
    assert.deepEqual(names([80], ''), ['Mega Slowbro']);
    assert.deepEqual(names([26], ''), ['Mega Raichu X', 'Mega Raichu Y']);
  });
  test('a regional form lists none', () => {
    assert.deepEqual(names([80], 'galar'), []);
    assert.deepEqual(names([26], 'alola'), []);
  });
  test('a Mega page still lists its Megas', () => {
    assert.deepEqual(names([80], 'mega'), ['Mega Slowbro']);
  });
});

describe('megaGroups', () => {
  const index = readData<IndexEntry[]>('index.json');
  /** The page's groups as "owner: form count", from the same calls the page makes. */
  const groups = (id: number, formKey = '') => {
    const chainId = dataEntry<SpeciesDetail>('species', id).evolutionChainId;
    const owners = megaSpecies(chainId ? dataEntry<EvolutionMember[]>('evolution', chainId) : [], index, id);
    const megas = megaForms(
      owners.map((o) => dataEntry<SpeciesDetail>('species', o)),
      formKey,
    );
    return megaGroups(megas).map(({ owner, forms }) => `${owner.name}: ${forms.length}`);
  };
  test('only the species with several Megas fan, to as many as they have', () => {
    const fans = index
      .filter((s) => s.forms?.some((f) => f.kind === 'mega'))
      .flatMap((s) => groups(s.id).filter((g) => g.startsWith(`${s.name}:`) && !g.endsWith(': 1')));
    assert.deepEqual(fans.sort(), [
      'Absol: 2',
      'Charizard: 2',
      'Garchomp: 2',
      'Lucario: 2',
      'Magearna: 2',
      'Meowstic: 2',
      'Mewtwo: 2',
      'Raichu: 2',
      'Tatsugiri: 3',
    ]);
  });
  test('earlier stages see the fan of the species that Mega Evolves', () => {
    assert.deepEqual(groups(4), ['Charizard: 2']);
    assert.deepEqual(groups(5), ['Charizard: 2']);
  });
  test('one Mega stays one form', () => {
    assert.deepEqual(groups(3), ['Venusaur: 1']);
  });
  test('Megas on different species of a chain stay separate', () => {
    assert.deepEqual(groups(280), ['Gardevoir: 1', 'Gallade: 1']);
    assert.deepEqual(groups(475), ['Gallade: 1', 'Gardevoir: 1']);
  });
  test('a regional form has no groups', () => {
    assert.deepEqual(groups(26, 'alola'), []);
  });
});

describe('currentForm', () => {
  test('the form on a branch of the own line', () => {
    assert.equal(currentForm(lineOf(105, 'alola'), 105, 'alola'), 'alola');
  });
  test('the form itself, its region, or the default', () => {
    assert.equal(currentForm(lineOf(52, 'galar'), 52, 'galar'), 'galar');
    assert.equal(currentForm(lineOf(555, 'galar-zen'), 555, 'galar-zen'), 'galar-standard');
    assert.equal(currentForm(lineOf(6, 'mega-x'), 6, 'mega-x'), '');
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
