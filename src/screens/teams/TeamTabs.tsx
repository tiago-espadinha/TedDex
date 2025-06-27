import { NavLink } from 'react-router-dom';
import { useSegmentSlide } from '../../hooks/useSegmentSlide';

/** The Team tab's two lists. */
export function TeamTabs() {
  const ref = useSegmentSlide<HTMLElement>('team-tabs');
  return (
    <nav ref={ref} className="segmented team-tabs" aria-label="Lists">
      <NavLink to="/teams" end>
        Teams
      </NavLink>
      <NavLink to="/teams/pokedex" end>
        Pokédex
      </NavLink>
    </nav>
  );
}
