import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { findTrainer, readTeamPick, shownTeam, teamPickParams, teamSummary, trainerSlug } from '../src/data/trainers';
import { trainerData } from './trainer-data';

describe('trainer pages', () => {
  const gyms = trainerData('gyms');
  const league = trainerData('league');

  test('slugs are plain and unique within every game', () => {
    assert.equal(trainerSlug('Lt. Surge'), 'lt-surge');
    assert.equal(trainerSlug('Tate & Liza'), 'tate-liza');
    for (const data of [gyms, league]) {
      for (const { id } of data.index) {
        const slugs = data.game(id).trainers.map((t) => trainerSlug(t.name));
        assert.ok(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)), `${id}: ${slugs.join(', ')}`);
        assert.equal(new Set(slugs).size, slugs.length, `${id}: ${slugs.join(', ')}`);
      }
    }
  });

  test('Brock in Red/Blue: 2 Pokémon, Lv 14', () => {
    const brock = findTrainer(gyms.game('red-blue'), 'brock');
    assert.ok(brock);
    assert.deepEqual(teamSummary(shownTeam(brock, { rematch: false, stage: 0, pick: 0 }).team), { count: 2, level: 14 });
  });

  test('an unknown slug finds nobody', () => {
    assert.equal(findTrainer(gyms.game('red-blue'), 'lance'), undefined);
  });

  test('rematch stages and choices pick the team; out of range falls back', () => {
    const roxanne = gyms.game('emerald').trainers[0];
    const stages = roxanne.rematches ?? [];
    assert.equal(shownTeam(roxanne, { rematch: true, stage: 2, pick: 0 }).team, stages[2].teams[0]);
    assert.equal(shownTeam(roxanne, { rematch: true, stage: 99, pick: 0 }).stage, stages.length - 1);
    assert.equal(shownTeam(roxanne, { rematch: false, stage: 2, pick: 0 }).team, roxanne.teams[0]);
    const blue = findTrainer(league.game('red-blue'), 'blue');
    assert.ok(blue && blue.teams.length === 3);
    assert.equal(shownTeam(blue, { rematch: false, stage: 0, pick: 2 }).team, blue.teams[2]);
    assert.equal(shownTeam(blue, { rematch: false, stage: 0, pick: -1 }).pick, 0);
    assert.equal(shownTeam(blue, { rematch: true, stage: 0, pick: 1 }).stages, undefined);
  });

  test('the pick round-trips through the URL', () => {
    const pick = { rematch: true, stage: 3, pick: 1 };
    assert.deepEqual(readTeamPick(new URLSearchParams(teamPickParams(pick))), pick);
    assert.deepEqual(teamPickParams({ rematch: false, stage: 3, pick: 0 }), {});
  });
});
