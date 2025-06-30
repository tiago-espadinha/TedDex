import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { trainerData } from '../helpers/trainer-data';

// The gyms/ half of `npm run league`.
describe('gym data', () => {
  const { index, game, sharedTests, withRematches, rematchLabels } = trainerData('gyms');
  sharedTests();

  test('the same 19 games as the league', () => {
    assert.deepEqual(index, trainerData('league').index);
  });

  test('every leader has a type and a badge (a Z-Crystal in Alola)', () => {
    for (const { id, region } of index) {
      for (const t of game(id).trainers) {
        // Blue's Viridian Gym in Johto games mixes types.
        if (t.name !== 'Blue') assert.ok(t.type, `${id} / ${t.name}: type`);
        assert.match(t.badge ?? '', region === 'Alola' ? / Z$/ : / Badge$/, `${id} / ${t.name}`);
      }
    }
  });

  test('Brock in Red/Blue has Geodude and Onix', () => {
    const brock = game('red-blue').trainers[0];
    assert.equal(brock.name, 'Brock');
    assert.deepEqual(
      brock.teams[0].members.map((m) => m.id),
      [74, 95],
    );
  });

  test('Johto games include the Kanto Gyms; version-exclusive leaders are listed apart', () => {
    assert.equal(game('heartgold-soulsilver').trainers.length, 16);
    const galar = game('sword-shield').trainers.map((t) => `${t.name}: ${t.role}`);
    assert.ok(
      galar.includes('Bea: Gym Leader · Sword') && galar.includes('Allister: Gym Leader · Shield'),
      galar.join(', '),
    );
  });

  test('rematches only in games with post-game Gym rematches, never facilities', () => {
    assert.deepEqual(withRematches(), [
      'emerald',
      'platinum',
      'heartgold-soulsilver',
      'lets-go',
      'brilliant-diamond-shining-pearl',
      'scarlet-violet',
    ]);
    const labels = rematchLabels();
    assert.ok(
      labels.every((l) => !/Battle |Tournament|League Club/.test(l)),
      labels.join(', '),
    );
    // Emerald's leaders get stronger over four rematch stages.
    assert.equal(game('emerald').trainers[0].rematches?.length, 4);
  });
});
