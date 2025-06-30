import type { TrainerKind } from '../../../data/api';
import { trainerSlug } from '../../../data/trainers';
import { CoverageBody } from '../../teams/CoverageBody';
import { useTrainer } from './useTrainer';
import { monOf } from './leagueTables';
import { BackButton } from './BackButton';

export function TrainerCoverageScreen({ kind }: { kind: TrainerKind }) {
  const { tables, trainer, shown, gamePath, search, missing } = useTrainer(kind);
  const members = tables && shown ? shown.team.members.map((m) => ({ mon: monOf(m, tables), moves: m.moves })) : [];
  return (
    <>
      <header className="topbar">
        <BackButton
          fallback={trainer ? `${gamePath}/${trainerSlug(trainer.name)}${search && `?${search}`}` : gamePath}
        />
        <div className="grow">
          <h1>Coverage</h1>
          {trainer && (
            <div className="sub">
              {trainer.name} · {members.length} member{members.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </header>
      {missing}
      {members.length > 0 && <CoverageBody members={members} />}
    </>
  );
}
