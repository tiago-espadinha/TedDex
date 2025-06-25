import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { GOD_MODE_KEY } from './db';
import { DEFAULT_FORM_KINDS, parseFormKinds } from './dexState';
import { parseGamePref, type GamePref } from './game';
import type { FormKind } from './types';

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

const gameListeners = new Set<() => void>();
let game: GamePref = (() => {
  try {
    return parseGamePref(localStorage.getItem('game'));
  } catch {
    return 'latest';
  }
})();
function setGame(value: GamePref) {
  game = value;
  try {
    localStorage.setItem('game', String(value));
  } catch {
    /* ignore */
  }
  gameListeners.forEach((l) => l());
}
function subscribeGame(listener: () => void) {
  gameListeners.add(listener);
  return () => gameListeners.delete(listener);
}
/**
 * The chosen game, shared live by every screen that shows it (Moves, Locations, the member editor's move filter), so
 * picking one moves the others too.
 */
export const useGame = () => [useSyncExternalStore(subscribeGame, () => game), setGame] as const;

const godModeListeners = new Set<() => void>();
function readGodMode() {
  try {
    return localStorage.getItem(GOD_MODE_KEY) === 'on';
  } catch {
    return false;
  }
}
function setGodMode(on: boolean) {
  try {
    if (on) localStorage.setItem(GOD_MODE_KEY, 'on');
    else localStorage.removeItem(GOD_MODE_KEY);
  } catch {
    /* ignore */
  }
  godModeListeners.forEach((l) => l());
}
function subscribeGodMode(listener: () => void) {
  godModeListeners.add(listener);
  return () => godModeListeners.delete(listener);
}
/**
 * God mode: the member editor offers any move and any ability for every member. One device-wide choice, read on every
 * render so the value Dexie's upgrade may write while the editor loads shows up.
 */
export const useGodMode = () => [useSyncExternalStore(subscribeGodMode, readGodMode), setGodMode] as const;

export type SpriteStyle = 'sprite' | 'art';
const spriteStyleListeners = new Set<() => void>();
let spriteStyle: SpriteStyle = (() => {
  try {
    return localStorage.getItem('sprite-style') === 'art' ? 'art' : 'sprite';
  } catch {
    return 'sprite';
  }
})();
function setSpriteStyle(value: SpriteStyle) {
  spriteStyle = value;
  try {
    localStorage.setItem('sprite-style', value);
  } catch {
    /* ignore */
  }
  spriteStyleListeners.forEach((l) => l());
}
function subscribeSpriteStyle(listener: () => void) {
  spriteStyleListeners.add(listener);
  return () => spriteStyleListeners.delete(listener);
}
/** Sprites or artwork for every Pokémon image, read once and shared live by every image on screen. */
export const useSpriteStyle = () => [useSyncExternalStore(subscribeSpriteStyle, () => spriteStyle), setSpriteStyle] as const;

/** The Dex as a grid of cards or a dense list of rows. */
export type DexView = 'grid' | 'list';
export const useDexView = () => usePref<DexView>('dex-view', 'grid');

/** The form kinds the Dex shows as rows of their own; all but Gigantamax until a choice is stored ('' when all are off). */
export function useDexForms() {
  const [raw, setRaw] = usePref<string>('dex-forms', DEFAULT_FORM_KINDS.join(','));
  const kinds = useMemo(() => parseFormKinds(raw), [raw]);
  const set = useCallback((next: FormKind[]) => setRaw(next.join(',')), [setRaw]);
  return [kinds, set] as const;
}

export type Theme = 'system' | 'light' | 'dark';
export const useTheme = () => usePref<Theme>('theme', 'system');

/** iOS and Android paint the status bar / browser toolbar from theme-color: keep it on the page background. */
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  // index.html has one tag per colour scheme for the first paint; a chosen theme or design overrides both.
  if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg));
}

// Follow the OS switching between light and dark while the theme is 'system'.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  syncThemeColor();
}

/** Design B is a dark-only look on the same layout; it overrides the theme while on. */
export type Design = 'a' | 'b';
export const useDesign = () => usePref<Design>('design', 'a');

export function applyDesign(design: Design) {
  const root = document.documentElement;
  if (design === 'b') root.setAttribute('data-design', 'b');
  else root.removeAttribute('data-design');
  syncThemeColor();
}
