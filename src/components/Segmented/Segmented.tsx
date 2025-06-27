import type { HTMLAttributes } from 'react';
import { useSegmentSlide } from '../../hooks/useSegmentSlide';

/** A `.segmented` radio group (`className` adds to it) whose selected background slides between options. */
export function Segmented({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useSegmentSlide<HTMLDivElement>();
  return <div ref={ref} className={className ? `segmented ${className}` : 'segmented'} role="radiogroup" {...props} />;
}
