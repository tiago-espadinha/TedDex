import { useLayoutEffect, useRef } from 'react';
import { playAnim } from '../components/playAnim';

const lastSegments = new Map<string, number>();

/**
 * Slides a `.segmented` control's selected background from the option selected before. It reads
 * the selection from the DOM, as the options are the caller's. `memory` keeps it across screens,
 * for links that each render their own control.
 */
export function useSegmentSlide<T extends HTMLElement>(memory?: string) {
  const ref = useRef<T>(null);
  const last = useRef(memory ? lastSegments.get(memory) : undefined);
  useLayoutEffect(() => {
    const options = [...(ref.current?.children ?? [])] as HTMLElement[];
    const index = options.findIndex((o) => o.matches('[aria-checked="true"], [aria-current="page"]'));
    if (index < 0) return;
    const on = options[index];
    const from = options[last.current ?? index];
    if (from && from !== on) {
      on.style.setProperty('--seg-x', `${from.offsetLeft - on.offsetLeft}px`);
      on.style.setProperty('--seg-w', `${from.offsetWidth / on.offsetWidth}`);
      playAnim(on, 'seg');
    }
    last.current = index;
    if (memory) lastSegments.set(memory, index);
  });
  return ref;
}
