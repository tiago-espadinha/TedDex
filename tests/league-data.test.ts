import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, test } from 'node:test';
import type { IndexEntry, LeagueGame, LeagueSummary, LeagueTeam, SpeciesDetail } from '../src/data/types';

// The committed output of `npm run league`.
describe('league data', () => {
  const dir = new URL('../public/data/league/', import.meta.url);
  const read = <T>(file: string) => JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as T;
  const index = read<LeagueSummary[]>('index.json');
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
        checkTeams(t.name, t.teams);
        for (const r of t.rematches ?? []) {
          assert.ok(r.label, `${t.name}: rematch label`);
          checkTeams(`${t.name} (${r.label})`, r.teams);
        }
      }
    });
  }

  test('every form a member uses is one of its species\' forms', () => {
    for (const { id } of index) {
      for (const t of read<LeagueGame>(`${id}.json`).trainers) {
        for (const team of [...t.teams, ...(t.rematches ?? []).flatMap((r) => r.teams)]) {
          for (const m of team.members) {
            const forms = (read<SpeciesDetail>(`../species/${m.id}.json`).forms ?? []).map((f) => f.key);
            for (const key of [m.form, m.battleForm]) if (key) assert.ok(forms.includes(key), `${id} / ${t.name}: ${m.id} form ${key}`);
          }
        }
      }
    }
  });

  test('every trainer has a sprite file', () => {
    for (const { id } of index) {
      for (const t of read<LeagueGame>(`${id}.json`).trainers) {
        assert.ok(t.sprite && existsSync(new URL(`${t.sprite}.webp`, sprites)), `${id} / ${t.name}: sprite ${t.sprite}`);
      }
    }
  });

  test('rematches only in games with a post-game league rematch', () => {
    const withRematches = index.map((g) => g.id).filter((id) => read<LeagueGame>(`${id}.json`).trainers.some((t) => t.rematches));
    assert.deepEqual(withRematches, [
      'firered-leafgreen', 'platinum', 'heartgold-soulsilver', 'black-white', 'black2-white2',
      'omega-ruby-alpha-sapphire', 'sun-moon', 'ultra-sun-ultra-moon', 'lets-go', 'brilliant-diamond-shining-pearl',
    ]);
    // Battle facilities (Battle Tree, Battle Chateau, Battle Tower) never count as rematches.
    const labels = index.flatMap((g) => read<LeagueGame>(`${g.id}.json`).trainers.flatMap((t) => t.rematches ?? []).map((r) => r.label));
    assert.ok(labels.every((l) => !/Battle (Tree|Chateau|Tower)/.test(l)), labels.join(', '));
    // BDSP has two rematch stages; B2W2 uses the Easy/Normal Mode rematch, not Challenge Mode.
    const bdsp = read<LeagueGame>('brilliant-diamond-shining-pearl.json').trainers[0];
    assert.equal(bdsp.rematches?.length, 2);
    assert.match(read<LeagueGame>('black2-white2.json').trainers[0].rematches?.[0].label ?? '', /Easy Mode\/Normal Mode/);
  });
});
