import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../Icon/Icon';
import { showNav } from '../../hooks/useNavHiding';
import { playAnim } from '../playAnim';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Dex', icon: 'dex', end: true },
  { to: '/teams', label: 'Team', icon: 'team' },
  { to: '/reference', label: 'Guide', icon: 'book' },
  { to: '/more', label: 'Settings', icon: 'cog' },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="bottom-nav" aria-label="Main" onFocus={showNav}>
      <span className="nav-ink" aria-hidden="true" />
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          // A species page belongs to the Dex, like a move page to the Guide.
          className={({ isActive }) => (isActive || (n.to === '/' && pathname.startsWith('/pokemon/')) ? 'active' : '')}
          onClick={(e) => {
            if (!e.currentTarget.classList.contains('active')) playAnim(e.currentTarget, 'nav-bounce');
          }}
        >
          <span className="pill">
            <Icon name={n.icon} />
          </span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}
