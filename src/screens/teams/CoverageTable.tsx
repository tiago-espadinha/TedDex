import type { CSSProperties, ReactNode } from 'react';
import type { CoverageRow } from '../../data/coverage';
import { formatMultiplier } from '../../data/format';
import type { MemberView } from '../../data/forms';
import { TypeChip } from '../../components/TypeChip/TypeChip';
import { MonImg } from '../../components/MonImg/MonImg';
import './CoverageTable.css';

export function CoverageTable<R extends CoverageRow>({
  mons,
  rows,
  lead,
  cell,
  last,
}: {
  mons: MemberView[];
  rows: R[];
  lead: string;
  cell: (m: number | null) => CSSProperties;
  last: LastColumn<R>;
}) {
  return (
    <div className="cov">
      <table>
        <thead>
          <tr>
            <th scope="col">{lead}</th>
            {mons.map((m, i) => (
              <th scope="col" key={i}>
                <MonImg id={m.mediaId} speciesId={m.speciesId} shiny={m.shiny} alt="" />
                <span className="sr-only">{m.name}</span>
              </th>
            ))}
            <th scope="col" style={{ textAlign: last.align }}>
              {last.label}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const [value, style] = last.cell(r);
            return (
              <tr key={r.type}>
                <td className="lead">
                  <TypeChip type={r.type} />
                </td>
                {r.mults.map((m, i) => (
                  <td key={i} style={cell(m)}>
                    {m === null ? '–' : formatMultiplier(m)}
                  </td>
                ))}
                <td className="count" style={{ ...style, textAlign: last.align }}>
                  {value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The table's last column: its header and each row's text and style. */
export interface LastColumn<R> {
  label: string;
  align: 'right' | 'center';
  cell: (row: R) => [ReactNode, CSSProperties];
}
