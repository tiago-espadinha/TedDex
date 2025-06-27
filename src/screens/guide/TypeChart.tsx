import { Link } from 'react-router-dom';
import { defensiveMultipliers, offensiveMultipliers } from '../../data/api';
import type { TypeData, TypeName } from '../../data/types';
import { TypeChip } from '../../components/TypeChip/TypeChip';

const ATTACK_GROUPS = [
  { label: 'Super effective against', test: (m: number) => m > 1 },
  { label: 'Not very effective against', test: (m: number) => m > 0 && m < 1 },
  { label: 'No effect on', test: (m: number) => m === 0 },
];

const DEFEND_GROUPS = [
  { label: 'Weak to', test: (m: number) => m > 1 },
  { label: 'Resists', test: (m: number) => m > 0 && m < 1 },
  { label: 'Immune to', test: (m: number) => m === 0 },
];

export function TypeChart({ type, data }: { type: TypeName; data: TypeData }) {
  const sides = [
    { title: 'Attacking', mult: offensiveMultipliers([type], data), groups: ATTACK_GROUPS },
    { title: 'Defending', mult: defensiveMultipliers([type], data), groups: DEFEND_GROUPS },
  ];
  return sides.map((side) => (
    <div className="section" key={side.title}>
      <h2>{side.title}</h2>
      {side.groups.map((g) => {
        const hits = data.types.filter((t) => g.test(side.mult[t]));
        if (!hits.length) return null;
        return (
          <div className="eff-group" key={g.label}>
            <h3>{g.label}</h3>
            <div className="chip-wrap">
              {hits.map((t) => (
                <Link key={t} to={`/reference/types/${t}`} className="chip-link">
                  <TypeChip type={t} large />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  ));
}
