import type { CSSProperties } from 'react';

/**
 * Game colours are tokens in `src/styles.css` (`--game-<slug>`, in :root and Design B; Design A dark keeps the light
 * ones). Each carries white text (4.5:1, see tests/game-colors.test.ts). A label naming several games ("Red / Blue",
 * item places' "Sword / Shield / The Crown Tundra") gets one colour per game, DLC left out.
 */
export const GAME_SLUGS = [
  'red',
  'blue',
  'green',
  'yellow',
  'gold',
  'silver',
  'crystal',
  'ruby',
  'sapphire',
  'emerald',
  'firered',
  'leafgreen',
  'diamond',
  'pearl',
  'platinum',
  'heartgold',
  'soulsilver',
  'black',
  'white',
  'black-2',
  'white-2',
  'x',
  'y',
  'omega-ruby',
  'alpha-sapphire',
  'sun',
  'moon',
  'ultra-sun',
  'ultra-moon',
  'lets-go-pikachu',
  'lets-go-eevee',
  'sword',
  'shield',
  'brilliant-diamond',
  'shining-pearl',
  'legends-arceus',
  'scarlet',
  'violet',
  'colosseum',
  'xd-gale-of-darkness',
  'battle-revolution',
  'legends-z-a',
  'champions',
  'pokemon-mystery-club',
  'dream-radar',
  'dream-world',
  'my-pokemon-ranch',
  'pokewalker',
  'other',
] as const;

/** Expansions named in item places' labels; they take their base game's colours. */
const DLC = ['the-indigo-disk', 'the-teal-mask', 'the-crown-tundra', 'the-isle-of-armor', 'mega-dimension'];

/** "Let’s Go, Pikachu!" → "lets-go-pikachu", "Pokéwalker" → "pokewalker". */
export const gameSlug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const known = new Set<string>(GAME_SLUGS);

/** The colour tokens of a label's games, in order; 'other' when it names none we know. */
export function gameColors(label: string): string[] {
  const slugs = [...new Set(label.split(' / ').map(gameSlug))].filter((s) => !DLC.includes(s));
  const colours = slugs.filter((s) => known.has(s));
  return (colours.length ? colours : ['other']).map((s) => `var(--game-${s})`);
}

/** A background for the label's band: its colour, or a gradient through its games' colours. */
export function gameBand(label: string): string {
  const colours = gameColors(label);
  return colours.length === 1 ? colours[0] : `linear-gradient(${colours.join(', ')})`;
}

/** The style of a `.game-band` element for the label. */
export const bandStyle = (label: string) => ({ '--band': gameBand(label) }) as CSSProperties;
