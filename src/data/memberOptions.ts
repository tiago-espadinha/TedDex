import type { AbilityTable, Learnsets, MoveTable } from './types';

const byName = (moves: MoveTable) => (a: number, b: number) => moves[a].name.localeCompare(moves[b].name);

/**
 * The moves the member editor offers, sorted by name: every move the species learns in any
 * main-series game by any method, or in god mode every move.
 */
export function moveChoices(learnsets: Learnsets, moves: MoveTable, godMode = false): number[] {
  if (godMode) return Object.keys(moves).map(Number).sort(byName(moves));
  const ids = new Set<number>();
  for (const set of Object.values(learnsets)) {
    set.level.forEach(([m]) => ids.add(m));
    [...set.machine, ...set.tutor, ...set.egg].forEach((m) => ids.add(m));
  }
  return [...ids].sort(byName(moves));
}

/** Every ability not among `own` (by name), sorted by name: what god mode adds to the ability picker. */
export function otherAbilities(own: { name: string }[], abilities: AbilityTable): { id: number; name: string }[] {
  const owned = new Set(own.map((a) => a.name));
  return Object.entries(abilities)
    .map(([id, a]) => ({ id: Number(id), name: a.name }))
    .filter((a) => !owned.has(a.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}
