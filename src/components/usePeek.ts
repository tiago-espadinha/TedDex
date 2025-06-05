import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { peekValue, type Peek } from '../data/peek';

/**
 * Opens the quick view (`QuickView` in src/screens) over the current screen. It is a history entry, so Back
 * closes it; scroll stays put.
 */
export function usePeek() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (peek: Peek) =>
      setParams(
        (p) => {
          p.set('peek', peekValue(peek));
          return p;
        },
        { preventScrollReset: true, state: { peek: true } },
      ),
    [setParams],
  );
}
