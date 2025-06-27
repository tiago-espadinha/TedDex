import { cap, signed } from '../../data/format';
import type { MoveInfo } from '../../data/types';
import { CategoryIcon } from '../../components/CategoryIcon/CategoryIcon';
import { TypeChip } from '../../components/TypeChip/TypeChip';
import { Facts } from './Facts';

/** A move's header facts, on its page and in the quick view. */
export function MoveFacts({ move }: { move: MoveInfo }) {
  return (
    <Facts
      facts={[
        ['Type', <TypeChip key="type" type={move.type} />],
        [
          'Category',
          <span key="cat" className="cat-fact">
            <CategoryIcon category={move.category} decorative />
            {cap(move.category)}
          </span>,
        ],
        ['Power', move.power ?? '—'],
        ['Accuracy', move.accuracy ? `${move.accuracy}%` : '—'],
        ['PP', move.pp ?? '—'],
        ['Priority', signed(move.priority)],
      ]}
    />
  );
}
