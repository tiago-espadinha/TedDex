import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { teamMatches } from '../src/data/teamSearch';

describe('teamMatches', () => {
  test('matches a member species, any case', () => {
    assert.ok(teamMatches('Rain team', ['Pelipper', 'Pikachu'], 'PIKA'));
    assert.ok(!teamMatches('Rain team', ['Pelipper', 'Raichu'], 'pika'));
  });

  test('matches a form name', () => {
    assert.ok(teamMatches('Sun', ['Mega Charizard X'], 'mega char'));
    assert.ok(teamMatches('Sun', ['Alolan Raichu'], 'alolan'));
  });

  test('matches part of the team name, ignoring accents and punctuation', () => {
    assert.ok(teamMatches('Trick Room', [], 'trick ro'));
    assert.ok(teamMatches('Poké Party', ['Eevee'], 'poke'));
  });

  test('an empty query matches every team', () => {
    assert.ok(teamMatches('Empty', [], ''));
    assert.ok(teamMatches('Empty', [], '   '));
  });
});
