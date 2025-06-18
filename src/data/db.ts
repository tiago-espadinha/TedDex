import Dexie, { type EntityTable, type Table } from 'dexie';
import { loadItems, loadMoves, loadSpecies, loadVersions } from './api';
import { NATURES } from './natures';
import { isDexState, lastSpecies, nextState, type DexState } from './pokedex';
import type { ItemTable, MoveTable, SpeciesDetail, VersionGroup } from './types';

/**
 * A team slot. `formKey` is a key from the species' `forms` (absent for the default form), `nature`
 * a name from NATURES, `item` an items.json id, `moves` moves.json ids. `nickname` is trimmed, never blank,
 * at most NICKNAME_LENGTH characters.
 */
export interface TeamMember {
  speciesId: number;
  formKey?: string;
  nickname?: string;
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

/**
 * A Pokédex tracker. `game` is a version group (versions.json) whose generation sets how many species it lists;
 * absent means any game. A custom Pokédex lists only `species` (in national order, never empty) and has no game.
 * `states` maps species ids to their state; species not in it are not seen.
 */
export interface Pokedex {
  id: number;
  name: string;
  game?: number;
  species?: number[];
  states: Record<number, DexState>;
  updatedAt: number;
}

/** A favourite Pokémon: a species in form `formKey` ('' for the default form, so it can be part of the key). */
export interface Favourite {
  speciesId: number;
  formKey: string;
}

/** localStorage key of the device's god mode ('on' or absent), read by useGodMode; v11 sets it for devices that had a team in god mode. */
export const GOD_MODE_KEY = 'god-mode';

export const TEAM_SIZE = 6;
export const MOVE_SLOTS = 4;
/** As in the games. Counted in code points, so most emoji count as one (flags and joined emoji as more). */
export const NICKNAME_LENGTH = 12;

/** A nickname as stored: trimmed, cut to NICKNAME_LENGTH characters, undefined when blank. */
export const cleanNickname = (nickname: string) => [...nickname.trim()].slice(0, NICKNAME_LENGTH).join('').trim() || undefined;

export const NAME_LENGTH = 20;

/** A team or Pokédex name as stored: trimmed and cut to NAME_LENGTH characters (code points); '' when blank. */
export const cleanName = (name: string) => [...name.trim()].slice(0, NAME_LENGTH).join('').trim();

/** How a member is titled: "Pikachu · Sparky" with a nickname, else its species or form name. */
export const memberTitle = (name: string, nickname?: string) => (nickname ? `${name} · ${nickname}` : name);

class DexDB extends Dexie {
  teams!: EntityTable<Team, 'id'>;
  pokedexes!: EntityTable<Pokedex, 'id'>;
  favourites!: Table<Favourite, [number, string]>;
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
    // v4: god mode moves from the member (an optional v3 field) to the team, on if any member was; v11 takes it on.
    this.version(4)
      .stores({ teams: '++id, updatedAt' })
      .upgrade((tx) =>
        tx
          .table('teams')
          .toCollection()
          .modify((team: Team & { godMode?: boolean }) => {
            if (team.members.some((m) => (m as { godMode?: unknown }).godMode === true)) team.godMode = true;
            team.members.forEach((m) => delete (m as { godMode?: unknown }).godMode);
          }),
      );
    // v5: teams may have a game. Every v4 team is a valid v5 team (any game), so nothing to upgrade.
    this.version(5).stores({ teams: '++id, updatedAt' });
    // v6: Pokédex trackers in their own table.
    this.version(6).stores({ teams: '++id, updatedAt', pokedexes: '++id, updatedAt' });
    // v7: teams no longer have a game.
    this.version(7)
      .stores({ teams: '++id, updatedAt', pokedexes: '++id, updatedAt' })
      .upgrade((tx) =>
        tx
          .table('teams')
          .toCollection()
          .modify((team: Team) => delete (team as { game?: unknown }).game),
      );
    // v8: Pokédexes may have a species list (custom). Every v7 Pokédex is a valid v8 one, so nothing to upgrade.
    this.version(8).stores({ teams: '++id, updatedAt', pokedexes: '++id, updatedAt' });
    // v9: favourites in their own table, one row per species and form.
    this.version(9).stores({ teams: '++id, updatedAt', pokedexes: '++id, updatedAt', favourites: '[speciesId+formKey]' });
    // v10: members may have a nickname. Every v9 member is a valid v10 member, so nothing to upgrade.
    this.version(10).stores({ teams: '++id, updatedAt', pokedexes: '++id, updatedAt', favourites: '[speciesId+formKey]' });
    // v11: god mode is a device preference (GOD_MODE_KEY), no longer kept on the team; it starts on if any team had it.
    this.version(11)
      .stores({ teams: '++id, updatedAt', pokedexes: '++id, updatedAt', favourites: '[speciesId+formKey]' })
      .upgrade(async (tx) => {
        let anyOn = false;
        await tx
          .table('teams')
          .toCollection()
          .modify((team: Team & { godMode?: unknown }) => {
            anyOn ||= team.godMode === true;
            delete team.godMode;
          });
        if (anyOn) {
          try {
            localStorage.setItem(GOD_MODE_KEY, 'on');
          } catch {
            /* the preference just starts off */
          }
        }
      });
    // v12: team and Pokédex names are at most NAME_LENGTH characters; longer ones are cut.
    this.version(12)
      .stores({ teams: '++id, updatedAt', pokedexes: '++id, updatedAt', favourites: '[speciesId+formKey]' })
      .upgrade(async (tx) => {
        for (const table of ['teams', 'pokedexes']) {
          await tx
            .table(table)
            .toCollection()
            .modify((row: { name: unknown }) => {
              if (typeof row.name === 'string') row.name = cleanName(row.name) || row.name;
            });
        }
      });
  }
}

export const db = new DexDB();

// Ask iOS/Android not to evict our storage (teams live only on this device).
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

export async function createTeam(name?: string): Promise<number> {
  const count = await db.teams.count();
  return db.teams.add({ name: (name && cleanName(name)) || `Team ${count + 1}`, members: [], updatedAt: Date.now() });
}

/** Renames a team; a blank name leaves it unchanged. */
export async function renameTeam(teamId: number, name: string) {
  const cleaned = cleanName(name);
  if (cleaned) await db.teams.update(teamId, { name: cleaned, updatedAt: Date.now() });
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

/** Creates a Pokédex for `game` (a version group; absent for any game). */
export async function createPokedex(game?: number): Promise<number> {
  const count = await db.pokedexes.count();
  return db.pokedexes.add({ name: `Pokédex ${count + 1}`, ...(game !== undefined && { game }), states: {}, updatedAt: Date.now() });
}

/** Creates a custom Pokédex listing `species`, kept in national order. */
export async function createCustomPokedex(species: number[]): Promise<number> {
  const count = await db.pokedexes.count();
  return db.pokedexes.add({ name: `Pokédex ${count + 1}`, species: speciesList(species), states: {}, updatedAt: Date.now() });
}

/** Replaces a custom Pokédex's list. States of species taken off are kept (not counted), so adding one back restores it. */
export async function setPokedexSpecies(dexId: number, species: number[]) {
  await db.pokedexes.update(dexId, { species: speciesList(species), updatedAt: Date.now() });
}

const speciesList = (species: number[]) => [...new Set(species)].sort((a, b) => a - b);

/** Renames a Pokédex; a blank name leaves it unchanged. */
export async function renamePokedex(dexId: number, name: string) {
  const cleaned = cleanName(name);
  if (cleaned) await db.pokedexes.update(dexId, { name: cleaned, updatedAt: Date.now() });
}

/** Moves a species to its next state, reading the stored states so quick taps don't overwrite each other. */
export async function cycleDexState(dexId: number, speciesId: number) {
  return db.transaction('rw', db.pokedexes, async () => {
    const dex = await db.pokedexes.get(dexId);
    if (!dex) return;
    const states = { ...dex.states };
    const next = nextState(states[speciesId] ?? 0);
    if (next) states[speciesId] = next;
    else delete states[speciesId];
    await db.pokedexes.update(dexId, { states, updatedAt: Date.now() });
  });
}

/** Favourites or unfavourites a species in form `formKey` ('' or absent for the default). */
export async function toggleFavourite(speciesId: number, formKey = '') {
  return db.transaction('rw', db.favourites, async () => {
    const key: [number, string] = [speciesId, formKey];
    if (await db.favourites.get(key)) await db.favourites.delete(key);
    else await db.favourites.add({ speciesId, formKey });
  });
}

// ---- backup (export/import as JSON, since iOS can evict web storage) ----
export async function exportBackup(): Promise<string> {
  const [teams, pokedexes, favs] = await Promise.all([db.teams.toArray(), db.pokedexes.toArray(), db.favourites.toArray()]);
  const favourites = favs.map(({ speciesId, formKey }) => (formKey ? { speciesId, formKey } : { speciesId }));
  return JSON.stringify({ app: 'material-dex', version: 9, teams, pokedexes, favourites }, null, 2);
}

/** Thrown by parseBackup; the message is shown to the user as is. */
export class BackupError extends Error {}

const isInt = (v: unknown): v is number => Number.isInteger(v);
const isSpecies = (v: unknown): v is number => isInt(v) && v >= 1 && v <= lastSpecies();
const NATURE_NAMES = new Set(NATURES.map((n) => n.name));

/** What is wrong with a member, or null. Abilities and moves are checked for shape, not per species. */
function memberProblem(m: unknown): string | null {
  if (typeof m !== 'object' || m === null) return 'is not a Pokémon';
  const { speciesId, formKey, nickname, ability, nature, item, moves } = m as Record<string, unknown>;
  if (!isSpecies(speciesId)) return 'is not a known Pokémon';
  if (nickname !== undefined && (typeof nickname !== 'string' || [...nickname.trim()].length > NICKNAME_LENGTH)) return 'has an invalid nickname';
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
 * Validates an exported backup (version 1 to 9; nicknames from 9). Throws BackupError on the first problem, so a bad
 * file writes nothing. Names are cut to NAME_LENGTH; teams without a name get "Team N" numbered after `existing`; the team game of
 * versions 5 and 6 and the god mode of versions 1 to 9 (per member before 4, then per team) are dropped. Nicknames are trimmed; a blank one is dropped.
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
      name: (typeof name === 'string' && cleanName(name)) || `Team ${existing + i + 1}`,
      members: (members as TeamMember[]).map(({ speciesId, formKey, nickname, ability, nature, item, moves }) => {
        const cleaned = nickname === undefined ? undefined : cleanNickname(nickname);
        return { speciesId, formKey: formKey || undefined, ...(cleaned !== undefined && { nickname: cleaned }), ability, nature, item, moves };
      }),
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

const hasForm = (species: Map<number, SpeciesDetail>, id: number, formKey?: string) =>
  !formKey || !!species.get(id)?.forms?.some((f) => f.key === formKey);

/** Rejects form keys the species doesn't have. `species` holds the species file of every member with a form. */
export function checkKnownForms(teams: Omit<Team, 'id'>[], species: Map<number, SpeciesDetail>) {
  teams.forEach((t, i) =>
    t.members.forEach((m, j) => {
      if (!hasForm(species, m.speciesId, m.formKey)) throw new BackupError(`Team ${i + 1} in the file: member ${j + 1} has an unknown form`);
    }),
  );
}

/** Rejects favourite form keys the species doesn't have. `species` holds the species file of every favourite form. */
export function checkKnownFavouriteForms(favourites: Favourite[], species: Map<number, SpeciesDetail>) {
  favourites.forEach((f, i) => {
    if (!hasForm(species, f.speciesId, f.formKey)) throw new BackupError(`Favourite ${i + 1} in the file has an unknown form`);
  });
}

/**
 * Validates the favourites of a backup (version 8 and 9; older backups have none). Throws BackupError on the first
 * problem. Call after parseBackup, which checks the file.
 */
export function parseFavourites(json: string): Favourite[] {
  const favourites = (JSON.parse(json) as { favourites?: unknown }).favourites;
  if (favourites === undefined) return [];
  if (!Array.isArray(favourites)) throw new BackupError('The favourites in the file are not a list');
  const seen = new Set<string>();
  return favourites.map((f: unknown, i) => {
    const label = `Favourite ${i + 1} in the file`;
    const { speciesId, formKey } = (f ?? {}) as Record<string, unknown>;
    if (!isSpecies(speciesId)) throw new BackupError(`${label} is not a known Pokémon`);
    if (formKey !== undefined && (typeof formKey !== 'string' || formKey.length > 40)) throw new BackupError(`${label} has an invalid form`);
    const fav = { speciesId, formKey: (formKey as string | undefined) ?? '' };
    const key = `${speciesId}:${fav.formKey}`;
    if (seen.has(key)) throw new BackupError(`${label} is listed twice`);
    seen.add(key);
    return fav;
  });
}

/**
 * Validates the Pokédexes of a backup (version 6 to 9; older backups have none; custom ones from 7). Throws
 * BackupError on the first problem.
 * Names are cut to NAME_LENGTH; Pokédexes without a name get "Pokédex N" numbered after `existing`. Call after parseBackup, which checks the file.
 */
export function parsePokedexes(json: string, existing = 0): Omit<Pokedex, 'id'>[] {
  const dexes = (JSON.parse(json) as { pokedexes?: unknown }).pokedexes;
  if (dexes === undefined) return [];
  if (!Array.isArray(dexes)) throw new BackupError('The Pokédexes in the file are not a list');

  return dexes.map((d: unknown, i) => {
    const label = `Pokédex ${i + 1} in the file`;
    const { name, game, species, states } = (d ?? {}) as Record<string, unknown>;
    if (game !== undefined && !(isInt(game) && game > 0)) throw new BackupError(`${label} has an invalid game`);
    if (species !== undefined) {
      if (!Array.isArray(species) || !species.length) throw new BackupError(`${label} has an empty or invalid Pokémon list`);
      if (game !== undefined) throw new BackupError(`${label} has both a game and a Pokémon list`);
      if (!species.every(isSpecies)) throw new BackupError(`${label} lists an unknown Pokémon`);
      if (new Set(species).size !== species.length) throw new BackupError(`${label} lists a Pokémon twice`);
    }
    if (typeof states !== 'object' || states === null || Array.isArray(states)) throw new BackupError(`${label} has no states`);
    // Rebuilt with plain number keys, so a key like "025" can't hide from the grid.
    const clean: Record<number, DexState> = {};
    for (const [id, state] of Object.entries(states)) {
      if (String(Number(id)) !== id || !isSpecies(Number(id))) throw new BackupError(`${label} has an unknown Pokémon`);
      if (!isDexState(state)) throw new BackupError(`${label} has an invalid state`);
      clean[Number(id)] = state;
    }
    return {
      name: (typeof name === 'string' && cleanName(name)) || `Pokédex ${existing + i + 1}`,
      ...(game !== undefined && { game: game as number }),
      ...(species !== undefined && { species: speciesList(species as number[]) }),
      states: clean,
      updatedAt: Date.now(),
    };
  });
}

/** Rejects Pokédex games that aren't version groups in versions.json. */
export function checkKnownGames(dexes: Pick<Pokedex, 'game'>[], versions: VersionGroup[]) {
  dexes.forEach((d, i) => {
    if (d.game !== undefined && !versions.some((v) => v.id === d.game)) throw new BackupError(`Pokédex ${i + 1} in the file has an unknown game`);
  });
}

/** Imports a backup's teams and Pokédexes next to the existing ones, and adds its favourites to ours; all or nothing. */
export async function importBackup(json: string): Promise<{ teams: number; pokedexes: number; favourites: number }> {
  const teams = parseBackup(json, await db.teams.count());
  const pokedexes = parsePokedexes(json, await db.pokedexes.count());
  const favourites = parseFavourites(json);
  const formed = new Set([
    ...teams.flatMap((t) => t.members.filter((m) => m.formKey).map((m) => m.speciesId)),
    ...favourites.filter((f) => f.formKey).map((f) => f.speciesId),
  ]);
  const [moves, items, versions, details] = await Promise.all([loadMoves(), loadItems(), loadVersions(), Promise.all([...formed].map(loadSpecies))]);
  const species = new Map(details.map((d) => [d.id, d]));
  checkKnownGames(pokedexes, versions);
  checkKnownIds(teams, moves, items);
  checkKnownForms(teams, species);
  checkKnownFavouriteForms(favourites, species);
  await db.transaction('rw', db.teams, db.pokedexes, db.favourites, async () => {
    await db.teams.bulkAdd(teams);
    await db.pokedexes.bulkAdd(pokedexes);
    await db.favourites.bulkPut(favourites);
  });
  return { teams: teams.length, pokedexes: pokedexes.length, favourites: favourites.length };
}
