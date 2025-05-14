import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Outlet, RouterProvider, ScrollRestoration, createBrowserRouter, useLocation } from 'react-router-dom';
import { BottomNav, ToastProvider } from './components/bits';
import { applyTheme, type Theme } from './data/settings';
import { DetailScreen } from './screens/DetailScreen';
import { DexScreen } from './screens/DexScreen';
import { TeamEditor, TeamsScreen } from './screens/TeamScreens';
import './styles.css';

try {
  applyTheme((localStorage.getItem('theme') as Theme) ?? 'system');
} catch {
  /* storage unavailable */
}

/** Screens pushed on top of a tab hide the bottom nav, like a native stack. */
function Shell() {
  const { pathname } = useLocation();
  const pushed = pathname.startsWith('/pokemon/') || /^\/teams\/\d+\/coverage/.test(pathname);
  return (
    <ToastProvider>
      <div className={pushed ? 'app no-nav' : 'app'}>
        <Outlet />
      </div>
      {!pushed && <BottomNav />}
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
      { path: '/teams', element: <TeamsScreen /> },
      { path: '/teams/:id', element: <TeamEditor /> },
      { path: '*', element: <p className="empty">Page not found.</p> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
