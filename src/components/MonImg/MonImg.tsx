import { useState, type ImgHTMLAttributes } from 'react';
import { monImageChain } from '../../data/api';
import { useSpriteStyle, type SpriteStyle } from '../../data/settings';

/**
 * A Pokémon's sprite or artwork, as the Settings sprite style chooses, or `look` for the Settings tiles that preview
 * each style, plain or `shiny`. A failed load moves down `monImageChain` (`onArtworkFail` is told when artwork failed):
 * artwork that was never viewed isn't cached offline, and some forms have no file of their own (Mega Zygarde).
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
  const chain = monImageChain({ id, speciesId, art: (look ?? spriteStyle) === 'art', shiny });
  // The fallback step belongs to the first URL, so a reused element starts over when it shows another Pokémon.
  const [failed, setFailed] = useState({ src: '', at: 0 });
  const at = failed.src === chain[0] ? failed.at : 0;
  const isArt = chain[at].startsWith('/media/artwork/');
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
