import { useState } from 'react';
import { loadMoves, loadTypes, useLoad } from '../../data/api';
import { cap } from '../../data/format';
import type { MemberView } from '../../data/forms';
import { Loading } from '../../components/Loading/Loading';
import { Segmented } from '../../components/Segmented/Segmented';
import { DefensiveView } from './DefensiveView';
import { OffensiveView } from './OffensiveView';
import { StatsView } from './StatsView';
import './CoverageBody.css';

type Mode = 'defensive' | 'offensive' | 'stats';

/** A member as coverage sees it: its form's name, types and sprite, and its chosen moves. */
export interface CoverageMember {
  mon: MemberView;
  moves: number[] | undefined;
}

/** The Defensive / Offensive / Stats switch and its view, for saved teams and trainer teams. */
export function CoverageBody({ members }: { members: CoverageMember[] }) {
  const { data: typeData } = useLoad(loadTypes, 'types');
  const { data: moves } = useLoad(loadMoves, 'moves');
  const [mode, setMode] = useState<Mode>('defensive');
  if (!typeData || !moves) return <Loading />;
  return (
    <>
      <Segmented className="cov-mode" aria-label="Analysis">
        {(['defensive', 'offensive', 'stats'] as Mode[]).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
            {cap(m)}
          </button>
        ))}
      </Segmented>
      {mode === 'defensive' ? (
        <DefensiveView mons={members.map((x) => x.mon)} typeData={typeData} />
      ) : mode === 'offensive' ? (
        <OffensiveView members={members} typeData={typeData} moves={moves} />
      ) : (
        <StatsView mons={members.map((x) => x.mon)} />
      )}
    </>
  );
}
