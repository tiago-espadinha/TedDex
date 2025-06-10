import type { AbilityNameTable, LearnMethod, Learnsets, MoveCategory, MoveTable, SpeciesDetail, TypeName } from './types';

const byName = (moves: MoveTable) => (a: number, b: number) => moves[a].name.localeCompare(moves[b].name);

/**
 * Every move the species learns in version group `game` (none when it isn't in that game), or in any main-series
 * game when `game` is undefined, by any of `methods` (every method when empty).
 */
export function learnable(learnsets: Learnsets, game?: number, methods: LearnMethod[] = []): Set<number> {
  const sets = game === undefined ? Object.values(learnsets) : learnsets[game] ? [learnsets[game]] : [];
  const by = (m: LearnMethod) => !methods.length || methods.includes(m);
  const ids = new Set<number>();
  for (const set of sets) {
    if (by('level')) set.level.forEach(([m]) => ids.add(m));
    [...(by('machine') ? set.machine : []), ...(by('tutor') ? set.tutor : []), ...(by('egg') ? set.egg : [])].forEach((m) => ids.add(m));
  }
  return ids;
}

/** The move picker's filters: the game a move is learnable in (undefined for any), and learn methods, types and categories (empty for any). */
export interface MoveChoiceFilters {
  game?: number;
  methods: LearnMethod[];
  types: TypeName[];
  categories: MoveCategory[];
}

export const NO_MOVE_FILTERS: MoveChoiceFilters = { methods: [], types: [], categories: [] };

/** How many filters are on, for the filter button's badge. */
export const activeMoveChoiceFilters = (f: MoveChoiceFilters) => (f.game !== undefined ? 1 : 0) + f.methods.length + f.types.length + f.categories.length;

/**
 * The moves the member editor offers, sorted by name: what the species learns (see `learnable`), or in god mode every
 * move unless a game or learn method is picked; then narrowed to the filters' types and categories.
 */
export function moveChoices(learnsets: Learnsets, moves: MoveTable, godMode = false, f = NO_MOVE_FILTERS): number[] {
  const every = godMode && f.game === undefined && !f.methods.length;
  const ids = every ? Object.keys(moves).map(Number) : [...learnable(learnsets, f.game, f.methods)];
  return ids
    .filter((id) => moves[id] && (!f.types.length || f.types.includes(moves[id].type)) && (!f.categories.length || f.categories.includes(moves[id].category)))
    .sort(byName(moves));
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
