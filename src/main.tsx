import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Outlet, RouterProvider, ScrollRestoration, createBrowserRouter, useLocation } from 'react-router-dom';
import { BottomNav, ToastProvider } from './components/bits';
import { applyDesign, applyTheme, type Design, type Theme } from './data/settings';
import { CompareScreen } from './screens/CompareScreen';
import { DetailScreen } from './screens/DetailScreen';
import { DexScreen } from './screens/DexScreen';
import { LeagueGameScreen, LeagueList } from './screens/LeagueScreens';
import { MoreScreen } from './screens/OtherScreens';
import { ReferenceEntry, ReferenceList, ReferenceScreen } from './screens/ReferenceScreens';
import { MemberEditor } from './screens/MemberEditor';
import { PokedexList, PokedexScreen } from './screens/PokedexScreens';
import { QuickView } from './screens/QuickView';
import { CoverageScreen, TeamEditor, TeamsScreen } from './screens/TeamScreens';
import './styles.css';

try {
  applyTheme((localStorage.getItem('theme') as Theme) ?? 'system');
  applyDesign((localStorage.getItem('design') as Design) ?? 'a');
} catch {
  /* storage unavailable */
}

/** Screens pushed on top of a tab hide the bottom nav, like a native stack. */
function Shell() {
  const { pathname } = useLocation();
  const pushed =
    pathname.startsWith('/pokemon/') || pathname === '/compare' || /^\/teams\/\d+\/(coverage|member)/.test(pathname) || /^\/reference\/[^/]+\/./.test(pathname);
  const main = useRef<HTMLElement>(null);
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
      <ScrollRestoration getKey={(loc) => loc.pathname + loc.search} />
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
      { path: '/teams/pokedex/:id', element: <PokedexScreen /> },
      { path: '/teams/:id', element: <TeamEditor /> },
      { path: '/teams/:id/member/:index', element: <MemberEditor /> },
      { path: '/teams/:id/coverage', element: <CoverageScreen /> },
      { path: '/reference', element: <ReferenceScreen /> },
      { path: '/reference/league', element: <LeagueList kind="league" /> },
      { path: '/reference/league/:game', element: <LeagueGameScreen kind="league" /> },
      { path: '/reference/gyms', element: <LeagueList kind="gyms" /> },
      { path: '/reference/gyms/:game', element: <LeagueGameScreen kind="gyms" /> },
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
