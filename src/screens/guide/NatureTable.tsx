import type { ReactNode } from 'react';
import { NATURES, STAT_ABBR, dislikedFlavor, flavorChip, likedFlavor, type Flavor } from '../../data/natures';
import { STAT_COLOR, typeChip } from '../../data/typeColors';
import { TableHead } from './TableHead';

const STAT_NAMES = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

/** A natures table cell: the stat or flavour as a coloured chip, or — for the neutral natures. */
function NatureCell({ text, color }: { text?: ReactNode; color?: string }) {
  return (
    <td>
      {text ? (
        <span className="fact-chip" style={{ backgroundColor: color }}>
          {text}
        </span>
      ) : (
        '—'
      )}
    </td>
  );
}

/** Stat names as a screen reader should say them. */
const STAT_SPOKEN = { atk: 'Attack', def: 'Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed' };

/** A raised or lowered stat, short so the five columns fit a phone, with its full name for screen readers. */
function NatureStat({ stat }: { stat?: keyof typeof STAT_NAMES }) {
  const text = stat && (
    <>
      <span aria-hidden="true">{STAT_ABBR[stat]}</span>
      <span className="sr-only">{STAT_SPOKEN[stat]}</span>
    </>
  );
  return <NatureCell text={text} color={stat && typeChip(STAT_COLOR[stat])} />;
}

function NatureFlavor({ flavor }: { flavor?: Flavor }) {
  return <NatureCell text={flavor} color={flavor && flavorChip(flavor)} />;
}

/** Every nature with the stat it raises and lowers and the flavours it likes and dislikes; neutral ones show —. */
export function NatureTable() {
  return (
    <>
      <TableHead title="Natures" sub={`${NATURES.length} natures · ±10% to one stat`} />
      <div className="ref-table natures">
        <table>
          <thead>
            <tr>
              <th scope="col">Nature</th>
              <th scope="col" className="up">
                Increased
              </th>
              <th scope="col" className="down">
                Decreased
              </th>
              <th scope="col" className="up">
                Likes
              </th>
              <th scope="col" className="down">
                Dislikes
              </th>
            </tr>
          </thead>
          <tbody>
            {NATURES.map((n) => (
              <tr key={n.name}>
                <th scope="row">{n.name}</th>
                <NatureStat stat={n.up} />
                <NatureStat stat={n.down} />
                <NatureFlavor flavor={likedFlavor(n)} />
                <NatureFlavor flavor={dislikedFlavor(n)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
