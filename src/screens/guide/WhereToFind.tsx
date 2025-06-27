import { useMemo } from 'react';
import type { IndexEntry, ItemPlaces } from '../../data/types';
import { PlaceGame } from './PlaceGame';

/** Where to get an item, one block per game (newest first): wild holders, then one-time and repeatable ways. */
export function WhereToFind({ places, index }: { places: ItemPlaces; index: IndexEntry[] }) {
  const byId = useMemo(() => new Map(index.map((m) => [m.id, m])), [index]);
  return (
    <section className="section">
      <h2>Where to find</h2>
      {!places.games.length && <p className="hint">No known place to find it in the games.</p>}
      {places.games.map((g, i) => (
        <PlaceGame key={i} place={g} byId={byId} />
      ))}
    </section>
  );
}
