import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BackupError, checkKnownForms, checkKnownIds, parseBackup } from '../src/data/db';
import type { MoveTable, SpeciesDetail } from '../src/data/types';

const backup = (teams: unknown) => JSON.stringify({ app: 'material-dex', version: 3, teams });
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

  test('round-trips god mode, with an illegal move and ability', () => {
    const member = { speciesId: 25, ability: 'Huge Power', moves: [147], godMode: true };
    const [team] = parseBackup(oneMember(member));
    assert.deepEqual(team.members, [{ ...member, formKey: undefined, nature: undefined, item: undefined }]);
    assert.deepEqual(parseBackup(backup([team]))[0].members, team.members);
  });

  test('stores god mode off as no god mode', () => {
    assert.equal('godMode' in parseBackup(oneMember({ speciesId: 25, godMode: false }))[0].members[0], false);
    assert.equal('godMode' in parseBackup(oneMember({ speciesId: 25 }))[0].members[0], false);
  });

  test('rejects a god mode that is not true or false', () => {
    rejects(oneMember({ speciesId: 25, godMode: 'yes' }), /^Team 1 in the file: member 1 has an invalid god mode$/);
    rejects(oneMember({ speciesId: 25, godMode: 1 }), /invalid god mode/);
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
  const ITEMS = { 234: 'Leftovers' };
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
