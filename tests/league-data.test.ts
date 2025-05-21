import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, test } from 'node:test';
import type { IndexEntry, LeagueGame, LeagueSummary } from '../src/data/types';

// The committed output of `npm run league`.
describe('league data', () => {
  const dir = new URL('../public/data/league/', import.meta.url);
  const read = <T>(file: string) => JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as T;
  const index = read<LeagueSummary[]>('index.json');
  const species = new Set(read<IndexEntry[]>('../index.json').map((s) => s.id));
  const moves = new Set(Object.keys(read<Record<string, unknown>>('../moves.json')).map(Number));

  test('index lists every game file, oldest generation first', () => {
    const files = readdirSync(dir).filter((f) => f !== 'index.json').map((f) => f.replace('.json', ''));
    assert.deepEqual([...files].sort(), index.map((g) => g.id).sort());
    assert.deepEqual(index.map((g) => g.gen), [...index.map((g) => g.gen)].sort((a, b) => a - b));
  });

  for (const summary of index) {
    test(`${summary.id}: a champion last, full teams with known species and moves`, () => {
      const game = read<LeagueGame>(`${summary.id}.json`);
      assert.equal(game.trainers.at(-1)?.role, 'Champion');
      for (const t of game.trainers) {
        assert.match(t.source, /^https:\/\/bulbapedia\.bulbagarden\.net\/wiki\//);
        assert.ok(t.teams.length >= 1);
        for (const team of t.teams) {
          assert.equal(!!team.label, t.teams.length > 1, `${t.name}: label only when there are alternatives`);
          assert.ok(team.members.length >= 1 && team.members.length <= 6, `${t.name}: team size`);
          for (const m of team.members) {
            assert.ok(species.has(m.id), `${t.name}: species ${m.id}`);
            assert.ok(m.level >= 1 && m.level <= 100, `${t.name}: level ${m.level}`);
            assert.ok(m.moves.length <= 4 && m.moves.every((id) => moves.has(id)), `${t.name}: moves of ${m.id}`);
          }
        }
      }
    });
  }
});
