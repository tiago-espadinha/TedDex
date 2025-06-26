/**
 * Pure helpers for `scripts/build-league.ts`: read Bulbapedia's {{Party}} / {{Pokémon}} templates out of a
 * trainer page's raw wikitext. No I/O here, so the parsing is covered by tests/league.test.ts.
 */

/** One {{Pokémon}} template inside a party, as written on the page. */
export interface RawMember {
  ndex: number;
  pokemon: string;
  /** As written: "54", "61/69" or "{{tt|68|Easy Mode}}/{{tt|72|Normal Mode}}"; see `parseLevel`. */
  level: string;
  /** Sprite suffix such as "-Alola" or "-Shield"; empty when none. */
  form: string;
  /** "mega" or "tera" when the page marks it with an icon. */
  icon: string;
  ability: string;
  held: string;
  tera: string;
  gigantamax: boolean;
  moves: string[];
}

/** One {{Party}} … {{Party/end}} block with the headings it sits under (outermost first). */
export interface RawParty {
  headings: string[];
  game: string;
  caption: string;
  /** Bulbagarden Archives file name of the trainer sprite, e.g. "Spr B2W2 Shauntal.png"; empty when none. */
  sprite: string;
  members: RawMember[];
}

const HEADING = /^(=+)\s*(.*?)\s*\1\s*$/;

/** `| key = value` fields of one template body; several fields may share a line (`| move1 = X | move1type = Y`). */
function fields(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    for (const part of line.slice(1).split(/\s\|\s*(?=\w+\s*=)/)) {
      const m = part.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/&nbsp;/g, ' ');
    }
  }
  return out;
}

/**
 * Lines of the template that opens at `start` (a line like `{{Pokémon`), up to its closing `}}` line.
 * Throws when another template starts first, so a template closed inline can't merge two members.
 */
function templateBody(lines: string[], start: number): { body: string[]; end: number } {
  let i = start + 1;
  while (i < lines.length && !/^\}\}\s*$/.test(lines[i])) {
    if (lines[i].startsWith('{{')) throw new Error(`Unclosed template at line ${start + 1}: ${lines[start]}`);
    i++;
  }
  return { body: lines.slice(start + 1, i), end: i };
}

function member(f: Record<string, string>): RawMember {
  return {
    ndex: Number(f.ndex),
    pokemon: f.pokemon ?? '',
    level: f.level ?? '',
    form: f.form ?? '',
    icon: f.icon ?? '',
    ability: f.ability ?? '',
    held: f.held ?? '',
    tera: f.tera ?? '',
    gigantamax: /gigantamax/i.test(f.max ?? ''),
    moves: [f.move1, f.move2, f.move3, f.move4].filter((m): m is string => !!m && m !== 'None'),
  };
}

/** Every party on a page, in page order. */
export function parseParties(wikitext: string): RawParty[] {
  // Some pages open a template mid-line ("Misty has three Full Restores.{{Party", "}}{{Pokémon"): give it its own line.
  const lines = wikitext.replace(/(?<=\S)\{\{(?=(?:Party|Pokémon)\s*$|Party\/end\}\})/gm, '\n{{').split('\n');
  const heads: string[] = [];
  const parties: RawParty[] = [];
  let party: RawParty | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(HEADING);
    if (h) {
      heads.length = h[1].length;
      heads[h[1].length - 1] = h[2];
      continue;
    }
    if (/^\{\{Party\s*$/.test(line)) {
      const { body, end } = templateBody(lines, i);
      const f = fields(body);
      party = {
        headings: heads.filter(Boolean),
        game: f.game ?? '',
        caption: f.caption ?? '',
        // A size may follow the name: "VSSteven.png{{!}}150px".
        sprite: (f.sprite ?? '').replace(/\{\{!\}\}.*$/, ''),
        members: [],
      };
      parties.push(party);
      i = end;
    } else if (/^\{\{Party\/end\}\}/.test(line)) {
      party = null;
    } else if (party && /^\{\{Pokémon\s*$/.test(line)) {
      const { body, end } = templateBody(lines, i);
      party.members.push(member(fields(body)));
      i = end;
    }
  }
  return parties;
}

/**
 * The level of the first league challenge. Pages write battle variants as `61/69` or with tooltips,
 * `{{tt|68|Easy Mode}}/{{tt|72|Normal Mode}}`: the tooltip whose label matches `prefer` wins, else the first number.
 */
export function parseLevel(raw: string, prefer = /Normal Mode/): number {
  for (const [, level, label] of raw.matchAll(/\{\{tt\|(\d+)\|([^}]*)\}\}/g)) {
    if (prefer.test(label)) return Number(level);
  }
  const first = raw.match(/\d+/);
  if (!first) throw new Error(`No level in "${raw}"`);
  return Number(first[0]);
}

/** Wiki markup to plain text: links, a few templates the pages use, bold/italics. */
export function plainText(wiki: string): string {
  return wiki
    .replace(/\{\{PlayerChoice\|\d+\|([^}|]+)\}\}/g, 'If you chose $1')
    .replace(/\{\{BlueEevee\|([^}|]+)\}\}/g, 'If his Eevee became $1')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{(?:g|game|pkmn|p)\|([^}|]+)(?:\|[^}]*)?\}\}/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercase letters and digits only, so "DoubleSlap", "Double Slap" and "Double-Slap" meet. */
export const nameKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
