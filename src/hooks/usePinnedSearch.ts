import { useLayoutEffect, useRef, useState } from 'react';

/** Length of the field's morph between its header slot and the pinned bar; matches `.search-bar`'s fade in SearchField.css. */
const PIN_MORPH_MS = 200;

/**
 * Pins the search once its slot scrolls under the top of the screen (or under a sticky `.dex-top`
 * bar), and shows the back-to-top arrow after a screen's height. The field itself turns fixed, so
 * focus and typing carry over, and the slot keeps its height, so nothing below moves. The switch is a
 * FLIP of the field between the slot and the bar, both ways (none under reduced motion). One per page:
 * each adds its own arrow.
 */
export function usePinnedSearch() {
  const slot = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLLabelElement>(null);
  const [pinTop, setPinTop] = useState<number>();
  const [toTop, setToTop] = useState(false);
  // Where the field was drawn before a pin or unpin, for the morph; unset on the first measure.
  const from = useRef<{ rect: DOMRect; radius: string }>(undefined);
  const morph = useRef<Animation>(undefined);
  // Before paint, so a list restored mid-scroll never shows the field unpinned for a frame.
  useLayoutEffect(() => {
    let frame = 0;
    // Unset until the first measure, which never morphs.
    let pinned: boolean | undefined;
    const measure = () => {
      frame = 0;
      const el = slot.current;
      if (!el) return;
      const bar = document.querySelector('.dex-top');
      // The app's top padding is the safe area.
      const top =
        (bar ? bar.getBoundingClientRect().bottom : parseFloat(getComputedStyle(el.closest('.app')!).paddingTop)) + 6;
      const pin = el.getBoundingClientRect().top < top;
      if (pinned !== undefined && pin !== pinned && field.current) {
        const rect = field.current.getBoundingClientRect();
        // A jump (a list restoring its scroll) pins straight away rather than flying in from off screen.
        if (rect.bottom > 0) from.current = { rect, radius: getComputedStyle(field.current).borderRadius };
      }
      pinned = pin;
      setPinTop(pin ? top : undefined);
      setToTop(scrollY > innerHeight);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };
    measure();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
    };
  }, []);

  const pinned = pinTop != null;
  useLayoutEffect(() => {
    const start = from.current;
    const el = field.current;
    from.current = undefined;
    if (!start || !el) return;
    morph.current?.cancel();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const end = el.getBoundingClientRect();
    // Width and height animate too, so the text is never squashed by a scale.
    morph.current = el.animate(
      [
        {
          transform: `translate(${start.rect.left - end.left}px, ${start.rect.top - end.top}px)`,
          width: `${start.rect.width}px`,
          height: `${start.rect.height}px`,
          borderRadius: start.radius,
        },
        {
          transform: 'none',
          width: `${end.width}px`,
          height: `${end.height}px`,
          borderRadius: getComputedStyle(el).borderRadius,
        },
      ],
      { duration: PIN_MORPH_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
  }, [pinned]);

  return { slot, field, pinTop, toTop };
}
