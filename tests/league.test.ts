import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { nameKey, parseLevel, parseParties, plainText } from '../scripts/league';

// Shaped like Bulbapedia's raw wikitext (Leon's page, trimmed).
const PAGE = `==In the core series games==
===Pokémon===
===={{g|Sword and Shield}}====
=====Capture tutorial (optional)=====
{{Party
| game = SwSh
| pokemon = 1
}}
{{Pokémon
| ndex = 0819
| pokemon = Skwovet
| level = 2
}}
{{Party/end}}
=====Championship Match=====
{{Party
| caption = {{PlayerChoice|0810|Grookey}}
| name = Leon
| game = SwSh
| pokemon = 2
}}
{{Pokémon
| gen = 8
| ndex = 0681
| pokemon = Aegislash
| form = -Shield
| level = 62
| ability = Stance Change
| move1 = King's Shield | move1type = Steel | move1cat = Status
| move2 = Shadow Ball | move2type = Ghost
| move3 = Sacred&nbsp;Sword | move3type = Fighting
| move4 = None
}}
{{Pokémon
| ndex = 0006
| pokemon = Charizard
| level = 65
| held = Life Orb
| max = Gigantamax
| move1 = Fire Blast
}}
{{Party/end}}
`;

describe('parseParties', () => {
  const parties = parseParties(PAGE);

  test('finds every party with the headings it sits under', () => {
    assert.equal(parties.length, 2);
    assert.deepEqual(parties[1].headings, [
      'In the core series games', 'Pokémon', '{{g|Sword and Shield}}', 'Championship Match',
    ]);
    assert.equal(parties[1].game, 'SwSh');
    assert.equal(parties[1].caption, '{{PlayerChoice|0810|Grookey}}');
  });

  test('a new heading replaces deeper ones', () => {
    assert.deepEqual(parties[0].headings.at(-1), 'Capture tutorial (optional)');
  });

  test('reads members, several fields per line, and drops empty move slots', () => {
    const [aegislash, charizard] = parties[1].members;
    assert.equal(aegislash.ndex, 681);
    assert.equal(aegislash.form, '-Shield');
    assert.equal(aegislash.ability, 'Stance Change');
    assert.deepEqual(aegislash.moves, ["King's Shield", 'Shadow Ball', 'Sacred Sword']);
    assert.equal(charizard.held, 'Life Orb');
    assert.equal(charizard.gigantamax, true);
    assert.equal(aegislash.gigantamax, false);
  });
});

test('parseParties throws on a template closed inline instead of merging members', () => {
  const page = '{{Party\n| game = RGB\n}}\n{{Pokémon\n| ndex = 0087\n| move4 = Rest}}\n{{Pokémon\n| ndex = 0091\n}}\n{{Party/end}}';
  assert.throws(() => parseParties(page), /Unclosed template/);
});

describe('parseLevel', () => {
  test('plain and slash-separated levels take the first', () => {
    assert.equal(parseLevel('54'), 54);
    assert.equal(parseLevel('61/69'), 61);
  });

  test('tooltips prefer Normal Mode, or the given label', () => {
    assert.equal(parseLevel('{{tt|68|Easy Mode}}/{{tt|72|Normal Mode}}'), 72);
    assert.equal(parseLevel('{{tt|65|Sun and Moon}}/{{tt|69|Ultra Sun and Ultra Moon}}', /Ultra Sun/), 69);
    assert.equal(parseLevel('{{tt|70|Before}}/{{tt|80|After}}'), 70);
  });

  test('throws when there is no number', () => {
    assert.throws(() => parseLevel('?'));
  });
});

test('plainText turns captions and links into text', () => {
  assert.equal(plainText('{{PlayerChoice|0001|Bulbasaur}}'), 'If you chose Bulbasaur');
  assert.equal(plainText('{{BlueEevee|Jolteon}}'), 'If his Eevee became Jolteon');
  assert.equal(plainText("Before [[Stark Mountain]] in '''[[Platinum|Pt]]'''"), 'Before Stark Mountain in Pt');
});

test('nameKey matches old and new spellings', () => {
  assert.equal(nameKey('DoubleSlap'), nameKey('Double Slap'));
  assert.equal(nameKey('Sand-Attack'), nameKey('Sand Attack'));
  assert.equal(nameKey('Poké Ball'), 'pokeball');
});
