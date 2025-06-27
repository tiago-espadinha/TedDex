import { useParams } from 'react-router-dom';
import { loadEggGroups, loadIndex, useLoad } from '../../data/api';
import { EGG_GROUP_COLOR, EGG_GROUP_NOTE } from '../../data/eggGroups';
import { EntryFrame } from './EntryFrame';
import { LearnerTable } from './LearnerTable';

/** `/reference/egg-groups/:group`, opened from a detail page's egg group chip: every species in the group. */
export function EggGroupEntry() {
  const { group = '' } = useParams();
  const { data, error } = useLoad(() => Promise.all([loadEggGroups(), loadIndex()]), 'egg-groups');
  const [groups, index] = data ?? [];
  const g = groups?.[group];
  const note = g && EGG_GROUP_NOTE[g.name];
  return (
    <EntryFrame one="Egg group" name={g?.name} error={error} loaded={!!data} tint={g && EGG_GROUP_COLOR[g.name]}>
      {g && index && (
        <>
          {note && (
            <div className="section">
              <p className="flavor">{note}</p>
            </div>
          )}
          <LearnerTable title="Pokémon" ids={g.species} index={index} />
        </>
      )}
    </EntryFrame>
  );
}
