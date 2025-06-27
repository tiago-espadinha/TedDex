import type { CSSProperties, ReactNode } from 'react';
import { defensiveCoverage } from '../../data/coverage';
import { cap, formatScore } from '../../data/format';
import type { MemberView } from '../../data/forms';
import type { TypeData } from '../../data/types';
import { Tile } from './Tile';
import { CoverageTable, type LastColumn } from './CoverageTable';

export function DefensiveView({ mons, typeData }: { mons: MemberView[]; typeData: TypeData }) {
  const { rows, threat, stabHits } = defensiveCoverage(
    mons.map((m) => m.types),
    typeData,
  );

  return (
    <>
      <div className="summary">
        <Tile label="BIGGEST THREAT" tone="weak">
          {threat.score < 0 ? `${cap(threat.type)} · score ${formatScore(threat.score)}` : 'No net weakness'}
        </Tile>
        <Tile label="STAB COVERAGE" tone="resist">
          {stabHits} of 18 types hit 2×
        </Tile>
      </div>
      <CoverageTable mons={mons} rows={rows} lead="ATTACK" cell={defensiveCell} last={SCORE_COLUMN} />
    </>
  );
}

const SCORE_COLUMN: LastColumn<{ score: number }> = { label: 'SCORE', align: 'center', cell: scoreCell };

/** A type's team score, green when the team holds it, warm when it doesn't. */
function scoreCell({ score }: { score: number }): [ReactNode, CSSProperties] {
  const style: CSSProperties =
    score > 0
      ? { background: 'var(--resist-bg)', color: 'var(--resist-ink)' }
      : score < 0
        ? { background: 'var(--weak-bg)', color: 'var(--weak-ink)' }
        : { color: 'var(--muted)' };
  return [formatScore(score), style];
}

/** Defending: taking more damage is bad (warm), less is good (green). */
function defensiveCell(m: number | null): CSSProperties {
  if (m === null) return { background: 'var(--neutral-cell)' };
  if (m > 1)
    return { background: 'var(--weak-bg)', color: 'var(--weak-ink)', filter: m >= 4 ? 'saturate(1.6)' : undefined };
  if (m === 0) return { background: 'var(--immune-bg)', color: 'var(--ink)' };
  if (m < 1) return { background: 'var(--resist-bg)', color: 'var(--resist-ink)' };
  return { background: 'var(--neutral-cell)' };
}
