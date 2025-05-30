import Dexie, { type EntityTable } from 'dexie';
import { loadItems, loadMoves, loadSpecies } from './api';
import { NATURES } from './natures';
import type { ItemTable, MoveTable, SpeciesDetail } from './types';

/**
 * A team slot. `formKey` is a key from the species' `forms` (absent for the default form), `nature`
 * a name from NATURES, `item` an items.json id, `moves` moves.json ids.
 */
export interface TeamMember {
  speciesId: number;
  formKey?: string;
  ability?: string;
  nature?: string;
  item?: number;
  moves?: number[];
}

export interface Team {
  id: number;
  name: string;
  members: TeamMember[];
  updatedAt: number;
}

export const TEAM_SIZE = 6;
export const MOVE_SLOTS = 4;
/** Highest national dex number in public/data (default forms only). */
const LAST_SPECIES = 1025;

class DexDB extends Dexie {
  teams!: EntityTable<Team, 'id'>;
  constructor() {
    super('material-dex');
    this.version(1).stores({ teams: '++id, updatedAt' });
    // v2: item becomes an items.json id and moves become move ids. v1 only ever wrote speciesId,
    // so the upgrade keeps that and drops anything else that doesn't fit the new shape. A v1 import
    // only checked for a members array, so members without a known species are dropped.
    this.version(2)
      .stores({ teams: '++id, updatedAt' })
      .upgrade((tx) =>
        tx
          .table('teams')
          .toCollection()
          .modify((team: Team) => {
            const members: unknown[] = Array.isArray(team.members) ? team.members : [];
            team.members = members.flatMap((m) => {
              if (!memberProblem(m)) return [m as TeamMember];
              const speciesId = (m as Partial<TeamMember> | null)?.speciesId;
              return isSpecies(speciesId) ? [{ speciesId }] : [];
            });
          }),
      );
    // v3: members may have a formKey. Every v2 member is a valid v3 member, so nothing to upgrade.
    this.version(3).stores({ teams: '++id, updatedAt' });
  }
}

export const db = new DexDB();

// Ask iOS/Android not to evict our storage (teams live only on this device).
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

export async function createTeam(name?: string): Promise<number> {
  const count = await db.teams.count();
  return db.teams.add({ name: name ?? `Team ${count + 1}`, members: [], updatedAt: Date.now() });
}

/** Renames a team; a blank name leaves it unchanged. */
export async function renameTeam(teamId: number, name: string) {
  const trimmed = name.trim();
  if (trimmed) await db.teams.update(teamId, { name: trimmed, updatedAt: Date.now() });
}

/** Adds a species, in form `formKey` ('' or absent for the default), to a team. Returns false when the team is full. */
export async function addToTeam(teamId: number, speciesId: number, formKey?: string): Promise<boolean> {
  return db.transaction('rw', db.teams, async () => {
    const team = await db.teams.get(teamId);
    if (!team || team.members.length >= TEAM_SIZE) return false;
    await db.teams.update(teamId, { members: [...team.members, formKey ? { speciesId, formKey } : { speciesId }], updatedAt: Date.now() });
    return true;
  });
}

/** Applies `change` to the stored member, so quick successive edits don't overwrite each other. */
export async function updateMember(teamId: number, index: number, change: (m: TeamMember) => TeamMember) {
  return db.transaction('rw', db.teams, async () => {
    const team = await db.teams.get(teamId);
    if (!team || !team.members[index]) return;
    const members = team.members.map((m, i) => (i === index ? change(m) : m));
    await db.teams.update(teamId, { members, updatedAt: Date.now() });
  });
}

export async function removeFromTeam(teamId: number, index: number) {
  const team = await db.teams.get(teamId);
  if (!team) return;
  const members = team.members.filter((_, i) => i !== index);
  await db.teams.update(teamId, { members, updatedAt: Date.now() });
}

/** The most recently edited team, created if none exists. */
export async function currentTeamId(): Promise<number> {
  const latest = await db.teams.orderBy('updatedAt').last();
  return latest ? latest.id : createTeam();
}

// ---- backup (export/import as JSON, since iOS can evict web storage) ----
export async function exportTeams(): Promise<string> {
  const teams = await db.teams.toArray();
  return JSON.stringify({ app: 'material-dex', version: 3, teams }, null, 2);
}

/** Thrown by parseBackup; the message is shown to the user as is. */
export class BackupError extends Error {}

const isInt = (v: unknown): v is number => Number.isInteger(v);
const isSpecies = (v: unknown): v is number => isInt(v) && v >= 1 && v <= LAST_SPECIES;
const NATURE_NAMES = new Set(NATURES.map((n) => n.name));

/** What is wrong with a member, or null. Abilities and moves are checked for shape, not per species. */
function memberProblem(m: unknown): string | null {
  if (typeof m !== 'object' || m === null) return 'is not a Pokémon';
  const { speciesId, formKey, ability, nature, item, moves } = m as Record<string, unknown>;
  if (!isSpecies(speciesId)) return 'is not a known Pokémon';
  if (formKey !== undefined && (typeof formKey !== 'string' || formKey.length > 40)) return 'has an invalid form';
  if (ability !== undefined && (typeof ability !== 'string' || ability.length > 40)) return 'has an invalid ability';
  if (nature !== undefined && !NATURE_NAMES.has(nature as string)) return 'has an unknown nature';
  if (item !== undefined && !(isInt(item) && item > 0)) return 'has an invalid item';
  if (moves === undefined) return null;
  if (!Array.isArray(moves) || !moves.every((x) => isInt(x) && x > 0)) return 'has invalid moves';
  if (moves.length > MOVE_SLOTS) return `has more than ${MOVE_SLOTS} moves`;
  if (new Set(moves).size !== moves.length) return 'has a repeated move';
  return null;
}

/**
 * Validates an exported backup (version 1 to 3). Throws BackupError on the first problem, so a bad
 * file writes nothing. Teams without a name get "Team N" numbered after `existing`.
 */
export function parseBackup(json: string, existing = 0): Omit<Team, 'id'>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupError("That file isn't a team backup");
  }
  const teams = (parsed as { teams?: unknown })?.teams;
  if (!Array.isArray(teams)) throw new BackupError("That file isn't a team backup");

  return teams.map((t: unknown, i) => {
    const label = `Team ${i + 1} in the file`;
    const { name, members } = (t ?? {}) as Record<string, unknown>;
    if (!Array.isArray(members)) throw new BackupError(`${label} has no members list`);
    if (members.length > TEAM_SIZE) throw new BackupError(`${label} has more than ${TEAM_SIZE} members`);
    members.forEach((m, j) => {
      const problem = memberProblem(m);
      if (problem) throw new BackupError(`${label}: member ${j + 1} ${problem}`);
    });
    return {
      name: typeof name === 'string' && name.trim() ? name.trim() : `Team ${existing + i + 1}`,
      members: (members as TeamMember[]).map(({ speciesId, formKey, ability, nature, item, moves }) => ({
        speciesId,
        formKey: formKey || undefined,
        ability,
        nature,
        item,
        moves,
      })),
      updatedAt: Date.now(),
    };
  });
}

/** Rejects move and item ids that aren't in this app's data (the editor would have nothing to show). */
export function checkKnownIds(teams: Omit<Team, 'id'>[], moves: MoveTable, items: ItemTable) {
  teams.forEach((t, i) =>
    t.members.forEach((m, j) => {
      const where = `Team ${i + 1} in the file: member ${j + 1}`;
      if (m.item !== undefined && !items[m.item]) throw new BackupError(`${where} has an unknown item`);
      if (m.moves?.some((id) => !moves[id])) throw new BackupError(`${where} has an unknown move`);
    }),
  );
}

/** Rejects form keys the species doesn't have. `species` holds the species file of every member with a form. */
export function checkKnownForms(teams: Omit<Team, 'id'>[], species: Map<number, SpeciesDetail>) {
  teams.forEach((t, i) =>
    t.members.forEach((m, j) => {
      if (m.formKey && !species.get(m.speciesId)?.forms?.some((f) => f.key === m.formKey)) {
        throw new BackupError(`Team ${i + 1} in the file: member ${j + 1} has an unknown form`);
      }
    }),
  );
}

export async function importTeams(json: string): Promise<number> {
  const teams = parseBackup(json, await db.teams.count());
  const formed = new Set(teams.flatMap((t) => t.members.filter((m) => m.formKey).map((m) => m.speciesId)));
  const [moves, items, details] = await Promise.all([loadMoves(), loadItems(), Promise.all([...formed].map(loadSpecies))]);
  checkKnownIds(teams, moves, items);
  checkKnownForms(teams, new Map(details.map((d) => [d.id, d])));
  await db.teams.bulkAdd(teams);
  return teams.length;
}
