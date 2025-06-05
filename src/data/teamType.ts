import type { TypeName } from './types';

/**
 * The type a trainer's card is tinted with: the trainer's own type (Gym Leaders, most of the Elite
 * Four), else the type most of the team shares, counting every type of each member; a tie goes to the
 * type met first.
 */
export function teamType(trainerType: TypeName | undefined, memberTypes: TypeName[][]): TypeName | undefined {
  if (trainerType) return trainerType;
  const counts = new Map<TypeName, number>();
  for (const t of memberTypes.flat()) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best: TypeName | undefined;
  let bestN = 0;
  for (const [t, n] of counts) {
    if (n > bestN) [best, bestN] = [t, n];
  }
  return best;
}
