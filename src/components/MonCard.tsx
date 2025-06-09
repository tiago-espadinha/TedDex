import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { spriteUrl } from '../data/api';
import { typeChip, typeTint } from '../data/typeColors';
import type { MoveTable, TypeName } from '../data/types';
import { CategoryIcon, TypeChip } from './bits';

/**
 * The parts of a Pokémon card in a team: league and Gym teams, and saved teams. The caller puts
 * `MonHead` in an `.evo-member` row (a link to the species on league pages).
 */

/** Sprite on its first type's tint, name and type chips (`note` at the end of their row), then `aside` (a level badge). */
export function MonHead({
  spriteId,
  name,
  types,
  note,
  aside,
}: {
  spriteId: number;
  name: string;
  types: TypeName[];
  note?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <>
      <img
        src={spriteUrl(spriteId)}
        alt=""
        width={56}
        height={56}
        loading="lazy"
        style={types[0] && { backgroundColor: typeTint(types[0]) }}
      />
      <span className="body">
        <span className="name">{name}</span>
        <span className="types">
          {types.map((t) => (
            <TypeChip key={t} type={t} />
          ))}
          {note}
        </span>
      </span>
      {aside}
    </>
  );
}

/** Label and value pairs (ability, item...); render only when there is at least one. */
export function MonFacts({ children }: { children: ReactNode }) {
  return <dl className="league-facts">{children}</dl>;
}

export function Fact({ k, className, children }: { k: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * The moves edged in their type colour; links to their pages, or buttons calling `onPeek` (saved teams' quick view).
 * Moves in `flagged` (not learnable in the team's game) carry a "Not in game" note.
 */
export function MonMoves({
  name,
  moves,
  table,
  onPeek,
  flagged,
}: {
  name: string;
  moves: number[];
  table: MoveTable;
  onPeek?: (move: number) => void;
  flagged?: Set<number>;
}) {
  return (
    <ul className="league-moves" aria-label={`${name}'s moves`}>
      {moves.map((id, i) => {
        const move = table[id];
        const style = move && { borderLeftColor: typeChip(move.type) };
        const flag = flagged?.has(id);
        const label = (
          <>
            {move && <CategoryIcon category={move.category} decorative />}
            {move?.name ?? `Move ${id}`}
            {move && <span className="sr-only">, {move.type}, {move.category}</span>}
            {flag && <small className="move-flag">Not in game</small>}
          </>
        );
        return (
          <li key={`${id}-${i}`} className={flag ? 'not-in-game' : undefined}>
            {onPeek ? (
              <button style={style} onClick={() => onPeek(id)}>
                {label}
              </button>
            ) : (
              <Link to={`/reference/moves/${id}`} style={style}>
                {label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
