import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Outlet, RouterProvider, ScrollRestoration, createBrowserRouter, useLocation, type Location } from 'react-router-dom';
import { BottomNav, ToastProvider, useKeyboardInset } from './components/bits';
import { isPicking } from './data/dexState';
import { applyDesign, applyTheme, type Design, type Theme } from './data/settings';
import { warmSprites } from './data/spriteCache';
import { CompareScreen } from './screens/CompareScreen';
import { DetailScreen } from './screens/DetailScreen';
import { DexScreen } from './screens/DexScreen';
import { LeagueGameScreen, LeagueList, TrainerCoverageScreen, TrainerScreen } from './screens/LeagueScreens';
import { MoreScreen } from './screens/OtherScreens';
import { EggGroupEntry, ReferenceEntry, ReferenceList, ReferenceScreen } from './screens/ReferenceScreens';
import { MemberEditor } from './screens/MemberEditor';
import { NewPokedex, PokedexList, PokedexScreen } from './screens/PokedexScreens';
import { QuickView } from './screens/QuickView';
import { EditPokedexSpecies, NewCustomPokedex } from './screens/SpeciesPicker';
import { CoverageScreen, TeamEditor, TeamsScreen } from './screens/TeamScreens';
import './styles.css';

try {
  applyTheme((localStorage.getItem('theme') as Theme) ?? 'system');
  applyDesign((localStorage.getItem('design') as Design) ?? 'a');
} catch {
  /* storage unavailable */
}

/** Dex pick mode (adding to a team, a Compare side), pushed over the screen that opened it. */
const isPickMode = (loc: { pathname: string; search: string }) => loc.pathname === '/' && isPicking(new URLSearchParams(loc.search));

/** Each pick starts at the top, like its empty search; other screens restore their scroll by path and search. */
const scrollKey = (loc: Location) => (isPickMode(loc) ? loc.key : loc.pathname + loc.search);

/** Screens pushed on top of a tab hide the bottom nav, like a native stack. */
function Shell() {
  const location = useLocation();
  const { pathname } = location;
  const pushed =
    isPickMode(location) ||
    pathname.startsWith('/pokemon/') || pathname === '/compare' || /^\/teams\/\d+\/(coverage|member)/.test(pathname) || /^\/reference\/[^/]+\/./.test(pathname);
  const main = useRef<HTMLElement>(null);
  useKeyboardInset();
  // When navigation removes the focused control, start keyboard and screen reader users at the
  // top of the new screen. Controls that survive (prev/next on detail) keep focus.
  useEffect(() => {
    const at = document.activeElement;
    if (!at || at === document.body || !at.isConnected) main.current?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <ToastProvider>
      <main ref={main} tabIndex={-1} className={pushed ? 'app no-nav' : 'app'}>
        <Outlet />
      </main>
      {!pushed && <BottomNav />}
      <QuickView />
      <ScrollRestoration getKey={scrollKey} />
    </ToastProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <DexScreen /> },
      { path: '/pokemon/:id', element: <DetailScreen /> },
      { path: '/compare', element: <CompareScreen /> },
      { path: '/teams', element: <TeamsScreen /> },
      { path: '/teams/pokedex', element: <PokedexList /> },
      { path: '/teams/pokedex/new', element: <NewPokedex /> },
      { path: '/teams/pokedex/new/custom', element: <NewCustomPokedex /> },
      { path: '/teams/pokedex/:id', element: <PokedexScreen /> },
      { path: '/teams/pokedex/:id/edit', element: <EditPokedexSpecies /> },
      { path: '/teams/:id', element: <TeamEditor /> },
      { path: '/teams/:id/member/:index', element: <MemberEditor /> },
      { path: '/teams/:id/coverage', element: <CoverageScreen /> },
      { path: '/reference', element: <ReferenceScreen /> },
      { path: '/reference/league', element: <LeagueList kind="league" /> },
      { path: '/reference/league/:game', element: <LeagueGameScreen kind="league" /> },
      { path: '/reference/gyms', element: <LeagueList kind="gyms" /> },
      { path: '/reference/gyms/:game', element: <LeagueGameScreen kind="gyms" /> },
      { path: '/reference/league/:game/:trainer', element: <TrainerScreen kind="league" /> },
      { path: '/reference/gyms/:game/:trainer', element: <TrainerScreen kind="gyms" /> },
      { path: '/reference/league/:game/:trainer/coverage', element: <TrainerCoverageScreen kind="league" /> },
      { path: '/reference/gyms/:game/:trainer/coverage', element: <TrainerCoverageScreen kind="gyms" /> },
      { path: '/reference/egg-groups/:group', element: <EggGroupEntry /> },
      { path: '/reference/:kind', element: <ReferenceList /> },
      { path: '/reference/:kind/:id', element: <ReferenceEntry /> },
      { path: '/more', element: <MoreScreen /> },
      { path: '*', element: <p className="empty">Page not found.</p> },
    ],
  },
]);

// Screen changes animate with the View Transitions API (no-op where unsupported). Wrapping navigate
// covers every <Link> and navigate() call; only path changes animate, so typing in a search box
// (search params) doesn't, and Back replays the transition of the forward step.
const navigate = router.navigate;
router.navigate = ((to: Parameters<typeof navigate>[0], opts?: Parameters<typeof navigate>[1]) => {
  if (typeof to === 'number') return navigate(to);
  const path = typeof to === 'string' ? new URL(to, location.href).pathname : to?.pathname;
  return navigate(to, { ...opts, viewTransition: opts?.viewTransition ?? (path != null && path !== location.pathname) });
}) as typeof navigate;

// Back replays a transition into any path that ever animated, even when only the search changes (closing the
// quick view). Skip those: nothing visible changes, and a running transition swallows taps.
let shownPath = location.pathname;
let previousPath = shownPath;
let shownLocation = router.state.location;
router.subscribe((state) => {
  // Only location changes count: loading and fetcher updates would make every path look unchanged.
  if (state.location === shownLocation) return;
  shownLocation = state.location;
  previousPath = shownPath;
  shownPath = state.location.pathname;
});
const startViewTransition = document.startViewTransition?.bind(document);
if (startViewTransition) {
  document.startViewTransition = ((arg: Parameters<typeof startViewTransition>[0]) => {
    const transition = startViewTransition(arg);
    if (previousPath === shownPath) {
      transition.ready.catch(() => {});
      transition.skipTransition();
    }
    return transition;
  }) as typeof document.startViewTransition;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// Fill the offline sprite cache once the first screen has loaded (see spriteCache.ts).
window.addEventListener('load', () => warmSprites().catch((err) => console.warn('Sprite warm-up stopped:', err)), { once: true });
