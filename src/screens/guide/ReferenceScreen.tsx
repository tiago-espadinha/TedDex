import { Link } from 'react-router-dom';
import { itemSpriteUrl } from '../../data/api';
import { typeTint } from '../../data/typeColors';
import type { TypeName } from '../../data/types';
import { Icon } from '../../components/Icon/Icon';
import { KINDS, type Kind } from './guideEntries';

/** Menu look per kind: pixel-art sprites (a TM, Ability Capsule, Pomeg Berry, a Mint, Ultra Ball, Master Ball, Dowsing Machine, Rusted Sword over Shield). */
const MENU_LOOK: Record<Kind, { sprite: string; tint: TypeName }> = {
  moves: { sprite: '/media/guide/tm.webp', tint: 'psychic' },
  abilities: { sprite: itemSpriteUrl(685), tint: 'water' },
  items: { sprite: itemSpriteUrl(146), tint: 'fire' },
  natures: { sprite: '/media/guide/mint.webp', tint: 'grass' },
  gyms: { sprite: itemSpriteUrl(2), tint: 'electric' },
  league: { sprite: itemSpriteUrl(1), tint: 'poison' },
  compare: { sprite: itemSpriteUrl(465), tint: 'ice' },
  types: { sprite: '/media/guide/types.webp', tint: 'fighting' },
};

/** Landing rows: each section's sprite (`public/media/items/` or `guide/`) on a type tint. */
const MENU = KINDS.map((k) => ({ to: `/reference/${k.kind}`, title: k.title, blurb: k.blurb, ...MENU_LOOK[k.kind] }));

export function ReferenceScreen() {
  return (
    <>
      <header className="dex-head">
        <h1>Guide</h1>
      </header>
      <nav className="list ref-menu" aria-label="Guide">
        {MENU.map((m) => (
          <Link key={m.to} to={m.to} className="team-row ref-kind" style={{ backgroundColor: typeTint(m.tint) }}>
            <img className="ref-art" src={m.sprite} alt="" />
            <div>
              <div className="name">{m.title}</div>
              <div className="meta">{m.blurb}</div>
            </div>
            <Icon name="next" size={20} />
          </Link>
        ))}
      </nav>
    </>
  );
}
