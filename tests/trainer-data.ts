import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import type { IndexEntry, LeagueGame, LeagueSummary, LeagueTeam, SpeciesDetail } from '../src/data/types';
import { dataEntry } from './data-files';

/** Reader for one folder of `npm run league` output (league/ or gyms/), plus the checks both folders share. */
export function trainerData(folder: string) {
  const dir = new URL(`../public/data/${folder}/`, import.meta.url);
  const read = <T>(file: string) => JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as T;
  const index = read<LeagueSummary[]>('index.json');
  const game = (id: string) => read<LeagueGame>(`${id}.json`);
  const species = new Set(read<IndexEntry[]>('../index.json').map((s) => s.id));
  const moves = new Set(Object.keys(read<Record<string, unknown>>('../moves.json')).map(Number));
  const sprites = new URL('../../media/trainers/', dir);

  const checkTeams = (name: string, teams: LeagueTeam[]) => {
    assert.ok(teams.length >= 1);
    for (const team of teams) {
      assert.equal(!!team.label, teams.length > 1, `${name}: label only when there are alternatives`);
      assert.ok(team.members.length >= 1 && team.members.length <= 6, `${name}: team size`);
      for (const m of team.members) {
        assert.ok(species.has(m.id), `${name}: species ${m.id}`);
        assert.ok(m.level >= 1 && m.level <= 100, `${name}: level ${m.level}`);
        assert.ok(m.moves.length <= 4 && m.moves.every((id) => moves.has(id)), `${name}: moves of ${m.id}`);
      }
    }
  };

  /** Registers the shared tests: index ↔ files, team shape, sources, forms and sprites. */
  const sharedTests = () => {
    test('index lists every game file, oldest generation first', () => {
      const files = readdirSync(dir).filter((f) => f !== 'index.json').map((f) => f.replace('.json', ''));
      assert.deepEqual([...files].sort(), index.map((g) => g.id).sort());
      assert.deepEqual(index.map((g) => g.gen), [...index.map((g) => g.gen)].sort((a, b) => a - b));
    });

    test('full teams with known species and moves, and a Bulbapedia source', () => {
      for (const { id } of index) {
        for (const t of game(id).trainers) {
          assert.match(t.source, /^https:\/\/bulbapedia\.bulbagarden\.net\/wiki\//);
          checkTeams(`${id} / ${t.name}`, t.teams);
          for (const r of t.rematches ?? []) {
            assert.ok(r.label, `${t.name}: rematch label`);
            checkTeams(`${id} / ${t.name} (${r.label})`, r.teams);
          }
        }
      }
    });

    test('every form a member uses is one of its species\' forms', () => {
      for (const { id } of index) {
        for (const t of game(id).trainers) {
          for (const team of [...t.teams, ...(t.rematches ?? []).flatMap((r) => r.teams)]) {
            for (const m of team.members) {
              const forms = (dataEntry<SpeciesDetail>('species', m.id).forms ?? []).map((f) => f.key);
              for (const key of [m.form, m.battleForm]) if (key) assert.ok(forms.includes(key), `${id} / ${t.name}: ${m.id} form ${key}`);
            }
          }
        }
      }
    });

    test('every trainer has a sprite file', () => {
      for (const { id } of index) {
        for (const t of game(id).trainers) {
          assert.ok(t.sprite && existsSync(new URL(`${t.sprite}.webp`, sprites)), `${id} / ${t.name}: sprite ${t.sprite}`);
        }
      }
    });
  };

  const withRematches = () => index.map((g) => g.id).filter((id) => game(id).trainers.some((t) => t.rematches));
  const rematchLabels = () => index.flatMap((g) => game(g.id).trainers.flatMap((t) => t.rematches ?? []).map((r) => r.label));
  return { index, game, sharedTests, withRematches, rematchLabels };
}
