import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { encountersIn, encountersInGroup } from '../src/data/locations';
import type { Game, Locations } from '../src/data/types';

const DATA: Locations = {
  strings: ['', 'Route 29', 'Grass or cave', 'In the morning, During the day', 'Route 1 (East)', 'Alolan Form'],
  games: {
    15: [[1, 2, 2, 4, 30, 1, 3, 0]],
    27: [[4, 2, 3, 3, 30, 0, 0, 5]],
    31: [[1, 2, 3, 5, 0, 0, 0, 0]],
  },
};

describe('encountersIn', () => {
  test('looks up the strings and formats levels and chance', () => {
    assert.deepEqual(encountersIn(DATA, 15), [
      {
        area: 'Route 29',
        method: 'Grass or cave',
        levels: 'Lv. 2–4',
        chance: 'Up to 30%',
        note: 'In the morning, During the day',
        form: '',
      },
    ]);
  });

  test('shows a single level and the form name', () => {
    assert.deepEqual(encountersIn(DATA, 27), [
      {
        area: 'Route 1 (East)',
        method: 'Grass or cave',
        levels: 'Lv. 3',
        chance: '30%',
        note: '',
        form: 'Alolan Form',
      },
    ]);
  });

  test('leaves the chance empty when it is unknown', () => {
    assert.equal(encountersIn(DATA, 31)[0].chance, '');
  });

  test('a game the species is not in has no encounters', () => {
    assert.deepEqual(encountersIn(DATA, 1), []);
  });
});

// Ruby and Sapphire share Route 101 and Route 104; Route 102's chance differs, Route 103 is Ruby only and Route 103's
// Surfing row (method 6) Sapphire only, Petalburg Woods Ruby only.
const HOENN: Locations = {
  strings: ['', 'Route 101', 'Grass or cave', 'Route 102', 'Route 103', 'Route 104', 'Surfing', 'Petalburg Woods'],
  games: {
    7: [
      [1, 2, 2, 3, 20, 0, 0, 0],
      [3, 2, 3, 4, 20, 0, 0, 0],
      [4, 2, 5, 5, 10, 0, 0, 0],
      [5, 2, 4, 5, 10, 0, 0, 0],
      [7, 2, 5, 6, 5, 0, 0, 0],
    ],
    8: [
      [1, 2, 2, 3, 20, 0, 0, 0],
      [3, 2, 3, 4, 10, 0, 0, 0],
      [4, 6, 5, 5, 10, 0, 0, 0],
      [5, 2, 4, 5, 10, 0, 0, 0],
    ],
  },
};
const RUBY: Game = { id: 7, label: 'Ruby', gen: 3, group: 5 };
const SAPPHIRE: Game = { id: 8, label: 'Sapphire', gen: 3, group: 5 };

describe('encountersInGroup', () => {
  const rows = encountersInGroup(HOENN, [RUBY, SAPPHIRE]);

  test('a row in every game of the group names no version', () => {
    assert.deepEqual(rows[0], {
      area: 'Route 101',
      method: 'Grass or cave',
      levels: 'Lv. 2–3',
      chance: '20%',
      note: '',
      form: '',
      versions: [],
    });
  });

  test('a version-exclusive row is labelled with its version', () => {
    assert.deepEqual(
      rows.filter((r) => r.area === 'Route 103').map((r) => [r.method, ...r.versions]),
      [
        ['Grass or cave', 'Ruby'],
        ['Surfing', 'Sapphire'],
      ],
    );
  });

  test('a row that differs between versions shows once per version, labelled, in area order', () => {
    assert.deepEqual(
      rows.map((r) => [r.area, r.chance, r.versions.join(', ')]),
      [
        ['Route 101', '20%', ''],
        ['Route 102', '20%', 'Ruby'],
        ['Route 102', '10%', 'Sapphire'],
        ['Route 103', '10%', 'Ruby'],
        ['Route 103', '10%', 'Sapphire'],
        ['Route 104', '10%', ''],
        ['Petalburg Woods', '5%', 'Ruby'],
      ],
    );
  });

  test('a game the species is missing from labels every row with the other', () => {
    const sapphireOnly: Locations = { strings: HOENN.strings, games: { 8: HOENN.games[8] } };
    assert.ok(encountersInGroup(sapphireOnly, [RUBY, SAPPHIRE]).every((r) => r.versions.join() === 'Sapphire'));
  });

  test('exclusive areas between shared ones stay between them', () => {
    // Ruby: 101, 103, 104; Sapphire: 101, Petalburg Woods, 104.
    const data: Locations = {
      strings: HOENN.strings,
      games: {
        7: [HOENN.games[7][0], HOENN.games[7][2], HOENN.games[7][3]],
        8: [HOENN.games[8][0], [7, 2, 5, 6, 5, 0, 0, 0], HOENN.games[8][3]],
      },
    };
    assert.deepEqual(
      encountersInGroup(data, [RUBY, SAPPHIRE]).map((r) => r.area),
      ['Route 101', 'Route 103', 'Petalburg Woods', 'Route 104'],
    );
  });

  test('a group of one game names no version', () => {
    assert.ok(encountersInGroup(HOENN, [RUBY]).every((r) => r.versions.length === 0));
  });
});
