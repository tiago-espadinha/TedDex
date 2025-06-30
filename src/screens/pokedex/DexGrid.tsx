import { useCallback } from 'react';
import { cycleDexState, type Pokedex } from '../../data/db';
import { formatNo } from '../../data/format';
import type { DexCell } from '../../data/pokedex';
import type { IndexEntry } from '../../data/types';
import { DexCellButton } from './DexCellButton';

/** The cells shown, numbered with `digits` digits (3 in a regional dex, as in the games); a tap moves one to its next state. */
export function DexGrid({
  dexId,
  states,
  cells,
  digits,
  species,
}: {
  dexId: number;
  states: Pokedex['states'];
  cells: DexCell[];
  digits: number;
  species: Map<number, IndexEntry>;
}) {
  const cycle = useCallback((speciesId: number) => cycleDexState(dexId, speciesId), [dexId]);
  if (!cells.length) return <p className="empty">No Pokémon match.</p>;
  return (
    <ul className="dex-grid" aria-label="Pokémon, tap to change state">
      {cells.map(({ id, no }) => (
        <DexCellButton
          key={id}
          id={id}
          no={formatNo(no, digits)}
          name={species.get(id)?.name ?? formatNo(id)}
          state={states[id] ?? 0}
          onTap={cycle}
        />
      ))}
    </ul>
  );
}
