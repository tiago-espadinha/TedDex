import { loadAbilities, loadIndex, useLoad } from '../../data/api';
import { EntryFrame, type EntryProps } from './EntryFrame';
import { Effect } from './Effect';
import { SpeciesList } from './SpeciesList';

export function AbilityEntry({ id, one }: EntryProps) {
  const { data, error } = useLoad(() => Promise.all([loadAbilities(), loadIndex()]), 'abilities');
  const ability = data?.[0][Number(id)];
  return (
    <EntryFrame one={one} name={ability?.name} error={error} loaded={!!data}>
      {ability && data && (
        <>
          <Effect text={ability.effect} />
          {ability.details && ability.details !== ability.effect && <Effect title="Details" text={ability.details} />}
          <SpeciesList title="Pokémon with it" ids={ability.species} index={data[1]} none="No Pokémon have it." />
        </>
      )}
    </EntryFrame>
  );
}
