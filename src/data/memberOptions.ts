import type { AbilityNameTable, FormVariant, Learnsets, MoveTable, SpeciesDetail } from './types';

const byName = (moves: MoveTable) => (a: number, b: number) => moves[a].name.localeCompare(moves[b].name);

/**
 * Every move the species learns by any method in version group `game` (none when it isn't in that game),
 * or in any main-series game when `game` is undefined.
 */
export function learnable(learnsets: Learnsets, game?: number): Set<number> {
  const sets = game === undefined ? Object.values(learnsets) : learnsets[game] ? [learnsets[game]] : [];
  const ids = new Set<number>();
  for (const set of sets) {
    set.level.forEach(([m]) => ids.add(m));
    [...set.machine, ...set.tutor, ...set.egg].forEach((m) => ids.add(m));
  }
  return ids;
}

/**
 * The moves the member editor offers, sorted by name: what the species learns in the team's `game`
 * (see `learnable`), or in god mode every move.
 */
export function moveChoices(learnsets: Learnsets, moves: MoveTable, godMode = false, game?: number): number[] {
  const ids = godMode ? Object.keys(moves).map(Number) : [...learnable(learnsets, game)];
  return ids.sort(byName(moves));
}

/** Every ability not among `own` (by name), sorted by name: what god mode adds to the ability picker. */
export function otherAbilities(own: { name: string }[], abilities: AbilityNameTable): { id: number; name: string }[] {
  const owned = new Set(own.map((a) => a.name));
  return Object.entries(abilities)
    .map(([id, a]) => ({ id: Number(id), name: a.name }))
    .filter((a) => !owned.has(a.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Team members store their ability by name; the first ability with that name (As One has two). */
export function abilityIdByName(table: AbilityNameTable, name: string): number | undefined {
  const hit = Object.entries(table).find(([, a]) => a.name === name);
  return hit && Number(hit[0]);
}

/**
 * A member's ability `name` (undefined when none is set): its form's `own` entry, or, for one picked in god mode, the
 * first ability with that name in `table` (no id until `table` loads), never hidden.
 */
export function memberAbility(own: SpeciesDetail['abilities'], name: string | undefined, table?: AbilityNameTable) {
  if (!name) return undefined;
  const mine = own.find((a) => a.name === name);
  return { id: mine?.id ?? (table && abilityIdByName(table, name)), hidden: mine?.hidden ?? false };
}

/** The first generation whose games have abilities, hidden abilities and held items. */
export const FIRST_GEN = { ability: 3, hidden: 5, item: 2 };

/**
 * Whether a team's game (its generation `gen`; undefined for any game) has an ability introduced in Gen
 * `introduced`, hidden or not. `abilityInGame(gen, 1)` tells whether the game has abilities at all.
 */
export const abilityInGame = (gen: number | undefined, introduced: number, hidden = false) =>
  gen === undefined || (gen >= Math.max(FIRST_GEN.ability, introduced) && (!hidden || gen >= FIRST_GEN.hidden));

/** Whether a team's game (generation `gen`, undefined for any game) has a held item introduced in Gen `introduced`. */
export const itemInGame = (gen: number | undefined, introduced: number) => gen === undefined || gen >= Math.max(FIRST_GEN.item, introduced);

/** Whether version group `game` (undefined for any game) has the form; the default form (no `games`) is in every game. */
export const formInGame = (form: Pick<FormVariant, 'games'> | undefined, game?: number) =>
  game === undefined || !form?.games || form.games.includes(game);
