import { loadIndex, loadMoveReference, loadMoves, loadVersions, useLoad } from '../../data/api';
import { SharedGameSheet } from '../../components/GamePicker/GamePicker';
import { EntryFrame, type EntryProps } from './EntryFrame';
import { MoveFacts } from './MoveFacts';
import { Effect } from './Effect';
import { MoveLearners } from './MoveLearners';

export function MoveEntry({ id, one }: EntryProps) {
  const n = Number(id);
  const { data, error } = useLoad(
    () =>
      Promise.all([loadMoves(), loadIndex(), loadVersions()]).then(async ([moves, index, versions]) => ({
        moves,
        index,
        versions,
        ref: moves[n] && (await loadMoveReference(n)),
      })),
    n,
  );
  const move = data?.moves[n];
  const ref = data?.ref;
  return (
    <>
      <EntryFrame
        one={one}
        name={move?.name}
        error={error}
        loaded={!!data}
        tint={move?.type}
        head={move && <MoveFacts move={move} />}
      >
        {move && ref && data && (
          <>
            {ref.description && (
              <div className="section">
                <h2>Description</h2>
                <p className="flavor">{ref.description}</p>
              </div>
            )}
            <Effect text={ref.effect} />
            <MoveLearners name={move.name} learners={ref.learners} index={data.index} versions={data.versions} />
          </>
        )}
      </EntryFrame>
      <SharedGameSheet latestNote="Each move's newest game" />
    </>
  );
}
