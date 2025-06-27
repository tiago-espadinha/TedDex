import { memo } from 'react';
import { DEX_STATE_LABELS, nextState, type DexState } from '../../data/pokedex';
import { Icon } from '../../components/Icon/Icon';
import { MonName } from '../../components/MonName/MonName';
import { playAnim } from '../../components/playAnim';
import { MonImg } from '../../components/MonImg/MonImg';
import './DexCellButton.css';

/** Not-seen cells show the number in the view, the others the name; shiny cells show the shiny image. */
export const DexCellButton = memo(function DexCellButton({
  id,
  no,
  name,
  state,
  onTap,
}: {
  id: number;
  no: string;
  name: string;
  state: DexState;
  onTap: (id: number) => void;
}) {
  return (
    <li>
      <button
        className={`dex-cell s${state}`}
        aria-label={`${state ? `${no} ${name}` : no}, ${DEX_STATE_LABELS[state].toLowerCase()}. Tap for ${DEX_STATE_LABELS[nextState(state)].toLowerCase()}`}
        onClick={(e) => {
          playAnim(e.currentTarget, 'cell');
          onTap(id);
        }}
      >
        <MonImg id={id} shiny={state === 3} alt="" loading="lazy" width={72} height={72} />
        <span className="no">{state ? <MonName name={name} /> : no}</span>
        {state >= 2 && (
          <span className="badge">
            <Icon name={state === 3 ? 'star' : 'ball'} size={16} />
          </span>
        )}
      </button>
    </li>
  );
});
