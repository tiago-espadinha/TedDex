import { useEffect } from 'react';

/**
 * While an input has focus, keeps `--kb-inset` (how much of the layout viewport's bottom the
 * on-screen keyboard covers) and `--vv-top` (how far iOS has panned the visible area down) on the
 * root, so sheets sit above the keyboard and the pinned search stays in view. Both are 0 otherwise,
 * and stay 0 where the keyboard shrinks the layout viewport itself (desktop, Firefox on Android). Once, in the shell.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const update = () => {
      const typing = document.activeElement instanceof HTMLInputElement;
      root.setProperty(
        '--kb-inset',
        `${typing ? Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)) : 0}px`,
      );
      root.setProperty('--vv-top', `${typing ? Math.round(vv.offsetTop) : 0}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    addEventListener('focusin', update);
    addEventListener('focusout', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      removeEventListener('focusin', update);
      removeEventListener('focusout', update);
    };
  }, []);
}
