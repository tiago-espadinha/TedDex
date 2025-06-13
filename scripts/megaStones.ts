/** Primal Reversion's orbs by species name; PokeAPI files them as key items, not Mega Stones. */
export const PRIMAL_ORBS: Record<string, string> = { Groudon: 'Red Orb', Kyogre: 'Blue Orb' };
/** Megas that need a move instead of a stone. */
export const MEGA_MOVES: Record<string, string> = { Rayquaza: 'Dragon Ascent' };

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const commonPrefix = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && a[n] === b[n]) n++;
  return n;
};

/**
 * The Mega Stone that turns `speciesName` into form `key`: PokeAPI does not link them, so the stone whose name shares
 * the longest start with the species' and the same X/Y/Z suffix wins ("Charizardite X" for "mega-x", "Tatsugirinite"
 * for every Tatsugiri). Throws when no stone shares at least four letters or two tie.
 */
export function megaStoneFor(speciesName: string, key: string, stones: { id: number; name: string }[]): number {
  const letter = key.match(/-([xyz])$/)?.[1].toUpperCase() ?? '';
  const species = letters(speciesName);
  const scored = stones
    .map((s) => {
      const [, base, suffix = ''] = s.name.match(/^(.*?)(?: ([XYZ]))?$/)!;
      return { id: s.id, score: suffix === letter ? commonPrefix(letters(base), species) : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const [best, next] = scored;
  if (!best || best.score < 4) throw new Error(`No Mega Stone for ${speciesName} ${key}`);
  if (next && next.score === best.score) throw new Error(`Two Mega Stones match ${speciesName} ${key}`);
  return best.id;
}
