import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from 'react';

const OUT = { duration: 140, easing: 'cubic-bezier(0.4, 0, 1, 1)' };
const IN = { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
const BACK = { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
/** Drag distance that turns the page; a shorter drag springs back. */
const TURN_PX = 60;
/** Movement before the gesture commits to an axis, so vertical scrolling stays the browser's. */
const LOCK_PX = 10;

interface Drag {
  x: number;
  y: number;
  dx: number;
  axis?: 'x' | 'y';
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const shift = (px: number) => `translateX(${px}px)`;

/**
 * Turns a panel of `count` sections into a pager: during a sideways drag it follows the finger, then
 * slides out while the next section slides in, or springs back on a short drag or past either end.
 * `turn(to)` plays the same slide for a tab tap; `target` is the section shown or sliding in, so the tabs can
 * show it as selected at once. Under reduced motion sections switch at once.
 * Put `ref` on the panel and `handlers` on its parent, which stays put (so a touch mid-slide still lands)
 * and should clip overflow-x.
 */
export function usePager<T extends HTMLElement>(index: number, count: number, onChange: (to: number) => void) {
  const ref = useRef<T>(null);
  const drag = useRef<Drag | null>(null);
  const running = useRef<Animation | null>(null);
  const enterFrom = useRef(0);
  const [target, setTarget] = useState(index);

  // After a switch renders, the new section slides in from the side the old one left towards.
  useLayoutEffect(() => {
    const el = ref.current;
    const dir = enterFrom.current;
    enterFrom.current = 0;
    if (!el || !dir) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate({ transform: [shift(dir * el.offsetWidth), shift(0)] }, IN);
  }, [index]);
  useEffect(() => () => running.current?.cancel(), []);

  /** Slides out towards `to` (from `fromPx`, where a drag left the panel), then switches. */
  function turn(to: number, fromPx = 0) {
    if (to === target) return;
    running.current?.cancel();
    running.current = null;
    setTarget(to);
    // Back to the section being left: cancelling the slide-out already put it back.
    if (to === index) return;
    const el = ref.current;
    if (!el || reducedMotion()) return onChange(to);
    const dir = Math.sign(to - index);
    el.style.transform = '';
    const anim = el.animate({ transform: [shift(fromPx), shift(-dir * el.offsetWidth)] }, { ...OUT, fill: 'forwards' });
    running.current = anim;
    anim.onfinish = () => {
      running.current = null;
      enterFrom.current = dir;
      onChange(to);
    };
  }

  const handlers = {
    onTouchStart(e: TouchEvent) {
      if (inSideScroller(e.target as Element, e.currentTarget)) return;
      // A slide still playing would hide the drag's transform until it ends.
      ref.current?.getAnimations().forEach((a) => a.finish());
      drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0 };
    },
    onTouchMove(e: TouchEvent) {
      const d = drag.current;
      if (!d || d.axis === 'y') return;
      const dx = e.touches[0].clientX - d.x;
      const dy = e.touches[0].clientY - d.y;
      if (!d.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_PX) return;
        d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (d.axis === 'y') return;
      }
      d.dx = dx;
      if (!ref.current || running.current || reducedMotion()) return;
      // Past either end the panel only gives a little, like a rubber band.
      const target = index - Math.sign(dx);
      const edge = target < 0 || target >= count;
      ref.current.style.transform = shift(edge ? dx / 4 : dx);
    },
    onTouchEnd() {
      const d = drag.current;
      drag.current = null;
      if (d?.axis !== 'x') return;
      const to = index - Math.sign(d.dx);
      if (Math.abs(d.dx) > TURN_PX && to >= 0 && to < count) return turn(to, d.dx);
      springBack();
    },
    onTouchCancel() {
      drag.current = null;
      springBack();
    },
  };

  function springBack() {
    const el = ref.current;
    if (!el?.style.transform) return;
    const from = el.style.transform;
    el.style.transform = '';
    if (!reducedMotion()) el.animate({ transform: [from, shift(0)] }, BACK);
  }

  return { ref, target, turn, handlers };
}

/** True when the touch starts inside a horizontal scroller (a chip row), which keeps its own sideways drag. */
function inSideScroller(target: Element, pager: Element) {
  for (let el: Element | null = target; el && el !== pager; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}
