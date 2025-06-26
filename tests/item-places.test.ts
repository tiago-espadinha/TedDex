import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cellLines, gameCodes, gameOfGroup, parseAcquisition } from '../scripts/itemPlaces';

// Shaped like Bulbapedia's raw wikitext (Leftovers, trimmed).
const PAGE = `==In the core series games==
===Description===
{{movedescentry|{{gameabbrev4|DPPt}}|An item to be held by a Pokémon.}}
===Acquisition===
{{ItemAvailability/head|items}}
|-
| {{gameabbrev3|RSE}}
| [[S.S. Tidal]]
| {{gdis|Battle Tower|III}} (35+ win streak){{sup/3|RS}}<br>{{a|Pickup}} ([[Level|Lv.]] 81-100{{sup/3|E}})
|-
| {{gameabbrev7|SMUSUM}}
|
| Held by {{wild|Munchlax}} and {{wild|Snorlax}} (100% chance each)
|-
| {{gameabbrev9|SV}}{{gameabbrev9|ID}}
|
| [[Item Printer]]
|-
| {{Gameabbrev9|ZA}}
| [[Quasartico Inc.]]
|}
|}

====Distribution====
| {{gameabbrev9|SV}}
==In the spin-off games==
===Acquisition===
{{ItemAvailability/head|items}}
|-
| {{gameabbrevss|Ranch}}
| Nowhere
|}`;

describe('parseAcquisition', () => {
  test('reads only the core-series table: games, one-time and repeatable ways', () => {
    const rows = parseAcquisition(PAGE)!;
    assert.deepEqual(
      rows.map((r) => [r.games.map((g) => g.label), r.once, r.repeat]),
      [
        [
          ['Ruby / Sapphire / Emerald'],
          ['S.S. Tidal'],
          ['Battle Tower (35+ win streak) (Ruby / Sapphire)', 'Pickup (Lv. 81-100 (Emerald))'],
        ],
        [['Sun / Moon', 'Ultra Sun / Ultra Moon'], [], ['Held by wild Munchlax and wild Snorlax (100% chance each)']],
        [['Scarlet / Violet', 'The Indigo Disk'], [], ['Item Printer']],
        [['Legends: Z-A'], ['Quasartico Inc.'], []],
      ],
    );
  });

  test('key item tables have one method column', () => {
    const rows = parseAcquisition(`===Acquisition===
{{ItemAvailability/keyhead|items}}
|-
| {{gameabbrev6|X}}
| {{ci|Lumiose}} (if {{p|Charmander}} is chosen)
|}`)!;
    assert.deepEqual(rows[0].once, ['Lumiose City (if Charmander is chosen)']);
    assert.deepEqual(rows[0].repeat, []);
  });

  test('a section of prose becomes one row without a game; no section gives null', () => {
    assert.deepEqual(parseAcquisition('===Acquisition===\nIt cannot be obtained in any game.\n\n===NPC usage===\nx'), [
      { games: [], once: [], repeat: [], note: ['It cannot be obtained in any game.'] },
    ]);
    assert.equal(parseAcquisition("'''Pearl''' has several referrals."), null);
  });

  test('a lone pipe before the text is dropped like MediaWiki attributes', () => {
    const rows = parseAcquisition(`===Acquisition===
{{ItemAvailability/head|items}}
|-
| rowspan=2 | {{gameabbrev6|ORAS}}
| {{rt|123|Hoenn}}
| | [[Sootopolis City]]
|}`)!;
    assert.deepEqual([rows[0].once, rows[0].repeat], [['Route 123'], ['Sootopolis City']]);
  });

  test('fails on game codes and templates it does not know, and on rows with too many cells', () => {
    const table = (row: string) => `===Acquisition===\n{{ItemAvailability/head|items}}\n|-\n${row}\n|}`;
    assert.throws(() => parseAcquisition(table('| {{gameabbrev4|QQ}}\n| x\n| y')), /Unknown game code "QQ"/);
    assert.throws(
      () => parseAcquisition(table('| {{gameabbrev4|DP}}\n| {{mystery|x}}\n| y')),
      /Unknown template \{\{mystery\}\}/,
    );
    assert.throws(() => parseAcquisition(table('| {{gameabbrev4|DP}}\n| a\n| b\n| c')), /Row with 4 cells/);
  });
});

describe('cellLines', () => {
  test('links, location templates and notes read as text', () => {
    assert.deepEqual(
      cellLines(
        '[[Route]]s {{rtn|12|Kanto}} and {{rtn|16|Kanto}}<br/>{{DL|Pokémon Battle Revolution|Shop}} (7200 [[Poké Coupon]]s)',
      ),
      ['Routes 12 and 16', 'Shop (7200 Poké Coupons)'],
    );
    assert.deepEqual(cellLines('{{b|Oran}} at [[Village Bridge]]{{sup/s|Su}}'), [
      'Oran Berry at Village Bridge (Summer)',
    ]);
    assert.deepEqual(cellLines('<sup>1</sup>/<sub>16</sub> chance<ref>[https://example.org source]</ref>'), [
      '1/16 chance',
    ]);
  });

  test('leftover markup fails the build', () => {
    assert.throws(() => cellLines('[[Broken link'), /Unreadable markup/);
  });
});

describe('game codes', () => {
  test('combined codes split into games, longest code first', () => {
    assert.deepEqual(
      gameCodes('7', 'SMUSUMPE').map((g) => g.label),
      ['Sun / Moon', 'Ultra Sun / Ultra Moon', "Let's Go, Pikachu! / Let's Go, Eevee!"],
    );
    assert.deepEqual(
      gameCodes('ss', 'ColoXD').map((g) => g.label),
      ['Colosseum', 'XD: Gale of Darkness'],
    );
  });

  test('later games sort after earlier ones; a version group finds its game', () => {
    const [rse] = gameCodes('3', 'RSE');
    const [xd] = gameCodes('ss', 'XD');
    const [dppt] = gameCodes('4', 'DPPt');
    assert.ok(rse.order < xd.order && xd.order < dppt.order);
    assert.equal(gameOfGroup(13)?.label, 'XD: Gale of Darkness');
    assert.equal(gameOfGroup(17)?.label, 'Sun / Moon');
  });
});
