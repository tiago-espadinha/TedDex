import { loadIndex, loadTypes, useLoad } from '../../data/api';
import { cap } from '../../data/format';
import { EntryFrame, type EntryProps } from './EntryFrame';
import { TypeChart } from './TypeChart';
import { SpeciesList } from './SpeciesList';

export function TypeEntry({ id, one }: EntryProps) {
  const { data, error } = useLoad(() => Promise.all([loadTypes(), loadIndex()]), 'types');
  const type = data?.[0].types.find((t) => t === id);
  return (
    <EntryFrame one={one} name={type && cap(type)} error={error} loaded={!!data} tint={type} noMorph>
      {type && data && (
        <>
          <TypeChart type={type} data={data[0]} />
          <SpeciesList
            title={`${cap(type)}-type Pokémon`}
            ids={data[1].filter((m) => m.types.includes(type)).map((m) => m.id)}
            index={data[1]}
            none="No Pokémon have this type."
          />
        </>
      )}
    </EntryFrame>
  );
}
