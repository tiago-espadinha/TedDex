/** The lists whose search takes operators and keywords (query.ts). */
export type HintList = 'dex' | 'moves' | 'items';

type SearchHints = {
  keywords: { label: string; words: string[]; note?: string }[];
  examples: { query: string; meaning: string }[];
};

export const SEARCH_OPERATORS = [
  { sign: '&', meaning: 'Both match' },
  { sign: '|', meaning: 'Either matches' },
  { sign: '!', meaning: 'Not this' },
  { sign: '( )', meaning: 'Group' },
];

const ANY_TYPE = { label: 'Type', words: ['fire', 'ice'], note: 'or any other type' };

/** Every word and example here is run against its list in tests/data/search-hints.test.ts. */
export const SEARCH_HINTS: Record<HintList, SearchHints> = {
  dex: {
    keywords: [
      { label: 'Number', words: ['25', '#25'] },
      ANY_TYPE,
      { label: 'Generation', words: ['gen 3'], note: '1 to 9' },
      {
        label: 'Category',
        words: [
          'favourite',
          'starter',
          'mega',
          'fossil',
          'eeveelution',
          'legendary',
          'mythical',
          'regional',
          'baby',
          'paradox',
          'stone',
        ],
      },
    ],
    examples: [
      { query: 'fire & flying', meaning: 'Fire and Flying at once' },
      { query: 'grass & !poison', meaning: 'Grass, but not Poison' },
      { query: '(fire | water) & gen 1', meaning: 'Fire or Water from Gen 1' },
      { query: 'legendary & !dragon', meaning: "Legendaries that aren't Dragon" },
    ],
  },
  moves: {
    keywords: [ANY_TYPE, { label: 'Category', words: ['physical', 'special', 'status'] }],
    examples: [
      { query: 'fire & special', meaning: 'Special Fire moves' },
      { query: 'physical & !normal', meaning: 'Physical moves, but not Normal' },
      { query: '(fire | ice) & punch', meaning: 'Fire or Ice moves named Punch' },
      { query: 'thunder punch | surf', meaning: 'Either of these two moves' },
    ],
  },
  items: {
    keywords: [
      {
        label: 'Category',
        words: [
          'berry',
          'balls',
          'medicine',
          'battle',
          'held',
          'mega stone',
          'z-crystal',
          'plate',
          'memory',
          'jewel',
          'tera shard',
          'evolution',
          'tm',
          'mail',
          'key',
          'treasure',
          'ingredient',
          'other',
        ],
      },
    ],
    examples: [
      { query: 'mega stone & char', meaning: 'Mega Stones named Char' },
      { query: 'balls & !(great | ultra)', meaning: 'Poké Balls, but not Great or Ultra' },
      { query: 'plate | jewel', meaning: 'Plates or Jewels' },
      { query: 'medicine & potion', meaning: 'Medicine named Potion' },
    ],
  },
};
