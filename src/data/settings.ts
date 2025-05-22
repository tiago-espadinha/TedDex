import { useCallback, useState } from 'react';

/** Small persisted preferences (per device). */
function usePref<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) ?? fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [value, set] as const;
}

export type SpriteStyle = 'sprite' | 'art';
export const useSpriteStyle = () => usePref<SpriteStyle>('sprite-style', 'sprite');

export type Theme = 'system' | 'light' | 'dark';
export const useTheme = () => usePref<Theme>('theme', 'system');

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Design B is a dark-only look on the same layout; it overrides the theme while on. */
export type Design = 'a' | 'b';
export const useDesign = () => usePref<Design>('design', 'a');

export function applyDesign(design: Design) {
  const root = document.documentElement;
  if (design === 'b') root.setAttribute('data-design', 'b');
  else root.removeAttribute('data-design');
}
