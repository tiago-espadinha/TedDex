import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatNo } from '../../data/format';
import { typeTint } from '../../data/typeColors';
import type { IndexEntry } from '../../data/types';
import { MonName } from '../../components/MonName/MonName';
import { TypeChip } from '../../components/TypeChip/TypeChip';
import { MonImg } from '../../components/MonImg/MonImg';
import './SpeciesList.css';

export function SpeciesList({
  title,
  ids,
  index,
  none,
}: {
  title: string;
  ids: number[];
  index: IndexEntry[];
  none: string;
}) {
  const byId = useMemo(() => new Map(index.map((m) => [m.id, m])), [index]);
  const mons = ids.map((id) => byId.get(id)).filter((m): m is IndexEntry => !!m);
  return (
    <section className="section ref-species">
      <h2>
        {title} · {mons.length}
      </h2>
      {!mons.length ? (
        <p className="hint">{none}</p>
      ) : (
        <ul className="evo-list">
          {mons.map((m) => (
            <li key={m.id}>
              <Link className="evo-member" to={`/pokemon/${m.id}`}>
                <MonImg
                  id={m.id}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  style={{ backgroundColor: typeTint(m.types[0]) }}
                />
                <span className="body">
                  <span className="name">
                    <span className="no">{formatNo(m.id)}</span> <MonName name={m.name} />
                  </span>
                  <span className="types">
                    {m.types.map((t) => (
                      <TypeChip key={t} type={t} />
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
