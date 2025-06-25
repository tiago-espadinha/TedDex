import type { LearnMethod, MoveReference } from './types';

type Learners = MoveReference['learners'];

const MASK_BITS = 32;

/** A version group's bit in a learner mask; a group past the mask would wrap onto another game's bit. */
export function learnerBit(group: number): number {
  if (group > MASK_BITS) {
    throw new Error(`Version group ${group} doesn't fit a ${MASK_BITS}-bit learner mask: skip it or widen the masks`);
  }
  return 1 << (group - 1);
}

/** The version groups out of `groups` in which anyone learns the move, in the same order. */
export function learnerGames(learners: Learners, groups: number[]): number[] {
  const all = Object.values(learners)
    .flat()
    .reduce((mask, [, games]) => mask | games, 0);
  return groups.filter((group) => all & learnerBit(group));
}

/** The species that learn the move by `method` in a version group. */
export const learnersIn = (learners: Learners, method: LearnMethod, group: number): number[] =>
  (learners[method] ?? []).filter(([, games]) => games & learnerBit(group)).map(([species]) => species);
