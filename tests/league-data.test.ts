import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { trainerData } from './trainer-data';

// The committed output of `npm run league`.
describe('league data', () => {
  const { index, game, sharedTests, withRematches, rematchLabels } = trainerData('league');
  sharedTests();

  test('every game ends with its Champion', () => {
    for (const { id } of index) assert.equal(game(id).trainers.at(-1)?.role, 'Champion', id);
  });

  test('rematches only in games with a post-game league rematch', () => {
    assert.deepEqual(withRematches(), [
      'firered-leafgreen',
      'platinum',
      'heartgold-soulsilver',
      'black-white',
      'black2-white2',
      'omega-ruby-alpha-sapphire',
      'sun-moon',
      'ultra-sun-ultra-moon',
      'lets-go',
      'brilliant-diamond-shining-pearl',
    ]);
    // Battle facilities (Battle Tree, Battle Chateau, Battle Tower) never count as rematches.
    const labels = rematchLabels();
    assert.ok(
      labels.every((l) => !/Battle (Tree|Chateau|Tower)/.test(l)),
      labels.join(', '),
    );
    // BDSP has two rematch stages; B2W2 uses the Easy/Normal Mode rematch, not Challenge Mode.
    const bdsp = game('brilliant-diamond-shining-pearl').trainers[0];
    assert.equal(bdsp.rematches?.length, 2);
    assert.match(game('black2-white2').trainers[0].rematches?.[0].label ?? '', /Easy Mode\/Normal Mode/);
  });
});
