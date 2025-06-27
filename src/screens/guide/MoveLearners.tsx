import { useState } from 'react';
import { knownGame, shownGame } from '../../data/game';
import { learnerGames, learnersIn } from '../../data/moveLearners';
import { useGame } from '../../data/settings';
import type { IndexEntry, LearnMethod, MoveReference, VersionGroup } from '../../data/types';
import { GamePicker, NotInGame } from '../../components/GamePicker/GamePicker';
import { Segmented } from '../../components/Segmented/Segmented';
import { SpeciesList } from './SpeciesList';
import { LearnerTable } from './LearnerTable';

const LEARN_METHODS: [LearnMethod, string][] = [
  ['level', 'Level up'],
  ['machine', 'TM/HM'],
  ['tutor', 'Tutor'],
  ['egg', 'Egg move'],
];

/** Who learns the move in the shared game, one learn method at a time (a species can be in several). */
export function MoveLearners({
  name,
  learners,
  index,
  versions,
}: {
  name: string;
  learners: MoveReference['learners'];
  index: IndexEntry[];
  versions: VersionGroup[];
}) {
  const [stored] = useGame();
  const [pickMethod, setMethod] = useState<LearnMethod>('level');
  const games = learnerGames(
    learners,
    versions.map((v) => v.id),
  );
  if (!games.length)
    return (
      <SpeciesList title="Learned by" ids={[]} index={index} none="No Pokémon learn it in the main-series games." />
    );

  const chosen = knownGame(stored, versions);
  const group = shownGame(games, chosen);
  if (group === undefined) {
    return (
      <div className="section">
        <h2>Learned by</h2>
        <GamePicker versions={versions} describedBy="learners-missing" />
        <NotInGame id="learners-missing" name={name} versions={versions} />
      </div>
    );
  }

  const methods = LEARN_METHODS.filter(([m]) => learnersIn(learners, m, group).length > 0);
  const [method, title] = methods.find(([m]) => m === pickMethod) ?? methods[0];

  return (
    <>
      <div className="section">
        <h2>Learned by</h2>
        <GamePicker versions={versions} shows={group} />
        {methods.length > 1 && (
          <Segmented className="method-pick" aria-label="How they learn it">
            {methods.map(([m, label]) => (
              <button key={m} role="radio" aria-checked={m === method} onClick={() => setMethod(m)}>
                {label}
              </button>
            ))}
          </Segmented>
        )}
      </div>
      <LearnerTable title={title} ids={learnersIn(learners, method, group)} index={index} />
    </>
  );
}
