import { useState, type ImgHTMLAttributes } from 'react';
import { artworkUrl, shinySpriteUrl, spriteUrl } from '../data/api';
import { useSpriteStyle, type SpriteStyle } from '../data/settings';

/**
 * A Pokémon's sprite or artwork, as the Settings sprite style chooses, or `look` for the Settings tiles that preview
 * each style (`shiny` always takes the shiny sprite, since there is no shiny artwork). Artwork that was never viewed
 * isn't cached offline, so a failed load falls back to the precached sprite (`onArtworkFail` is told), then to the
 * species' sprite (`speciesId`) for a form without one (Mega Zygarde).
 */
export function MonImg({
  id,
  speciesId = id,
  shiny,
  look,
  onArtworkFail,
  style,
  ...img
}: { id: number; speciesId?: number; shiny?: boolean; look?: SpriteStyle; onArtworkFail?: () => void } & Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'id' | 'src' | 'onError'
>) {
  const [spriteStyle] = useSpriteStyle();
  const art = (look ?? spriteStyle) === 'art' && !shiny;
  const chain = [...new Set([...(art ? [artworkUrl(id)] : []), shiny ? shinySpriteUrl(id) : spriteUrl(id), spriteUrl(speciesId)])];
  // The fallback step belongs to the first URL, so a reused element starts over when it shows another Pokémon.
  const [failed, setFailed] = useState({ src: '', at: 0 });
  const at = failed.src === chain[0] ? failed.at : 0;
  const isArt = art && at === 0;
  return (
    <img
      {...img}
      src={chain[at]}
      style={{ ...style, imageRendering: isArt ? 'auto' : 'pixelated' }}
      onError={() => {
        if (at === chain.length - 1) return;
        if (isArt) onArtworkFail?.();
        setFailed({ src: chain[0], at: at + 1 });
      }}
    />
  );
}
