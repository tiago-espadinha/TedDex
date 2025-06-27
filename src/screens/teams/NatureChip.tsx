import { NATURES } from '../../data/natures';
import { STAT_COLOR, typeChip } from '../../data/typeColors';

/** The nature on the types row, coloured like the stat it raises (as in the natures table); neutral ones are glass. */
export function NatureChip({ name }: { name: string }) {
  const up = NATURES.find((n) => n.name === name)?.up;
  return (
    <span className="nature fact-chip" style={up && { backgroundColor: typeChip(STAT_COLOR[up]) }}>
      <span className="sr-only">Nature: </span>
      {name}
    </span>
  );
}
