import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BackupError,
  checkKnownFavouriteForms,
  checkKnownForms,
  checkKnownGames,
  checkKnownIds,
  cleanName,
  cleanNickname,
  memberTitle,
  parseBackup,
  parseFavourites,
  parsePokedexes,
} from '../src/data/db';
import type { MoveTable, SpeciesDetail, VersionGroup } from '../src/data/types';

const backup = (teams: unknown) => JSON.stringify({ app: 'material-dex', version: 4, teams });
const oneMember = (member: unknown) => backup([{ name: 'A', members: [member] }]);

/** Asserts parseBackup rejects `json` with a BackupError whose message matches `message`. */
function rejects(json: string, message: RegExp) {
  assert.throws(
    () => parseBackup(json),
    (e: unknown) => e instanceof BackupError && message.test(e.message),
  );
}

describe('parseBackup', () => {
  test('accepts a full backup and keeps only known member fields', () => {
    const [team] = parseBackup(
      backup([
        {
          id: 9,
          name: '  Rain  ',
          members: [
            {
              speciesId: 38,
              formKey: 'alola',
              ability: 'drought',
              nature: 'Modest',
              item: 4,
              moves: [1, 2, 3, 4],
              extra: 'x',
            },
          ],
          updatedAt: 1,
        },
      ]),
    );
    assert.equal(team.name, 'Rain');
    assert.deepEqual(team.members, [
      { speciesId: 38, formKey: 'alola', ability: 'drought', nature: 'Modest', item: 4, moves: [1, 2, 3, 4] },
    ]);
    assert.equal('id' in team, false);
    assert.ok(team.updatedAt > 1);
  });

  test('accepts species-only members, as v1 backups have', () => {
    const teams = parseBackup(
      JSON.stringify({ version: 1, teams: [{ name: 'Old', members: [{ speciesId: 1 }, { speciesId: 1025 }] }] }),
    );
    assert.deepEqual(JSON.parse(JSON.stringify(teams[0].members)), [{ speciesId: 1 }, { speciesId: 1025 }]);
  });

  test('accepts a version 2 backup, whose members have no form', () => {
    const json = JSON.stringify({
      app: 'material-dex',
      version: 2,
      teams: [{ name: 'Rain', members: [{ speciesId: 186, ability: 'drizzle', moves: [1] }] }],
    });
    assert.equal(parseBackup(json)[0].members[0].formKey, undefined);
  });

  test("stores the default form's empty key as no form", () => {
    assert.equal(parseBackup(oneMember({ speciesId: 38, formKey: '' }))[0].members[0].formKey, undefined);
  });

  test('accepts empty teams and an empty list', () => {
    assert.deepEqual(parseBackup(backup([])), []);
    assert.deepEqual(parseBackup(backup([{ name: 'Empty', members: [] }]))[0].members, []);
  });

  test('numbers unnamed teams after the existing ones', () => {
    const teams = parseBackup(backup([{ members: [] }, { name: '   ', members: [] }]), 3);
    assert.deepEqual(
      teams.map((t) => t.name),
      ['Team 4', 'Team 5'],
    );
  });

  test('names teams whose name is not a string after the existing ones', () => {
    const teams = parseBackup(
      backup([
        { name: 42, members: [] },
        { name: null, members: [] },
        { name: ['A'], members: [] },
      ]),
      1,
    );
    assert.deepEqual(
      teams.map((t) => t.name),
      ['Team 2', 'Team 3', 'Team 4'],
    );
  });

  test('accepts an empty move list and exactly 4 moves', () => {
    assert.deepEqual(parseBackup(oneMember({ speciesId: 1, moves: [] }))[0].members[0].moves, []);
    assert.deepEqual(parseBackup(oneMember({ speciesId: 1, moves: [1, 2, 3, 4] }))[0].members[0].moves, [1, 2, 3, 4]);
  });

  test('drops god mode from backups of every version, keeping illegal moves and abilities', () => {
    const member = { speciesId: 25, ability: 'Huge Power', moves: [147] };
    for (const version of [4, 5, 6, 9]) {
      for (const godMode of [true, false, 'yes']) {
        const [team] = parseBackup(
          JSON.stringify({ app: 'material-dex', version, teams: [{ name: 'A', members: [member], godMode }] }),
        );
        assert.equal('godMode' in team, false);
        assert.deepEqual(team.members, [{ ...member, formKey: undefined, nature: undefined, item: undefined }]);
      }
    }
  });

  test('drops the per-member god mode of an old backup', () => {
    const old = JSON.stringify({
      app: 'material-dex',
      version: 3,
      teams: [
        {
          name: 'A',
          members: [{ speciesId: 1 }, { speciesId: 25, moves: [147], godMode: true }, { speciesId: 4, godMode: 1 }],
        },
      ],
    });
    const [team] = parseBackup(old);
    assert.equal('godMode' in team, false);
    assert.equal(team.members.length, 3);
    assert.equal(
      team.members.some((m) => 'godMode' in m),
      false,
    );
  });

  test('drops the team game of a version 5 or 6 backup and keeps the members', () => {
    const member = { speciesId: 25, formKey: 'cosplay', ability: 'Static', nature: 'Timid', item: 234, moves: [9, 85] };
    for (const version of [5, 6]) {
      for (const game of [1, 99, 'red-blue', null]) {
        const [team] = parseBackup(
          JSON.stringify({ app: 'material-dex', version, teams: [{ name: 'A', members: [member], game }] }),
        );
        assert.ok(!('game' in team));
        assert.deepEqual(team.members, [member]);
      }
    }
  });

  test('rejects files that are not backups', () => {
    rejects('not json', /isn't a team backup/);
    rejects('null', /isn't a team backup/);
    rejects('{}', /isn't a team backup/);
    rejects(JSON.stringify({ teams: {} }), /isn't a team backup/);
  });

  test('rejects bad teams', () => {
    rejects(backup([null]), /^Team 1 in the file has no members list$/);
    rejects(backup([{ name: 'A', members: [] }, { name: 'B' }]), /^Team 2 in the file has no members list$/);
    const seven = Array.from({ length: 7 }, () => ({ speciesId: 1 }));
    rejects(backup([{ name: 'A', members: seven }]), /more than 6 members/);
  });

  test('rejects unknown species', () => {
    for (const speciesId of [0, 1026, 1.5, '1', undefined])
      rejects(oneMember({ speciesId }), /member 1 is not a known Pokémon/);
    rejects(oneMember(null), /member 1 is not a Pokémon/);
    rejects(oneMember(25), /member 1 is not a Pokémon/);
  });

  test('rejects a form that is not a short string', () => {
    rejects(oneMember({ speciesId: 38, formKey: 1 }), /member 1 has an invalid form/);
    rejects(oneMember({ speciesId: 38, formKey: 'x'.repeat(41) }), /member 1 has an invalid form/);
  });

  test('rejects bad ability, nature and item', () => {
    rejects(oneMember({ speciesId: 1, ability: 3 }), /invalid ability/);
    rejects(oneMember({ speciesId: 1, ability: 'x'.repeat(41) }), /invalid ability/);
    rejects(oneMember({ speciesId: 1, nature: 'Grumpy' }), /unknown nature/);
    rejects(oneMember({ speciesId: 1, item: 0 }), /invalid item/);
    rejects(oneMember({ speciesId: 1, item: 'leftovers' }), /invalid item/);
  });

  test('rejects bad move lists', () => {
    rejects(oneMember({ speciesId: 1, moves: 'tackle' }), /invalid moves/);
    rejects(oneMember({ speciesId: 1, moves: [1, -2] }), /invalid moves/);
    rejects(oneMember({ speciesId: 1, moves: [1, 2, 3, 4, 5] }), /more than 4 moves/);
    rejects(oneMember({ speciesId: 1, moves: [1, 1] }), /repeated move/);
  });

  test('cuts team names over 20 characters to 20', () => {
    const teams = parseBackup(
      backup([
        { name: 'x'.repeat(21), members: [] },
        { name: ` ${'🐭'.repeat(21)} `, members: [] },
        { name: 'Rain dance and Swift Swim', members: [] },
      ]),
    );
    // 20 code points, though 🐭 takes two UTF-16 units.
    assert.deepEqual(
      teams.map((t) => t.name),
      ['x'.repeat(20), '🐭'.repeat(20), 'Rain dance and Swift'],
    );
  });

  test('round-trips nicknames in a version 9 backup', () => {
    const json = JSON.stringify({
      app: 'material-dex',
      version: 9,
      teams: [
        {
          name: 'A',
          members: [
            { speciesId: 25, nickname: 'Sparky' },
            { speciesId: 6, formKey: 'mega-x', nickname: '🔥 Blaze' },
          ],
        },
      ],
    });
    const [team] = parseBackup(json);
    assert.deepEqual(
      team.members.map((m) => m.nickname),
      ['Sparky', '🔥 Blaze'],
    );
    assert.deepEqual(parseBackup(backup([team]))[0].members, team.members);
  });

  test('imports members of version 1 to 8 backups without a nickname', () => {
    for (let version = 1; version <= 8; version++) {
      const [team] = parseBackup(
        JSON.stringify({ app: 'material-dex', version, teams: [{ name: 'A', members: [{ speciesId: 25 }] }] }),
      );
      assert.equal('nickname' in team.members[0], false);
    }
  });

  test('round-trips shiny in a version 10 backup, a form member included', () => {
    const json = JSON.stringify({
      app: 'material-dex',
      version: 10,
      teams: [
        {
          name: 'A',
          members: [{ speciesId: 25, shiny: true }, { speciesId: 6, formKey: 'mega-x', shiny: true }, { speciesId: 1 }],
        },
      ],
    });
    const [team] = parseBackup(json);
    assert.deepEqual(
      team.members.map((m) => m.shiny),
      [true, true, undefined],
    );
    assert.equal(team.members[1].formKey, 'mega-x');
    assert.deepEqual(parseBackup(backup([team]))[0].members, team.members);
  });

  test('imports members of version 1 to 9 backups as not shiny, and drops a false flag', () => {
    for (let version = 1; version <= 9; version++) {
      const [team] = parseBackup(
        JSON.stringify({ app: 'material-dex', version, teams: [{ name: 'A', members: [{ speciesId: 25 }] }] }),
      );
      assert.equal('shiny' in team.members[0], false);
    }
    assert.equal('shiny' in parseBackup(oneMember({ speciesId: 25, shiny: false }))[0].members[0], false);
  });

  test('rejects a shiny flag that is not a boolean', () => {
    for (const shiny of [1, 0, 'true', null, []])
      rejects(oneMember({ speciesId: 25, shiny }), /^Team 1 in the file: member 1 has an invalid shiny flag$/);
  });

  test('trims nicknames and drops blank ones', () => {
    assert.equal(parseBackup(oneMember({ speciesId: 25, nickname: '  Sparky ' }))[0].members[0].nickname, 'Sparky');
    for (const nickname of ['', '   '])
      assert.equal('nickname' in parseBackup(oneMember({ speciesId: 25, nickname }))[0].members[0], false);
  });

  test('rejects a nickname that is not a string or is over 12 characters', () => {
    for (const nickname of [7, null, ['Sparky'], 'x'.repeat(13)])
      rejects(oneMember({ speciesId: 25, nickname }), /^Team 1 in the file: member 1 has an invalid nickname$/);
    // 12 code points, though 🐭 takes two UTF-16 units.
    assert.equal(
      parseBackup(oneMember({ speciesId: 25, nickname: '⚡'.repeat(6) + '🐭'.repeat(6) }))[0].members[0].nickname
        ?.length,
      18,
    );
    assert.equal(
      parseBackup(oneMember({ speciesId: 25, nickname: ` ${'x'.repeat(12)} ` }))[0].members[0].nickname,
      'x'.repeat(12),
    );
  });

  test('names the team and member that failed', () => {
    rejects(
      backup([
        { name: 'A', members: [{ speciesId: 1 }] },
        { name: 'B', members: [{ speciesId: 1 }, { speciesId: 1, nature: 'Nope' }] },
      ]),
      /^Team 2 in the file: member 2 has an unknown nature$/,
    );
  });
});

describe('checkKnownIds', () => {
  const tackle = {
    name: 'Tackle',
    type: 'normal',
    category: 'physical',
    power: 40,
    accuracy: 100,
    pp: 35,
    priority: 0,
    gen: 1,
  } as const;
  const MOVES: MoveTable = { 33: tackle, 45: { ...tackle, name: 'Growl', category: 'status', power: null } };
  const ITEMS = { 234: { name: 'Leftovers', gen: 2 } };
  const check = (member: unknown) => () => checkKnownIds(parseBackup(oneMember(member)), MOVES, ITEMS);
  const throwsBackupError = (fn: () => void, message: RegExp) =>
    assert.throws(fn, (e: unknown) => e instanceof BackupError && message.test(e.message));
  const fails = (member: unknown, message: RegExp) => throwsBackupError(check(member), message);

  test('accepts known moves and items, and members without them', () => {
    assert.doesNotThrow(check({ speciesId: 1, item: 234, moves: [33, 45] }));
    assert.doesNotThrow(check({ speciesId: 1 }));
    assert.doesNotThrow(check({ speciesId: 1, moves: [] }));
  });

  test('rejects an unknown item', () => {
    fails({ speciesId: 1, item: 999 }, /^Team 1 in the file: member 1 has an unknown item$/);
  });

  test('rejects an unknown move anywhere in the list', () => {
    fails({ speciesId: 1, moves: [33, 45, 999] }, /^Team 1 in the file: member 1 has an unknown move$/);
  });

  test('names the team and member that failed', () => {
    const teams = parseBackup(backup([{ members: [] }, { members: [{ speciesId: 1 }, { speciesId: 2, moves: [7] }] }]));
    throwsBackupError(() => checkKnownIds(teams, MOVES, ITEMS), /^Team 2 in the file: member 2 has an unknown move$/);
  });
});

describe('checkKnownForms', () => {
  const ninetales = { id: 38, forms: [{ key: '' }, { key: 'alola' }] } as SpeciesDetail;
  const species = new Map([
    [38, ninetales],
    [6, { id: 6 } as SpeciesDetail],
  ]);
  const check = (member: unknown) => () => checkKnownForms(parseBackup(oneMember(member)), species);

  test('accepts a form the species has, and members without a form', () => {
    assert.doesNotThrow(check({ speciesId: 38, formKey: 'alola' }));
    assert.doesNotThrow(check({ speciesId: 6 }));
  });

  test('rejects a form the species does not have, or any form on a species without forms', () => {
    for (const member of [
      { speciesId: 38, formKey: 'galar' },
      { speciesId: 6, formKey: 'mega-x' },
    ]) {
      assert.throws(
        check(member),
        (e: unknown) => e instanceof BackupError && e.message === 'Team 1 in the file: member 1 has an unknown form',
      );
    }
  });
});

describe('parsePokedexes', () => {
  const v6 = (pokedexes: unknown) => JSON.stringify({ app: 'material-dex', version: 6, teams: [], pokedexes });
  const rejectsDex = (json: string, message: RegExp) =>
    assert.throws(
      () => parsePokedexes(json),
      (e: unknown) => e instanceof BackupError && message.test(e.message),
    );

  test('round-trips a Pokédex with every state', () => {
    const [dex] = parsePokedexes(
      v6([{ id: 3, name: ' Kanto ', game: 1, states: { 1: 1, 25: 2, 151: 3 }, updatedAt: 1 }]),
    );
    assert.equal(dex.name, 'Kanto');
    assert.equal(dex.game, 1);
    assert.deepEqual(dex.states, { 1: 1, 25: 2, 151: 3 });
    assert.equal('id' in dex, false);
    assert.ok(dex.updatedAt > 1);
  });

  test('cuts Pokédex names over 20 characters to 20', () => {
    const dexes = parsePokedexes(
      v6([
        { name: 'Kanto living dex with shinies', states: {} },
        { name: '⭐'.repeat(25), states: {} },
      ]),
    );
    assert.deepEqual(
      dexes.map((d) => d.name),
      ['Kanto living dex wit', '⭐'.repeat(20)],
    );
  });

  test('older backups have no Pokédexes', () => {
    for (const version of [1, 2, 3, 4, 5]) {
      assert.deepEqual(
        parsePokedexes(JSON.stringify({ app: 'material-dex', version, teams: [{ name: 'A', members: [] }] })),
        [],
      );
    }
  });

  test('a Pokédex without a game is any game, and unnamed ones are numbered after the existing ones', () => {
    const dexes = parsePokedexes(v6([{ states: {} }, { name: '  ', states: {} }]), 2);
    assert.deepEqual(
      dexes.map((d) => d.name),
      ['Pokédex 3', 'Pokédex 4'],
    );
    assert.ok(!('game' in dexes[0]));
  });

  test('rejects a list that is not a list, and Pokédexes without states', () => {
    rejectsDex(v6({}), /not a list/);
    for (const states of [undefined, null, [1, 2], 'x'])
      rejectsDex(v6([{ name: 'A', states }]), /Pokédex 1 in the file has no states/);
  });

  test('rejects an invalid state or species', () => {
    for (const state of [0, 4, '2', 1.5, null]) rejectsDex(v6([{ states: { 25: state } }]), /invalid state/);
    for (const id of ['0', '025', '1026', '2.5', 'pikachu'])
      rejectsDex(v6([{ states: { [id]: 1 } }]), /unknown Pokémon/);
  });

  test('rejects a game that is not a positive whole number', () => {
    for (const game of [0, -1, 1.5, '1', null])
      rejectsDex(v6([{ states: {}, game }]), /Pokédex 1 in the file has an invalid game/);
  });

  const v7 = (pokedexes: unknown) => JSON.stringify({ app: 'material-dex', version: 7, teams: [], pokedexes });

  test('round-trips a custom Pokédex in national order', () => {
    const [dex] = parsePokedexes(v7([{ name: 'Faves', species: [143, 25, 133], states: { 25: 2 } }]));
    assert.deepEqual(dex.species, [25, 133, 143]);
    assert.deepEqual(dex.states, { 25: 2 });
    assert.ok(!('game' in dex));
  });

  test('version 6 Pokédexes import without a list', () => {
    const [dex] = parsePokedexes(v6([{ name: 'Kanto', game: 1, states: {} }]));
    assert.ok(!('species' in dex));
  });

  test('rejects a bad custom Pokémon list', () => {
    for (const species of [[], 'x', null, { 0: 25 }])
      rejectsDex(v7([{ states: {}, species }]), /Pokédex 1 in the file has an empty or invalid Pokémon list/);
    for (const id of [0, 1026, 2.5, '25', null])
      rejectsDex(v7([{ states: {}, species: [25, id] }]), /lists an unknown Pokémon/);
    rejectsDex(v7([{ states: {}, species: [25, 133, 25] }]), /lists a Pokémon twice/);
    rejectsDex(v7([{ states: {}, game: 1, species: [25] }]), /both a game and a Pokémon list/);
  });

  test('checkKnownGames names the Pokédex with an unknown game', () => {
    const versions = [{ id: 1, label: 'Red / Blue', gen: 1 }] as VersionGroup[];
    assert.throws(
      () => checkKnownGames([{ game: 1 }, {}, { game: 99 }], versions),
      /Pokédex 3 in the file has an unknown game/,
    );
  });
});

describe('parseFavourites', () => {
  const v8 = (favourites: unknown) =>
    JSON.stringify({ app: 'material-dex', version: 8, teams: [], pokedexes: [], favourites });
  const rejectsFav = (json: string, message: RegExp) =>
    assert.throws(
      () => parseFavourites(json),
      (e: unknown) => e instanceof BackupError && message.test(e.message),
    );

  test('round-trips species and forms, storing the default form as an empty key', () => {
    assert.deepEqual(parseFavourites(v8([{ speciesId: 1 }, { speciesId: 6, formKey: 'mega-x' }])), [
      { speciesId: 1, formKey: '' },
      { speciesId: 6, formKey: 'mega-x' },
    ]);
  });

  test('older backups have no favourites', () => {
    for (const version of [1, 4, 6, 7]) {
      assert.deepEqual(parseFavourites(JSON.stringify({ app: 'material-dex', version, teams: [], pokedexes: [] })), []);
    }
  });

  test('rejects a list that is not a list', () => {
    for (const favourites of [{}, 'x', null]) rejectsFav(v8(favourites), /favourites in the file are not a list/);
  });

  test('rejects unknown species, invalid forms and repeats', () => {
    for (const speciesId of [0, 1026, 2.5, '25', null])
      rejectsFav(v8([{ speciesId: 1 }, { speciesId }]), /Favourite 2 in the file is not a known Pokémon/);
    rejectsFav(v8([null]), /Favourite 1 in the file is not a known Pokémon/);
    for (const formKey of [3, null, 'x'.repeat(41)])
      rejectsFav(v8([{ speciesId: 6, formKey }]), /Favourite 1 in the file has an invalid form/);
    rejectsFav(
      v8([
        { speciesId: 6, formKey: 'mega-x' },
        { speciesId: 6, formKey: 'mega-x' },
      ]),
      /Favourite 2 in the file is listed twice/,
    );
    rejectsFav(v8([{ speciesId: 25 }, { speciesId: 25, formKey: '' }]), /Favourite 2 in the file is listed twice/);
  });

  test('checkKnownFavouriteForms rejects a form the species does not have', () => {
    const species = new Map([[38, { id: 38, forms: [{ key: '' }, { key: 'alola' }] } as SpeciesDetail]]);
    assert.doesNotThrow(() =>
      checkKnownFavouriteForms(parseFavourites(v8([{ speciesId: 38, formKey: 'alola' }, { speciesId: 6 }])), species),
    );
    assert.throws(
      () =>
        checkKnownFavouriteForms(
          parseFavourites(v8([{ speciesId: 38 }, { speciesId: 38, formKey: 'galar' }])),
          species,
        ),
      (e: unknown) => e instanceof BackupError && e.message === 'Favourite 2 in the file has an unknown form',
    );
  });
});

describe('nicknames', () => {
  test('cleanNickname trims, cuts to 12 characters and clears a blank one', () => {
    assert.equal(cleanNickname('  Sparky  '), 'Sparky');
    assert.equal(cleanNickname('Thunderbolt Mouse'), 'Thunderbolt');
    assert.equal(cleanNickname('🐭'.repeat(13)), '🐭'.repeat(12));
    assert.equal(cleanNickname('   '), undefined);
  });

  test('memberTitle puts the nickname after the species or form name', () => {
    assert.equal(memberTitle('Pikachu', 'Sparky'), 'Pikachu · Sparky');
    assert.equal(memberTitle('Mega Charizard X', 'Blaze'), 'Mega Charizard X · Blaze');
    assert.equal(memberTitle('Pikachu'), 'Pikachu');
  });
});

describe('cleanName', () => {
  test('trims, cuts to 20 code points and leaves no trailing space', () => {
    assert.equal(cleanName('  Rain  '), 'Rain');
    assert.equal(cleanName('x'.repeat(20)), 'x'.repeat(20));
    assert.equal(cleanName('🐭'.repeat(21)), '🐭'.repeat(20));
    assert.equal(cleanName('Nineteen characters and more'), 'Nineteen characters');
    assert.equal(cleanName('   '), '');
  });
});
