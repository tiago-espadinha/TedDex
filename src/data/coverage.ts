import { defensiveMultipliers, offensiveMultipliers } from './api';
import type { StatBlock, TypeData, TypeName } from './types';

/** One row of a coverage table: a type, one multiplier per member (null = nothing to show) and a count. */
export interface CoverageRow {
  type: TypeName;
  mults: (number | null)[];
  count: number;
}

/**
 * Defensive coverage from each member's types. A row per attacking type counts the members weak to it
 * (`count`) and resisting it (`resist`, immunities included); its `score` is +1 per resisting member and −1 per
 * weak one, 4× and ¼× alike. `stabHits` is how many defending types some member's own type hits 2×.
 */
export function defensiveCoverage(memberTypes: TypeName[][], data: TypeData) {
  const perMon = memberTypes.map((t) => defensiveMultipliers(t, data));
  const rows = data.types.map((atk) => {
    const mults = perMon.map((m) => m[atk]);
    const count = mults.filter((x) => x > 1).length;
    const resist = mults.filter((x) => x < 1).length;
    return { type: atk, mults, count, resist, score: resist - count };
  });
  // Lowest score; ties broken by more members weak to it.
  const threat = rows.reduce((a, b) => (b.score < a.score || (b.score === a.score && b.count > a.count) ? b : a));
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

type BaseStats = { stats: StatBlock; total: number };

/** The members' mean base stats and total, each rounded to a whole number (half up). */
export function averageStats(members: BaseStats[]): BaseStats {
  const mean = (f: (m: BaseStats) => number) =>
    Math.round(members.reduce((sum, m) => sum + f(m), 0) / members.length);
  const stat = (k: keyof StatBlock) => mean((m) => m.stats[k]);
  return {
    stats: { hp: stat('hp'), atk: stat('atk'), def: stat('def'), spa: stat('spa'), spd: stat('spd'), spe: stat('spe') },
    total: mean((m) => m.total),
  };
}
