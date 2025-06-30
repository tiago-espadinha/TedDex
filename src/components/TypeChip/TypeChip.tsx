import { typeChip } from '../../data/typeColors';
import type { TypeName } from '../../data/types';

export function TypeChip({ type, large }: { type: TypeName; large?: boolean }) {
  return (
    <span className={large ? 'type-chip lg' : 'type-chip'} style={{ backgroundColor: typeChip(type) }}>
      {type}
    </span>
  );
}
