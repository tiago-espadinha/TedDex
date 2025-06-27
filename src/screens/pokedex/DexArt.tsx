import { dexSpriteUrl } from '../../data/api';
import { Icon } from '../../components/Icon/Icon';
import './DexArt.css';

/** A game's Pokédex art; the national dex gets the Pokédex icon. */
export function DexArt({ game }: { game?: number }) {
  return (
    <span className="dex-art" aria-hidden="true">
      {game !== undefined ? (
        <img src={dexSpriteUrl(game)} alt="" width={80} height={80} />
      ) : (
        <Icon name="dex" size={40} />
      )}
    </span>
  );
}
