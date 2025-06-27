import { Link } from 'react-router-dom';
import { loadTypes, useLoad } from '../../data/api';
import { cap, formatMultiplier } from '../../data/format';
import { typeChip } from '../../data/typeColors';
import type { TypeName } from '../../data/types';
import { Loading } from '../../components/Loading/Loading';
import { TableHead } from './TableHead';

/** Short column labels so 18 columns fit a phone with a little sideways scrolling. */
const TYPE_ABBR = (t: TypeName) => t.slice(0, 3).toUpperCase();

/** The full type chart: attacking type per row, defending type per column; blank cells are 1×. */
export function TypeMatrix() {
  const { data, error } = useLoad(loadTypes, 'types');
  return (
    <>
      <TableHead title="Types" sub="Attacking type down the side, defending along the top" />
      {error && <p className="empty">Couldn't load the type chart. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && (
        <div className="type-matrix" tabIndex={0} role="region" aria-label="Type chart">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Attacking ↓ / defending →</span>
                </th>
                {data.types.map((def) => (
                  <th scope="col" key={def}>
                    <abbr title={cap(def)} style={{ backgroundColor: typeChip(def) }}>
                      {TYPE_ABBR(def)}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.types.map((atk) => (
                <tr key={atk}>
                  <th scope="row">
                    <Link to={`/reference/types/${atk}`} style={{ backgroundColor: typeChip(atk) }}>
                      {cap(atk)}
                    </Link>
                  </th>
                  {data.types.map((def) => {
                    const m = data.matrix[atk][def] ?? 1;
                    return (
                      <td key={def} className={matchupClass(m)} aria-label={`${cap(atk)} on ${cap(def)}: ${m}×`}>
                        {formatMultiplier(m)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Attacking view, as in team coverage: super effective is good (green), resisted warm, immune grey. */
const matchupClass = (m: number) => (m > 1 ? 'super' : m === 0 ? 'immune' : m < 1 ? 'resisted' : undefined);
