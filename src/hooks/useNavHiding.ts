import { useEffect, useLayoutEffect } from 'react';
import { nextNavScroll, type NavScroll } from '../data/navHide';

let navScroll: NavScroll = { y: 0, away: false };

function setNavScroll(next: NavScroll) {
  navScroll = next;
  document.documentElement.classList.toggle('nav-away', next.away);
}

/** Brings the nav back, and takes the scroll from here: a list restoring its spot isn't scrolling down. */
export function showNav() {
  setNavScroll({ y: scrollY, away: false });
}

/** Slides the nav, and what is anchored above it, away on scrolling down (`.nav-away`). Once, in the shell. */
export function useNavHiding(locationKey: string) {
  useEffect(() => {
    const onScroll = () => {
      // iOS bounces past the bottom, and the way back would read as scrolling up.
      const y = Math.min(scrollY, document.documentElement.scrollHeight - innerHeight);
      // A focused tab stays on screen for whoever is scrolling with the keys.
      const stay =
        matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('.bottom-nav :focus-visible');
      setNavScroll(stay ? { y, away: false } : nextNavScroll(navScroll, y));
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);
  // After the screens' layout effects, so a spot they restored isn't read as a scroll.
  useLayoutEffect(showNav, [locationKey]);
}
