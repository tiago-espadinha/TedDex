import { cap } from '../../data/format';
import type { MoveCategory } from '../../data/types';
import { Icon } from '../Icon/Icon';
import './CategoryIcon.css';

/** A move's category as a coloured badge: labelled on its own, or `decorative` when the word sits beside it. */
export function CategoryIcon({ category, decorative }: { category: MoveCategory; decorative?: boolean }) {
  return (
    <span
      className={`cat-icon cat-${category}`}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': cap(category) })}
    >
      <Icon name={category} size={13} />
    </span>
  );
}
