import Dexie, { type EntityTable } from 'dexie';

/** A team slot. Phase 2 fills in ability, nature, item and moves. */
export interface TeamMember {
  speciesId: number;
  ability?: string;
  nature?: string;
  item?: string;
  moves?: string[];
}

export interface Team {
  id: number;
  name: string;
  members: TeamMember[];
  updatedAt: number;
}

export const TEAM_SIZE = 6;

class DexDB extends Dexie {
  teams!: EntityTable<Team, 'id'>;
  constructor() {
    super('material-dex');
    this.version(1).stores({ teams: '++id, updatedAt' });
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

/** Adds a species to a team. Returns false when the team is full. */
export async function addToTeam(teamId: number, speciesId: number): Promise<boolean> {
  return db.transaction('rw', db.teams, async () => {
    const team = await db.teams.get(teamId);
    if (!team || team.members.length >= TEAM_SIZE) return false;
    await db.teams.update(teamId, { members: [...team.members, { speciesId }], updatedAt: Date.now() });
    return true;
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
  return JSON.stringify({ app: 'material-dex', version: 1, teams }, null, 2);
}

export async function importTeams(json: string): Promise<number> {
  const parsed = JSON.parse(json) as { teams?: Team[] };
  const teams = (parsed.teams ?? []).filter((t) => Array.isArray(t.members));
  await db.teams.bulkAdd(
    teams.map((t) => ({ name: String(t.name), members: t.members.slice(0, TEAM_SIZE), updatedAt: Date.now() })),
  );
  return teams.length;
}
