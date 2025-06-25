/** The game Moves and Locations show: a version group id, or 'latest' for each species' newest game. */
export type GamePref = 'latest' | number;

/** Parses the stored setting; anything but a positive whole number is 'latest'. */
export function parseGamePref(value: string | null): GamePref {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : 'latest';
}

/** The stored game, or 'latest' when the data no longer has it. */
export const knownGame = (chosen: GamePref, versions: { id: number }[]): GamePref =>
  versions.some((v) => v.id === chosen) ? chosen : 'latest';

/** The version group to show out of a species' groups (`available`, oldest first): the chosen one, its latest for 'latest', undefined when it isn't there. */
export function shownGame(available: number[], chosen: GamePref): number | undefined {
  if (chosen === 'latest') return available[available.length - 1];
  return available.includes(chosen) ? chosen : undefined;
}
