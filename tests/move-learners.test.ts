import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, test } from 'node:test';
import { unpackLearnsets, type PackedLearnsets } from '../src/data/chunks';
import { shownGame } from '../src/data/game';
import { learnerBit, learnerGames, learnersIn } from '../src/data/moveLearners';
import type { LearnMethod, MoveReference, MoveTable, VersionGroup } from '../src/data/types';
import { dataEntry, readData } from './data-files';

const TACKLE = 33;
const SPORE = 147;
const MOONBLAST = 585;
const PARAS = 46;
const RED_BLUE = 1;
const EMERALD = 6;
const SCARLET_VIOLET = 25;
const METHODS: LearnMethod[] = ['level', 'machine', 'tutor', 'egg'];

const groups = readData<VersionGroup[]>('versions.json').map((v) => v.id);
const learnersOf = (move: number) => dataEntry<MoveReference>('reference/moves', move).learners;

/** "move/method/game" -> species that learn it, read from every learnset, forms' lists included. */
function fromLearnsets() {
  const out = new Map<string, Set<number>>();
  const add = (move: number, method: LearnMethod, game: string, species: number) => {
    const key = `${move}/${method}/${game}`;
    out.set(key, (out.get(key) ?? new Set()).add(species));
  };
  for (const file of readdirSync(new URL('../public/data/learnsets/', import.meta.url))) {
    const chunk = readData<Record<number, PackedLearnsets>>(`learnsets/${file}`);
    for (const [id, packed] of Object.entries(chunk)) {
      for (const formKey of [undefined, ...Object.keys(packed.forms ?? {})]) {
        for (const [game, set] of Object.entries(unpackLearnsets(packed, formKey))) {
          for (const [move] of set.level) add(move, 'level', game, Number(id));
          for (const method of ['machine', 'tutor', 'egg'] as const) for (const move of set[method]) add(move, method, game, Number(id));
        }
      }
    }
  }
  return out;
}

describe('move learners by game', () => {
  test('every move, game and method lists exactly the species whose learnsets have it', () => {
    const expected = fromLearnsets();
    for (const move of Object.keys(readData<MoveTable>('moves.json')).map(Number)) {
      const learners = learnersOf(move);
      for (const group of groups) {
        for (const method of METHODS) {
          const want = [...(expected.get(`${move}/${method}/${group}`) ?? [])].sort((a, b) => a - b);
          assert.deepEqual(learnersIn(learners, method, group), want, `move ${move}, ${method}, game ${group}`);
        }
      }
    }
  });

  test('Paras learns Spore by level in Emerald', () => {
    assert.ok(learnersIn(learnersOf(SPORE), 'level', EMERALD).includes(PARAS));
  });

  test('a move nobody learns in the game has no game to show; Latest is its newest', () => {
    const games = learnerGames(learnersOf(MOONBLAST), groups);
    assert.equal(shownGame(games, EMERALD), undefined);
    assert.equal(shownGame(games, 'latest'), SCARLET_VIOLET);
    assert.equal(shownGame(learnerGames(learnersOf(TACKLE), groups), RED_BLUE), RED_BLUE);
  });

  test('group 32, the last bit of a mask, reads back without touching other games', () => {
    const learners = { level: [[PARAS, learnerBit(32) | learnerBit(RED_BLUE)]] } as MoveReference['learners'];
    assert.deepEqual(learnerGames(learners, [RED_BLUE, EMERALD, 32]), [RED_BLUE, 32]);
    assert.deepEqual(learnersIn(learners, 'level', 32), [PARAS]);
    assert.deepEqual(learnersIn(learners, 'level', EMERALD), []);
  });

  test('a group past 32 is refused by name rather than wrapping onto another game', () => {
    assert.throws(() => learnerBit(33), /Version group 33 /);
  });

  test('every game in the data fits a mask', () => {
    for (const group of groups) assert.doesNotThrow(() => learnerBit(group));
  });
});
