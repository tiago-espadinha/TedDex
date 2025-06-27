import { useLayoutEffect, useRef } from 'react';
import { playAnim } from '../playAnim';

/**
 * The count on a filter button. It bumps when the count changes, but filter sheets apply live and
 * cover the button, so while `held` (the sheet is open) the bump waits until the button shows.
 */
export function CountBadge({ count, held }: { count: number; held?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(count);
  useLayoutEffect(() => {
    if (held || shown.current === count) return;
    shown.current = count;
    if (ref.current) playAnim(ref.current, 'bump');
  }, [count, held]);
  if (count <= 0) return null;
  return (
    <span className="badge" aria-hidden="true" ref={ref}>
      {count}
    </span>
  );
}
