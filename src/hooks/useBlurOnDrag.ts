import { useEffect, type RefObject } from 'react';

/** How far a touch must move on the page before it closes the keyboard. */
const DRAG_BLUR_PX = 10;

/**
 * Like an iOS list, a drag anywhere but on the field closes the keyboard (blurs the field), so
 * scrolling shows the list and the pinned bar rather than panning under the keyboard.
 */
export function useBlurOnDrag(field: RefObject<HTMLLabelElement | null>) {
  useEffect(() => {
    let startY: number | null = null;
    const onStart = (e: TouchEvent) => {
      startY = field.current?.contains(e.target as Node) ? null : e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      const at = document.activeElement as HTMLElement | null;
      if (startY === null || !at || !field.current?.contains(at)) return;
      if (Math.abs(e.touches[0].clientY - startY) >= DRAG_BLUR_PX) at.blur();
    };
    addEventListener('touchstart', onStart, { passive: true });
    addEventListener('touchmove', onMove, { passive: true });
    return () => {
      removeEventListener('touchstart', onStart);
      removeEventListener('touchmove', onMove);
    };
  }, [field]);
}
