import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatNo } from '../../data/format';
import { typeTint } from '../../data/typeColors';
import type { IndexEntry } from '../../data/types';
import { MonName } from '../../components/MonName/MonName';
import { TypeChip } from '../../components/TypeChip/TypeChip';
import { MonImg } from '../../components/MonImg/MonImg';
import './LearnerTable.css';

/** Species linking to their detail pages, in dex order; sprites load as they scroll into view. */
/** Species that learn a move as aligned columns: number, sprite, name, types. */
export function LearnerTable({ title, ids, index }: { title: string; ids: number[]; index: IndexEntry[] }) {
  const byId = useMemo(() => new Map(index.map((m) => [m.id, m])), [index]);
  const mons = ids.map((id) => byId.get(id)).filter((m): m is IndexEntry => !!m);
  return (
    <section className="section ref-species">
      <h2>
        {title} · {mons.length}
      </h2>
      <div className="learner-head" aria-hidden="true">
        <span>No.</span>
        <span />
        <span>Pokémon</span>
        <span className="type">Type</span>
      </div>
      <ul className="learner-table">
        {mons.map((m) => (
          <li key={m.id}>
            <Link className="learner-row" to={`/pokemon/${m.id}`}>
              <span className="no">{formatNo(m.id)}</span>
              <MonImg
                id={m.id}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                style={{ backgroundColor: typeTint(m.types[0]) }}
              />
              <span className="name">
                <MonName name={m.name} />
              </span>
              <span className="types">
                {m.types.map((t) => (
                  <TypeChip key={t} type={t} />
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
