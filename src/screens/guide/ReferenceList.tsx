import { useParams } from 'react-router-dom';
import { NatureTable } from './NatureTable';
import { TypeMatrix } from './TypeMatrix';
import { SearchList } from './SearchList';

/** `/reference/:kind`: the natures table, the type chart, or a searchable list. */
export function ReferenceList() {
  const kind = useParams().kind;
  if (kind === 'natures') return <NatureTable />;
  if (kind === 'types') return <TypeMatrix />;
  return <SearchList />;
}
