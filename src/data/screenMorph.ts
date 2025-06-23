/**
 * Shared elements of a screen change. A row and the page it opens both carry `data-morph` set to that page's path,
 * with no `view-transition-name` in the markup: the names go on the one row and header involved, just before each
 * snapshot, and come off afterwards. A list of any length can't hold a duplicate, which would skip the transition.
 */

export type ScreenDirection = 'forward' | 'back' | 'tab';

export interface ScreenPlace {
  pathname: string;
  /** Dex pick mode: `/` as a pushed screen, not the Dex tab. */
  picking?: boolean;
}

const TAB_PATHS = new Set(['/', '/teams', '/teams/pokedex', '/reference', '/more']);
const isTab = (p: ScreenPlace) => !p.picking && TAB_PATHS.has(p.pathname);

/** `delta` is the history step of a Back or Forward (0 for a link), since a Back link pushes rather than pops. */
export function screenDirection(from: ScreenPlace, to: ScreenPlace, delta = 0): ScreenDirection {
  if (isTab(from) && isTab(to)) return 'tab';
  if (delta !== 0) return delta < 0 ? 'back' : 'forward';
  if (from.pathname.startsWith(`${to.pathname}/`)) return 'back';
  return isTab(to) ? 'tab' : 'forward';
}

/** How long a screen change waits for its page's header to load before going ahead without the morph. */
const WAIT_MS = 150;

/** The parts that move on their own, inside a `data-morph` element. */
const PARTS: [name: string, selector: string][] = [
  ['morph-title', '.name, h1, h2'],
  ['morph-sub', '.dex-row .meta, .dex-title .sub'],
  ['morph-art', '.item-sprite, .item-art'],
];

let named: HTMLElement[] = [];

export function clearNames() {
  for (const el of named) el.style.viewTransitionName = '';
  named = [];
}

function setName(el: Element | null, name: string) {
  if (!(el instanceof HTMLElement)) return;
  // Off screen it would fly in from nowhere; an element broken over two lines would skip the whole transition.
  const rects = el.getClientRects();
  if (rects.length !== 1 || rects[0].bottom < 0 || rects[0].top > innerHeight) return;
  el.style.viewTransitionName = name;
  named.push(el);
}

/** The last match, so an open quick view wins over the list row behind it. */
function find(path: string) {
  const all = document.querySelectorAll(`[data-morph="${CSS.escape(path)}"]`);
  return all[all.length - 1] ?? null;
}

function nameParts(root: Element, card: boolean) {
  if (card) setName(root, 'morph-card');
  for (const [name, selector] of PARTS) setName(root.querySelector(selector), name);
}

/**
 * Names the old screen's shared elements for `from` → `to`. The result, run after the new screen commits, names the
 * new screen's and resolves once they are in place. Call it right before `startViewTransition`.
 */
export function prepareMorph(from: string, to: string, direction: ScreenDirection): () => Promise<void> {
  clearNames();
  const none = () => Promise.resolve();
  if (direction === 'tab' || matchMedia('(prefers-reduced-motion: reduce)').matches) return none;
  // Opening: the row for the new path is on this screen. Going back: this page was opened from a row on its parent.
  const toParent = direction === 'back' && from.slice(0, from.lastIndexOf('/')) === to;
  const path = find(to) ? to : toParent ? from : undefined;
  const old = path ? find(path) : null;
  if (!path || !old) return none;
  const card = old.hasAttribute('data-morph-card');
  nameParts(old, card);
  document.documentElement.classList.add('vt-morph');

  return async () => {
    clearNames();
    const target = find(path) ?? (await waitFor(path));
    if (target) nameParts(target, card || target.hasAttribute('data-morph-card'));
  };
}

/** Rendering is paused during the update, but React still commits, so the new screen's header can arrive. */
function waitFor(path: string): Promise<Element | null> {
  return new Promise((resolve) => {
    const done = (el: Element | null) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    };
    const observer = new MutationObserver(() => {
      const el = find(path);
      if (el) done(el);
    });
    const timer = setTimeout(() => done(null), WAIT_MS);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-morph'] });
  });
}
