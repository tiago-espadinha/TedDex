import type { KeyboardEvent } from 'react';
import { ART_STYLE_EXAMPLE } from '../../data/dexState';
import { useSpriteStyle, type SpriteStyle } from '../../data/settings';
import { Icon } from '../../components/Icon/Icon';
import { MonImg } from '../../components/MonImg/MonImg';

const ART_STYLES: [SpriteStyle, string][] = [
  ['sprite', 'Sprites'],
  ['art', 'Artwork'],
];

/** The Dex images choice: a tile per style, each drawing the example in its own style whichever is chosen. */
export function ArtStyleTiles() {
  const [chosen, setChosen] = useSpriteStyle();

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const other = ART_STYLES.findIndex(([style]) => style !== chosen);
    setChosen(ART_STYLES[other][0]);
    (e.currentTarget.children[other] as HTMLElement).focus();
  }

  return (
    <div className="form-tiles" role="radiogroup" aria-labelledby="art-style-head" onKeyDown={onKeyDown}>
      {ART_STYLES.map(([style, label]) => {
        const on = style === chosen;
        return (
          <button
            key={style}
            type="button"
            className="form-tile"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => setChosen(style)}
          >
            <span className="tick" aria-hidden="true">
              {on && <Icon name="check" size={14} />}
            </span>
            <MonImg id={ART_STYLE_EXAMPLE} look={style} alt="" width={64} height={64} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
