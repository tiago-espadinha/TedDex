import type { CSSProperties, ReactNode } from 'react';
import { attackingTypes } from '../../data/api';
import { offensiveCoverage, type CoverageRow } from '../../data/coverage';
import { cap } from '../../data/format';
import type { MoveTable, TypeData } from '../../data/types';
import type { CoverageMember } from './CoverageBody';
import { Tile } from './Tile';
import { CoverageTable, type LastColumn } from './CoverageTable';

export function OffensiveView({
  members,
  typeData,
  moves,
}: {
  members: CoverageMember[];
  typeData: TypeData;
  moves: MoveTable;
}) {
  const attacks = members.map((x) => attackingTypes(x.moves, moves));
  if (attacks.every((a) => !a.length)) {
    return <p className="empty">No damaging moves yet. Give your team members moves to see what they hit.</p>;
  }
  const { rows, hits, walls } = offensiveCoverage(attacks, typeData);

  return (
    <>
      <div className="summary">
        <Tile label="MOVE COVERAGE" tone="resist">
          {hits} of 18 types hit 2×
        </Tile>
        <Tile label="WALLED BY" tone={walls.length ? 'weak' : 'resist'}>
          {walls.length ? walls.map(cap).join(', ') : 'Nothing'}
        </Tile>
      </div>
      <CoverageTable
        mons={members.map((x) => x.mon)}
        rows={rows}
        lead="DEFEND"
        cell={offensiveCell}
        last={HITS_COLUMN}
      />
    </>
  );
}

const HITS_COLUMN: LastColumn<CoverageRow> = { label: 'HIT 2×', align: 'right', cell: hitsCell };

function hitsCell({ count }: CoverageRow): [ReactNode, CSSProperties] {
  return [count || '–', { color: count ? 'var(--ink)' : 'var(--muted)' }];
}

/** Attacking: the colours flip, so super effective is green and resisted is warm. */
function offensiveCell(m: number | null): CSSProperties {
  if (m === null) return { background: 'var(--neutral-cell)', color: 'var(--muted)' };
  if (m > 1) return { background: 'var(--resist-bg)', color: 'var(--resist-ink)' };
  if (m === 0) return { background: 'var(--immune-bg)', color: 'var(--ink)' };
  if (m < 1) return { background: 'var(--weak-bg)', color: 'var(--weak-ink)' };
  return { background: 'var(--neutral-cell)' };
}
