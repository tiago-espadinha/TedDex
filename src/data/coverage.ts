import { defensiveMultipliers, offensiveMultipliers } from './api';
import type { TypeData, TypeName } from './types';

/** One row of a coverage table: a type, one multiplier per member (null = nothing to show) and a count. */
export interface CoverageRow {
  type: TypeName;
  mults: (number | null)[];
  count: number;
}

/**
 * Defensive coverage from each member's types. A row per attacking type counts the members weak to it
 * (`count`) and resisting it (`resist`). `stabHits` is how many defending types some member's own type hits 2×.
 */
export function defensiveCoverage(memberTypes: TypeName[][], data: TypeData) {
  const perMon = memberTypes.map((t) => defensiveMultipliers(t, data));
  const rows = data.types.map((atk) => {
    const mults = perMon.map((m) => m[atk]);
    return { type: atk, mults, count: mults.filter((x) => x > 1).length, resist: mults.filter((x) => x < 1).length };
  });
  // Most members weak to it; ties broken by fewer members resisting it.
  const threat = rows.reduce((a, b) => (b.count > a.count || (b.count === a.count && b.resist < a.resist) ? b : a));
  const stabHits = data.types.filter((def) =>
    memberTypes.some((types) => types.some((atk) => (data.matrix[atk]?.[def] ?? 1) > 1)),
  ).length;
  return { rows, threat, stabHits };
}

/**
 * Offensive coverage from each member's damaging move types. Members without any get null cells.
 * A row per defending type counts the members that hit it 2×; `walls` are types nobody hits even 1×.
 */
export function offensiveCoverage(attacks: TypeName[][], data: TypeData) {
  const perMember = attacks.map((a) => offensiveMultipliers(a, data));
  const rows: CoverageRow[] = data.types.map((def) => {
    const mults = perMember.map((m, i) => (attacks[i].length ? m[def] : null));
    return { type: def, mults, count: mults.filter((x) => x !== null && x > 1).length };
  });
  const best = (r: CoverageRow) => Math.max(...r.mults.map((x) => x ?? 0));
  return { rows, hits: rows.filter((r) => r.count > 0).length, walls: rows.filter((r) => best(r) < 1).map((r) => r.type) };
}
