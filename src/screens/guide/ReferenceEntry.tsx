import { useParams } from 'react-router-dom';
import { kindOf } from './guideEntries';
import { MoveEntry } from './MoveEntry';
import { AbilityEntry } from './AbilityEntry';
import { ItemEntry } from './ItemEntry';
import { TypeEntry } from './TypeEntry';

export function ReferenceEntry() {
  const { kind, id = '' } = useParams();
  const k = kindOf(kind);
  if (!k) return <p className="empty">Page not found.</p>;
  if (k.kind === 'natures' || k.kind === 'gyms' || k.kind === 'league' || k.kind === 'compare') {
    return <p className="empty">Page not found.</p>;
  }
  const Page = { moves: MoveEntry, abilities: AbilityEntry, items: ItemEntry, types: TypeEntry }[k.kind];
  return <Page id={id} one={k.one} />;
}
