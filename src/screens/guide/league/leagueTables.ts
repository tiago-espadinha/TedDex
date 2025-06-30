import {
  loadAbilities,
  loadIndex,
  loadItemReference,
  loadItems,
  loadMoves,
  loadSpecies,
  loadTrainerGame,
  loadTrainerGames,
  type TrainerKind,
} from '../../../data/api';
import type { MemberView } from '../../../data/forms';
import type {
  AbilityTable,
  FormVariant,
  IndexEntry,
  ItemTable,
  LeagueGame,
  LeagueMember,
  LeagueTrainer,
  MoveTable,
} from '../../../data/types';
import { teamType } from '../../../data/teamType';
import { typeTint } from '../../../data/typeColors';

export const TITLES: Record<TrainerKind, string> = { league: 'Elite Four & Champion', gyms: 'Gym Leaders' };

export interface Tables {
  index: Map<number, IndexEntry>;
  /** Forms of the species that appear in another form, keyed `${id}:${form}`. */
  forms: Map<string, FormVariant>;
  moves: MoveTable;
  abilities: AbilityTable;
  items: ItemTable;
}

const formKey = (id: number, form: string) => `${id}:${form}`;

const NO_STATS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** A member's sprite, name, types and base stats, from its form when it has one. */
export function monOf(m: LeagueMember, tables: Tables): MemberView {
  const species = tables.index.get(m.id);
  const form = m.form ? tables.forms.get(formKey(m.id, m.form)) : undefined;
  return {
    mediaId: form?.pokemonId ?? m.id,
    speciesId: m.id,
    name: form?.name ?? species?.name ?? `#${m.id}`,
    types: form?.types ?? species?.types ?? [],
    stats: form?.stats ?? species?.stats ?? NO_STATS,
    total: form?.total ?? species?.total ?? 0,
  };
}

/** The game and the tables its pages need; null when the id is not a game in the data. */
export async function loadGame(kind: TrainerKind, id: string): Promise<[LeagueGame, Tables] | null> {
  if (!(await loadTrainerGames(kind)).some((g) => g.id === id)) return null;
  const [game, index, moves, abilities, held] = await Promise.all([
    loadTrainerGame(kind, id),
    loadIndex(),
    loadMoves(),
    loadAbilities(),
    loadItems(),
  ]);
  const teams = game.trainers.flatMap((t) => [...t.teams, ...(t.rematches ?? []).flatMap((r) => r.teams)]);
  const members = teams.flatMap((team) => team.members);
  // A few teams hold Berries with no battle effect, which only the full item table names.
  const items: ItemTable = members.some((m) => m.item !== undefined && !held[m.item])
    ? await loadItemReference()
    : held;
  const formed = [...new Set(members.filter((m) => m.form).map((m) => m.id))];
  const forms = new Map<string, FormVariant>();
  for (const s of await Promise.all(formed.map(loadSpecies))) {
    for (const f of s.forms ?? []) forms.set(formKey(s.id, f.key), f);
  }
  return [game, { index: new Map(index.map((s) => [s.id, s])), forms, moves, abilities, items }];
}

export function tintOf(t: LeagueTrainer, members: LeagueMember[], tables: Tables) {
  const tint = teamType(
    t.type,
    members.map((m) => monOf(m, tables).types),
  );
  return tint && { backgroundColor: typeTint(tint) };
}
