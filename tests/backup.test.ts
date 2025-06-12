import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BackupError,
  checkKnownFavouriteForms,
  checkKnownForms,
  checkKnownGames,
  checkKnownIds,
  parseBackup,
  parseFavourites,
  parsePokedexes,
  teamGodMode,
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
          members: [{ speciesId: 38, formKey: 'alola', ability: 'drought', nature: 'Modest', item: 4, moves: [1, 2, 3, 4], extra: 'x' }],
          updatedAt: 1,
        },
      ]),
    );
    assert.equal(team.name, 'Rain');
    assert.deepEqual(team.members, [{ speciesId: 38, formKey: 'alola', ability: 'drought', nature: 'Modest', item: 4, moves: [1, 2, 3, 4] }]);
    assert.equal('id' in team, false);
    assert.ok(team.updatedAt > 1);
  });

  test('accepts species-only members, as v1 backups have', () => {
    const teams = parseBackup(JSON.stringify({ version: 1, teams: [{ name: 'Old', members: [{ speciesId: 1 }, { speciesId: 1025 }] }] }));
    assert.deepEqual(JSON.parse(JSON.stringify(teams[0].members)), [{ speciesId: 1 }, { speciesId: 1025 }]);
  });

  test('accepts a version 2 backup, whose members have no form', () => {
    const json = JSON.stringify({ app: 'material-dex', version: 2, teams: [{ name: 'Rain', members: [{ speciesId: 186, ability: 'drizzle', moves: [1] }] }] });
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
    assert.deepEqual(teams.map((t) => t.name), ['Team 4', 'Team 5']);
  });

  test('names teams whose name is not a string after the existing ones', () => {
    const teams = parseBackup(backup([{ name: 42, members: [] }, { name: null, members: [] }, { name: ['A'], members: [] }]), 1);
    assert.deepEqual(teams.map((t) => t.name), ['Team 2', 'Team 3', 'Team 4']);
  });

  test('accepts an empty move list and exactly 4 moves', () => {
    assert.deepEqual(parseBackup(oneMember({ speciesId: 1, moves: [] }))[0].members[0].moves, []);
    assert.deepEqual(parseBackup(oneMember({ speciesId: 1, moves: [1, 2, 3, 4] }))[0].members[0].moves, [1, 2, 3, 4]);
  });

  test('round-trips team god mode, with an illegal move and ability', () => {
    const member = { speciesId: 25, ability: 'Huge Power', moves: [147] };
    const [team] = parseBackup(backup([{ name: 'A', members: [member], godMode: true }]));
    assert.equal(team.godMode, true);
    assert.deepEqual(team.members, [{ ...member, formKey: undefined, nature: undefined, item: undefined }]);
    const again = parseBackup(backup([team]))[0];
    assert.equal(again.godMode, true);
    assert.deepEqual(again.members, team.members);
  });

  test('stores god mode off as no god mode', () => {
    assert.equal('godMode' in parseBackup(backup([{ name: 'A', members: [], godMode: false }]))[0], false);
    assert.equal('godMode' in parseBackup(oneMember({ speciesId: 25 }))[0], false);
    assert.equal('godMode' in parseBackup(oneMember({ speciesId: 25, godMode: false }))[0], false);
  });

  test('turns a team on when any member of an old backup had god mode, and drops the member flags', () => {
    const old = JSON.stringify({
      app: 'material-dex',
      version: 3,
      teams: [
        { name: 'A', members: [{ speciesId: 1 }, { speciesId: 25, moves: [147], godMode: true }] },
        { name: 'B', members: [{ speciesId: 4, godMode: false }] },
      ],
    });
    const [a, b] = parseBackup(old);
    assert.equal(a.godMode, true);
    assert.equal(a.members.some((m) => 'godMode' in m), false);
    assert.equal('godMode' in b, false);
    assert.equal(b.members.some((m) => 'godMode' in m), false);
  });

  test('rejects a god mode that is not true or false', () => {
    rejects(backup([{ name: 'A', members: [], godMode: 'yes' }]), /^Team 1 in the file has an invalid god mode$/);
    rejects(oneMember({ speciesId: 25, godMode: 'yes' }), /^Team 1 in the file: member 1 has an invalid god mode$/);
    rejects(oneMember({ speciesId: 25, godMode: 1 }), /invalid god mode/);
  });

  test('drops the team game of a version 5 or 6 backup and keeps the members', () => {
    const member = { speciesId: 25, formKey: 'cosplay', ability: 'Static', nature: 'Timid', item: 234, moves: [9, 85] };
    for (const version of [5, 6]) {
      for (const game of [1, 99, 'red-blue', null]) {
        const [team] = parseBackup(JSON.stringify({ app: 'material-dex', version, teams: [{ name: 'A', members: [member], game }] }));
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
    for (const speciesId of [0, 1026, 1.5, '1', undefined]) rejects(oneMember({ speciesId }), /member 1 is not a known Pokémon/);
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
  const tackle = { name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35, priority: 0, gen: 1 } as const;
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
  const species = new Map([[38, ninetales], [6, { id: 6 } as SpeciesDetail]]);
  const check = (member: unknown) => () => checkKnownForms(parseBackup(oneMember(member)), species);

  test('accepts a form the species has, and members without a form', () => {
    assert.doesNotThrow(check({ speciesId: 38, formKey: 'alola' }));
    assert.doesNotThrow(check({ speciesId: 6 }));
  });

  test('rejects a form the species does not have, or any form on a species without forms', () => {
    for (const member of [{ speciesId: 38, formKey: 'galar' }, { speciesId: 6, formKey: 'mega-x' }]) {
      assert.throws(check(member), (e: unknown) => e instanceof BackupError && e.message === 'Team 1 in the file: member 1 has an unknown form');
    }
  });
});

describe('teamGodMode', () => {
  test('reads the team flag', () => {
    assert.equal(teamGodMode({ godMode: true, members: [] }), true);
    assert.equal(teamGodMode({ members: [] }), false);
  });

  test('is on when any member has the old per-member flag', () => {
    assert.equal(teamGodMode({ members: [{ speciesId: 1 }, { speciesId: 2, godMode: true }] }), true);
    assert.equal(teamGodMode({ members: [{ speciesId: 1, godMode: false }] }), false);
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
    const [dex] = parsePokedexes(v6([{ id: 3, name: ' Kanto ', game: 1, states: { 1: 1, 25: 2, 151: 3 }, updatedAt: 1 }]));
    assert.equal(dex.name, 'Kanto');
    assert.equal(dex.game, 1);
    assert.deepEqual(dex.states, { 1: 1, 25: 2, 151: 3 });
    assert.equal('id' in dex, false);
    assert.ok(dex.updatedAt > 1);
  });

  test('older backups have no Pokédexes', () => {
    for (const version of [1, 2, 3, 4, 5]) {
      assert.deepEqual(parsePokedexes(JSON.stringify({ app: 'material-dex', version, teams: [{ name: 'A', members: [] }] })), []);
    }
  });

  test('a Pokédex without a game is any game, and unnamed ones are numbered after the existing ones', () => {
    const dexes = parsePokedexes(v6([{ states: {} }, { name: '  ', states: {} }]), 2);
    assert.deepEqual(dexes.map((d) => d.name), ['Pokédex 3', 'Pokédex 4']);
    assert.ok(!('game' in dexes[0]));
  });

  test('rejects a list that is not a list, and Pokédexes without states', () => {
    rejectsDex(v6({}), /not a list/);
    for (const states of [undefined, null, [1, 2], 'x']) rejectsDex(v6([{ name: 'A', states }]), /Pokédex 1 in the file has no states/);
  });

  test('rejects an invalid state or species', () => {
    for (const state of [0, 4, '2', 1.5, null]) rejectsDex(v6([{ states: { 25: state } }]), /invalid state/);
    for (const id of ['0', '025', '1026', '2.5', 'pikachu']) rejectsDex(v6([{ states: { [id]: 1 } }]), /unknown Pokémon/);
  });

  test('rejects a game that is not a positive whole number', () => {
    for (const game of [0, -1, 1.5, '1', null]) rejectsDex(v6([{ states: {}, game }]), /Pokédex 1 in the file has an invalid game/);
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
    for (const species of [[], 'x', null, { 0: 25 }]) rejectsDex(v7([{ states: {}, species }]), /Pokédex 1 in the file has an empty or invalid Pokémon list/);
    for (const id of [0, 1026, 2.5, '25', null]) rejectsDex(v7([{ states: {}, species: [25, id] }]), /lists an unknown Pokémon/);
    rejectsDex(v7([{ states: {}, species: [25, 133, 25] }]), /lists a Pokémon twice/);
    rejectsDex(v7([{ states: {}, game: 1, species: [25] }]), /both a game and a Pokémon list/);
  });

  test('checkKnownGames names the Pokédex with an unknown game', () => {
    const versions = [{ id: 1, label: 'Red / Blue', gen: 1 }] as VersionGroup[];
    assert.throws(() => checkKnownGames([{ game: 1 }, {}, { game: 99 }], versions), /Pokédex 3 in the file has an unknown game/);
  });
});

describe('parseFavourites', () => {
  const v8 = (favourites: unknown) => JSON.stringify({ app: 'material-dex', version: 8, teams: [], pokedexes: [], favourites });
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
    for (const speciesId of [0, 1026, 2.5, '25', null]) rejectsFav(v8([{ speciesId: 1 }, { speciesId }]), /Favourite 2 in the file is not a known Pokémon/);
    rejectsFav(v8([null]), /Favourite 1 in the file is not a known Pokémon/);
    for (const formKey of [3, null, 'x'.repeat(41)]) rejectsFav(v8([{ speciesId: 6, formKey }]), /Favourite 1 in the file has an invalid form/);
    rejectsFav(v8([{ speciesId: 6, formKey: 'mega-x' }, { speciesId: 6, formKey: 'mega-x' }]), /Favourite 2 in the file is listed twice/);
    rejectsFav(v8([{ speciesId: 25 }, { speciesId: 25, formKey: '' }]), /Favourite 2 in the file is listed twice/);
  });

  test('checkKnownFavouriteForms rejects a form the species does not have', () => {
    const species = new Map([[38, { id: 38, forms: [{ key: '' }, { key: 'alola' }] } as SpeciesDetail]]);
    assert.doesNotThrow(() => checkKnownFavouriteForms(parseFavourites(v8([{ speciesId: 38, formKey: 'alola' }, { speciesId: 6 }])), species));
    assert.throws(
      () => checkKnownFavouriteForms(parseFavourites(v8([{ speciesId: 38 }, { speciesId: 38, formKey: 'galar' }])), species),
      (e: unknown) => e instanceof BackupError && e.message === 'Favourite 2 in the file has an unknown form',
    );
  });
});
