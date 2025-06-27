/**
 * Pure helpers for `scripts/build-item-places.ts`: read the core-series acquisition table out of a Bulbapedia
 * item page's raw wikitext and turn its cells into plain text. No I/O here, so the parsing is covered by
 * tests/item-places.test.ts. Anything it cannot read (an unknown template or game code, leftover markup) throws.
 */

/** One game code of a `{{gameabbrevN|…}}` template: display label, chronological order, our version group ids. */
export interface GameCode {
  label: string;
  order: number;
  groups?: number[];
}

/** Codes per template suffix (`gameabbrev3`, `gameabbrevss`…), in release order; combined codes split into these. */
const CODES: Record<string, Record<string, Omit<GameCode, 'order'>>> = {
  1: {
    RGBY: { label: 'Red / Green / Blue / Yellow', groups: [1, 2] },
    RBY: { label: 'Red / Blue / Yellow', groups: [1, 2] },
    RB: { label: 'Red / Blue', groups: [1] },
    R: { label: 'Red', groups: [1] },
    G: { label: 'Green' },
    B: { label: 'Blue', groups: [1] },
    Y: { label: 'Yellow', groups: [2] },
  },
  2: {
    GSC: { label: 'Gold / Silver / Crystal', groups: [3, 4] },
    GS: { label: 'Gold / Silver', groups: [3] },
    G: { label: 'Gold', groups: [3] },
    S: { label: 'Silver', groups: [3] },
    C: { label: 'Crystal', groups: [4] },
  },
  3: {
    RSE: { label: 'Ruby / Sapphire / Emerald', groups: [5, 6] },
    RS: { label: 'Ruby / Sapphire', groups: [5] },
    R: { label: 'Ruby', groups: [5] },
    S: { label: 'Sapphire', groups: [5] },
    E: { label: 'Emerald', groups: [6] },
    FRLG: { label: 'FireRed / LeafGreen', groups: [7] },
    FR: { label: 'FireRed', groups: [7] },
    LG: { label: 'LeafGreen', groups: [7] },
  },
  4: {
    DPPt: { label: 'Diamond / Pearl / Platinum', groups: [8, 9] },
    DP: { label: 'Diamond / Pearl', groups: [8] },
    D: { label: 'Diamond', groups: [8] },
    P: { label: 'Pearl', groups: [8] },
    Pt: { label: 'Platinum', groups: [9] },
    HGSS: { label: 'HeartGold / SoulSilver', groups: [10] },
    HG: { label: 'HeartGold', groups: [10] },
    SS: { label: 'SoulSilver', groups: [10] },
  },
  5: {
    BW: { label: 'Black / White', groups: [11] },
    B2W2: { label: 'Black 2 / White 2', groups: [14] },
    B: { label: 'Black', groups: [11] },
    W: { label: 'White', groups: [11] },
    B2: { label: 'Black 2', groups: [14] },
    W2: { label: 'White 2', groups: [14] },
  },
  6: {
    XY: { label: 'X / Y', groups: [15] },
    X: { label: 'X', groups: [15] },
    Y: { label: 'Y', groups: [15] },
    ORAS: { label: 'Omega Ruby / Alpha Sapphire', groups: [16] },
    OR: { label: 'Omega Ruby', groups: [16] },
    AS: { label: 'Alpha Sapphire', groups: [16] },
  },
  7: {
    SM: { label: 'Sun / Moon', groups: [17] },
    S: { label: 'Sun', groups: [17] },
    M: { label: 'Moon', groups: [17] },
    USUM: { label: 'Ultra Sun / Ultra Moon', groups: [18] },
    US: { label: 'Ultra Sun', groups: [18] },
    UM: { label: 'Ultra Moon', groups: [18] },
    PE: { label: "Let's Go, Pikachu! / Let's Go, Eevee!", groups: [19] },
  },
  8: {
    SwSh: { label: 'Sword / Shield', groups: [20] },
    Sw: { label: 'Sword', groups: [20] },
    Sh: { label: 'Shield', groups: [20] },
    IA: { label: 'The Isle of Armor', groups: [20] },
    CT: { label: 'The Crown Tundra', groups: [20] },
    BDSP: { label: 'Brilliant Diamond / Shining Pearl', groups: [23] },
    BD: { label: 'Brilliant Diamond', groups: [23] },
    SP: { label: 'Shining Pearl', groups: [23] },
    LA: { label: 'Legends: Arceus', groups: [24] },
  },
  9: {
    SV: { label: 'Scarlet / Violet', groups: [25] },
    S: { label: 'Scarlet', groups: [25] },
    V: { label: 'Violet', groups: [25] },
    TM: { label: 'The Teal Mask', groups: [25] },
    ID: { label: 'The Indigo Disk', groups: [25] },
    ZA: { label: 'Legends: Z-A' },
    MD: { label: 'Mega Dimension' },
  },
  ss: {
    Stad: { label: 'Stadium' },
    Colo: { label: 'Colosseum', groups: [12] },
    XD: { label: 'XD: Gale of Darkness', groups: [13] },
    PW: { label: 'Pokéwalker' },
    PBR: { label: 'Battle Revolution' },
    Ranch: { label: 'My Pokémon Ranch' },
    DW: { label: 'Dream World' },
    PDR: { label: 'Dream Radar' },
    PMC: { label: 'Pokémon Mystery Club' },
    Champs: { label: 'Champions' },
    Champ: { label: 'Champions' },
  },
};

/** Chronological order across all codes: by generation, spin-offs placed after their era's main games. */
const ORDER: Record<string, number> = { 1: 10, 2: 20, 3: 30, ss: 0, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80, 9: 90 };
const SPIN_OFF_ORDER: Record<string, number> = {
  Stad: 15,
  Colo: 35,
  XD: 36,
  PW: 45,
  PBR: 46,
  Ranch: 47,
  DW: 55,
  PDR: 56,
  PMC: 85,
  Champs: 99,
  Champ: 99,
};

/** The game codes in one `{{gameabbrevN|…}}` value, longest first: "SMUSUMPE" → SM, USUM, PE. */
export function gameCodes(suffix: string, value: string): GameCode[] {
  const table = CODES[suffix];
  if (!table) throw new Error(`Unknown game template gameabbrev${suffix}`);
  const known = Object.keys(table).sort((a, b) => b.length - a.length);
  const out: GameCode[] = [];
  for (let rest = value; rest;) {
    const code = known.find((c) => rest.startsWith(c));
    if (!code) throw new Error(`Unknown game code "${value}" in gameabbrev${suffix}`);
    const order = (SPIN_OFF_ORDER[code] ?? ORDER[suffix]) + Object.keys(table).indexOf(code) / 100;
    out.push({ ...table[code], order });
    rest = rest.slice(code.length);
  }
  return out;
}

/** The game a PokeAPI version group belongs to when no table row names it (the code covering only that group). */
export function gameOfGroup(group: number): GameCode | undefined {
  for (const [suffix, table] of Object.entries(CODES)) {
    const code = Object.keys(table).find((c) => table[c].groups?.length === 1 && table[c].groups![0] === group);
    if (code) return gameCodes(suffix, code)[0];
  }
  return undefined;
}

/** Superscript notes that are not games: seasons (`sup/s`) and times of day (`sup/t`). */
const NOTES: Record<string, Record<string, string>> = {
  s: { Sp: 'Spring', Su: 'Summer', Au: 'Autumn', Wi: 'Winter' },
  t: { M: 'Morning', D: 'Day', N: 'Night' },
};

/** A superscript note such as `{{sup/3|E}}`: the game's (or season's) name when the code is known, else the code. */
function supLabel(suffix: string, value: string): string {
  if (NOTES[suffix]) return NOTES[suffix][value] ?? value;
  try {
    return gameCodes(suffix, value)
      .map((g) => g.label)
      .join(', ');
  } catch {
    return value;
  }
}

const DAYS: Record<string, string> = {
  mo: 'Monday',
  tu: 'Tuesday',
  we: 'Wednesday',
  th: 'Thursday',
  fr: 'Friday',
  sa: 'Saturday',
  su: 'Sunday',
};
const first = (a: string[]) => a[0];
const display = (a: string[]) => a[1] ?? a[0];

/** How each template a table cell uses reads as text (MediaWiki ignores the case of the first letter). */
const TEMPLATES: Record<string, (args: string[]) => string> = {
  p: first,
  ga: first,
  tc: first,
  type: first,
  v2: first,
  gdis: first,
  tt: first,
  a: display,
  i: display,
  m: display,
  t: display,
  cat: display,
  si: display,
  ka: display,
  kal: display,
  ho: display,
  jo: display,
  al: display,
  un: display,
  pal: display,
  gal: display,
  pw: display,
  dwa: display,
  pkmn: (a) => a[1] ?? `Pokémon ${a[0]}`,
  pkmn2: (a) => a[1] ?? `${a[0]} Pokémon`,
  b: (a) => `${a[0]} Berry`,
  berries: () => 'Berries',
  '2v2': (a) => [a[0], a[1]].map((v) => (a[2] ? `${v} ${a[2]}` : v)).join(' / '),
  game: (a) => a[2] ?? `Pokémon ${a[0]}`,
  game3: (a) => a[1],
  g: display,
  wp: display,
  hM: (a) => `HM${a[0]} (${a[1]})`,
  tP: (a) => `${a[0]}'s ${a[1]}`,
  form: (a) => `${a[0]} (${a[1]})`,
  steven: () => 'Steven',
  daisy: () => 'Daisy',
  rf: first,
  prof: (a) => `Professor ${a[0]}`,
  badge: (a) => `${a[0]} Badge`,
  rt: (a) => `Route ${a[0]}`,
  rtn: first,
  ci: (a) => `${a[0]} City`,
  to: (a) => `${a[0]} Town`,
  isl: first,
  safari: (a) => a[1] ?? 'Safari Zone',
  fB: (a) => a[2] ?? a[1],
  oBP: (a) => a[2] ?? a[0],
  dL: (a) => a[2] ?? a[1],
  wild: (a) => `wild ${a[0]}`,
  shadow: (a) => `Shadow ${a[0]}`,
  dotw: (a) => ` (${DAYS[a[0].toLowerCase().slice(0, 2)] ?? a[0]})`,
  watt: () => 'W',
  pDollar: () => '₽',
  player: () => 'the player',
  incomplete: () => '',
};

function template(body: string): string {
  const [rawName, ...rawArgs] = body.split('|');
  const name = rawName.trim();
  const args = rawArgs.filter((a) => !/^\s*\w+\s*=/.test(a)).map((a) => a.trim());
  const sup = name.match(/^[Ss]up\/(\w+)$/);
  if (sup) return ` (${supLabel(sup[1], args[0] ?? '')})`;
  const game = name.match(/^[Gg]ameabbrev(\w+)$/);
  if (game)
    return gameCodes(game[1], args[0] ?? '')
      .map((g) => g.label)
      .join(', ');
  const render = TEMPLATES[name] ?? TEMPLATES[name[0].toLowerCase() + name.slice(1)];
  if (!render) throw new Error(`Unknown template {{${name}}}`);
  return render(args);
}

/**
 * One table cell to plain text lines (one per `<br>`). Links keep their label, templates read as `TEMPLATES` says;
 * whatever markup is left after that throws, so a page the parser does not understand stops the build.
 */
export function cellLines(wiki: string): string[] {
  let text = wiki
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<sup>(\d+)<\/sup>\/<sub>(\d+)<\/sub>/g, '$1/$2')
    .replace(/<sup>([^<]*)<\/sup>/g, ' ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:small|span|b|i)\b[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ');
  for (let prev = ''; prev !== text;) {
    prev = text;
    text = text
      .replace(/\[\[(?:[^[\]{}|]*\|)?([^[\]{}|]*)\]\]/g, '$1')
      .replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => template(body));
  }
  text = text.replace(/'''?/g, '');
  if (/[{}[\]|]|<\/?(?:sup|sub|span|small|br|ref|div|b|i|u|s|nowiki|abbr)\b/.test(text))
    throw new Error(`Unreadable markup: ${text.trim().slice(0, 80)}`);
  return text
    .split('\n')
    .map((l) =>
      l
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.)])/g, '$1')
        .trim(),
    )
    .filter(Boolean);
}

/**
 * One row of the acquisition table: its games (empty when the row names none), one-time and repeatable ways.
 * A section written as prose instead of a table becomes one row with only `note`.
 */
export interface AcquisitionRow {
  games: GameCode[];
  once: string[];
  repeat: string[];
  note?: string[];
}

/** The text between the first `Acquisition` heading of the core-series part of the page and the next heading. */
function acquisitionSection(wikitext: string): string | null {
  const core = wikitext.split(/^==\s*In the core series games\s*==\s*$/m);
  const part = (core.length > 1 ? core[1] : wikitext).split(/^==[^=].*==\s*$/m)[0];
  const head = part.match(/^(={3,})\s*Acquisition\s*\1\s*$/m);
  if (!head) return null;
  return part.slice(head.index! + head[0].length).split(/^={2,}[^=]/m)[0];
}

/** Cells of the table rows (split on `|-`), each cell's text joined across its continuation lines. */
function rows(table: string): string[][] {
  const out: string[][] = [];
  for (const block of table.split(/^\|-.*$/m).slice(1)) {
    const cells: string[] = [];
    for (const line of block.split('\n')) {
      if (/^\|\}/.test(line)) break;
      // Like MediaWiki, text before a lone `|` that holds no link or template is the cell's attributes (or a typo).
      if (line.startsWith('|')) cells.push(line.slice(1).replace(/^[^|[\]{}]*\|(?!\|)/, ''));
      else if (cells.length && line.trim()) cells[cells.length - 1] += `\n${line}`;
    }
    if (cells.length) out.push(cells);
  }
  return out;
}

/**
 * The page's core-series acquisition table, or null when the page has none (a list page, a disambiguation).
 * Item tables have three columns (games, finite and repeatable methods); key item tables have two.
 */
export function parseAcquisition(wikitext: string): AcquisitionRow[] | null {
  const section = acquisitionSection(wikitext);
  if (section === null) return null;
  const head = section.match(/\{\{ItemAvailability\/(head|keyhead)\|[^}]*\}\}/);
  if (!head) {
    const prose = cellLines(section.replace(/^\{\{Incomplete[^}]*\}\}$/gm, ''));
    return prose.length ? [{ games: [], once: [], repeat: [], note: prose }] : null;
  }
  const columns = head[1] === 'head' ? 3 : 2;
  return rows(section.slice(head.index! + head[0].length)).map((cells) => {
    while (cells.length > columns && !cells[cells.length - 1].trim()) cells.pop();
    if (cells.length > columns) throw new Error(`Row with ${cells.length} cells: ${cells.join(' | ').slice(0, 80)}`);
    const games = [...cells[0].matchAll(/\{\{[Gg]ameabbrev(\w+)\|([^}|]+)/g)].flatMap(([, suffix, value]) =>
      gameCodes(suffix, value),
    );
    return { games, once: cellLines(cells[1] ?? ''), repeat: columns === 3 ? cellLines(cells[2] ?? '') : [] };
  });
}
