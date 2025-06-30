import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { showNav } from '../../../hooks/useNavHiding';

/** Game and trainer pages' scroll positions by URL: ScrollRestoration runs before their data has loaded. */
const savedScroll = new Map<string, number>();

/** Back to a game or trainer page returns to the same place on it, once `ready`. */
export function useRestoreScroll(ready: boolean) {
  const { pathname, search } = useLocation();
  const key = pathname + search;
  const back = useNavigationType() === 'POP';
  useLayoutEffect(() => {
    if (!ready) return;
    const saved = savedScroll.get(key);
    if (back && saved) {
      window.scrollTo({ top: saved });
      showNav();
    }
    return () => {
      savedScroll.set(key, window.scrollY);
    };
  }, [ready, key, back]);
}
