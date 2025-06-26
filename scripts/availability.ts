/**
 * Pure helpers for `scripts/build-availability.ts`: read a species page's "Game locations" table and join its text to
 * PokeAPI's encounter rows. No I/O here, so tests/availability.test.ts covers it. Anything it cannot read throws.
 */
import { REGIONAL_FORM, hasOwnFormData } from '../src/data/forms';
import type { EncounterRow, EvolutionMember, Locations } from '../src/data/types';
import { cellLines } from './itemPlaces';

/** One way to get the species in one game. `forms` are the words of Bulbapedia's form tags ("Alolan"), empty without one. */
export interface AvailabilityLine {
  text: string;
  forms: string[];
  /** Only these of the region's forms, from a tag like "Paldean Form (Combat and Blaze Breeds)". */
  breeds?: string[];
}

/** Game (version) id → its lines; a game the species can't be had in has no entry. */
export type Availability = Record<number, AvailabilityLine[]>;

/** Bulbapedia's game names → our version ids. DLC names fold into their base games. */
const GAMES: Record<string, number[]> = {
  Red: [1], Blue: [2], Yellow: [3], Gold: [4], Silver: [5], Crystal: [6], Ruby: [7], Sapphire: [8], Emerald: [9], FireRed: [10], LeafGreen: [11],
  Diamond: [12], Pearl: [13], Platinum: [14], HeartGold: [15], SoulSilver: [16], Black: [17], White: [18], 'Black 2': [21], 'White 2': [22],
  X: [23], Y: [24], 'Omega Ruby': [25], 'Alpha Sapphire': [26], Sun: [27], Moon: [28], 'Ultra Sun': [29], 'Ultra Moon': [30],
  "Let's Go Pikachu": [31], "Let's Go Eevee": [32], Sword: [33], Shield: [34],
  'Expansion Pass': [33, 34], 'Sword Expansion Pass': [33], 'Shield Expansion Pass': [34],
  'Brilliant Diamond': [37], 'Shining Pearl': [38], 'Legends: Arceus': [39], Scarlet: [40], Violet: [41],
  'The Hidden Treasure of Area Zero': [40, 41], 'The Hidden Treasure of Area Zero (Scarlet)': [40], 'The Hidden Treasure of Area Zero (Violet)': [41],
  'The Teal Mask': [40, 41], 'The Indigo Disk': [40, 41],
};

/** Side games, facilities and games the app doesn't list. */
const LEFT_OUT = new Set(['Green', 'Colosseum', 'XD', 'Pal Park', 'Pokéwalker', 'Dream World', 'Legends: Z-A', 'Mega Dimension']);

/** Games PokeAPI has no encounters for, which only this table adds to games.json. */
export const ADDED_GAMES = [
  { id: 37, label: 'Brilliant Diamond', gen: 8, group: 23 },
  { id: 38, label: 'Shining Pearl', gen: 8, group: 23 },
  { id: 39, label: 'Legends: Arceus', gen: 8, group: 24 },
  { id: 40, label: 'Scarlet', gen: 9, group: 25 },
  { id: 41, label: 'Violet', gen: 9, group: 25 },
];

/** Region words of the forms we ship. */
const REGION_KEYS: Record<string, string> = { Alolan: 'alola', Galarian: 'galar', Hisuian: 'hisui', Paldean: 'paldea' };
/** "(Alolan Form)", "(Kantonian/Alolan Forms)", "(Paldean Form (Combat Breed))"; "(Amped/Low Key Form)" is no tag and stays as text. */
const FORM_TAG = /\s*\(([\w/]+) Forms?(?: \(([^)]*)\))?\)/g;
/** Region words for the form a species started in, which is the species itself. */
const HOME_REGIONS = new Set(['Kantonian', 'Johtonian', 'Hoennian', 'Sinnohan', 'Unovan', 'Kalosian']);

interface Template {
  name: string;
  params: Record<string, string>;
}

/** The top-level templates of `wiki`, in order; anything else there but table closers throws. */
function templates(wiki: string): Template[] {
  const out: Template[] = [];
  let at = 0;
  while (at < wiki.length) {
    const open = wiki.indexOf('{{', at);
    const between = wiki.slice(at, open < 0 ? undefined : open);
    if (between.replace(/\|\}/g, '').trim()) throw new Error(`Unexpected text in the table: ${between.trim().slice(0, 80)}`);
    if (open < 0) break;
    const end = closingBraces(wiki, open);
    out.push(template(wiki.slice(open + 2, end)));
    at = end + 2;
  }
  return out;
}

function closingBraces(wiki: string, open: number) {
  let depth = 0;
  for (let i = open; i < wiki.length - 1; i++) {
    if (wiki.startsWith('{{', i)) {
      depth++;
      i++;
    } else if (wiki.startsWith('}}', i)) {
      if (--depth === 0) return i;
      i++;
    }
  }
  throw new Error(`Unclosed template: ${wiki.slice(open, open + 80)}`);
}

/** Splits a template body on the pipes outside nested templates and links. */
function template(body: string): Template {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2);
    if (pair === '{{' || pair === '[[' || pair === '}}' || pair === ']]') {
      depth += pair[0] === '{' || pair[0] === '[' ? 1 : -1;
      i++;
    } else if (body[i] === '|' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq > 0 && /^\s*\w+\s*$/.test(part.slice(0, eq))) params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return { name: parts[0].trim(), params };
}

/** The main table: from the section's header to its footer or the next heading, so the side games' table stays out. */
function mainTable(wikitext: string): string | null {
  const text = wikitext.replace(/<!--[\s\S]*?-->/g, '');
  const heading = text.search(/^===[^=\n]*locations\s*===\s*$/im);
  if (heading < 0) return null;
  const header = text.indexOf('{{Availability/Header', heading);
  if (header < 0) throw new Error('Game locations has no Availability table');
  const start = closingBraces(text, header) + 2;
  const end = text.slice(start).search(/\{\{Availability\/Footer|^=/m);
  if (end < 0) throw new Error('Game locations table has no end');
  return text.slice(start, start + end);
}

/** What the wiki's patch notes, tooltips and icons add goes; a form tag written with `{{rf}}` reads as the tag. */
function cleanArea(area: string): string {
  return area
    .replace(/<div[^>]*><\/div>|<\/br>/g, '<br>')
    .replace(/<sup>[\s\S]*?(?:<\/sup>|(?=<br)|$)/g, '')
    .replace(/\{\{[Ss]up\/\w+\|[^{}]*\}\}/g, '')
    .replace(/\{\{tt\|\*\|[^{}]*\}\}/g, '')
    .replace(/\[\[File:[^\]]*\]\]/g, '')
    .replace(/\{\{[^{}|]* color(?: dark| light)?\}\}/g, '')
    .replace(/\{\{color2?\|[^{}|]*\|(?:[^{}|]*\|)?([^{}|]*)\}\}/g, '$1')
    .replace(/\{\{Tera\}\}/g, 'Tera')
    .replace(/\{\{pmin\|[^{}|]*\|([^{}|]*)\}\}/g, '$1')
    .replace(/\{\{TM\|(\d+)\|([^{}|]*)\}\}/g, 'TM$1 ($2)')
    .replace(/\{\{female\}\}/g, '♀')
    .replace(/\{\{male\}\}/g, '♂')
    .replace(/\{\{[Ss]hiny(?:star)?\}\}/g, 'Shiny')
    .replace(/\{\{weather\|([^{}|]*)\}\}/g, '$1')
    .replace(/\{\{rf\|(\w+)\|\w+ Form\}\}/g, '$1 Form');
}

/** "Evolve Charmeleon" → "Evolve from Charmeleon"; form tags move off the text (a raid line's stars then merge across its forms). */
function line(text: string): AvailabilityLine {
  const tags = [...text.matchAll(FORM_TAG)];
  const breeds = tags.flatMap((tag) => tag[2]?.match(/Combat|Blaze|Aqua/g) ?? []);
  return {
    text: text.replace(FORM_TAG, '').replace(/\bEvolve (?!from\b)/g, 'Evolve from ').trim(),
    forms: tags.flatMap((tag) => tag[1].split('/')),
    ...(breeds.length && { breeds }),
  };
}

/** Lines of one table cell; a blank cell means Trade, as `Template:Availability/Entry1/None` defaults it. */
function areaLines(area: string | undefined): AvailabilityLine[] {
  if (area === undefined || !area.trim()) return [{ text: 'Trade', forms: [] }];
  return cellLines(cleanArea(area))
    .map((text) => text.replace(/^\*+\s*/, '')) // the wiki's bullet lists (Gimmighoul's coins)
    .filter((text) => !/^Unobtainable\b/.test(text))
    .map(line);
}

/** One species' main table by game id; null when the page has none. */
export function parseAvailability(wikitext: string): Availability | null {
  const table = mainTable(wikitext);
  if (table === null) return null;
  const out: Availability = {};
  for (const { name, params } of templates(table)) {
    if (name === 'Availability/Gen' || name === 'Availability/NA') continue;
    if (!/^Availability\/Entry\d(\/None)?$/.test(name)) throw new Error(`Unknown template {{${name}}}`);
    const labels = Object.keys(params)
      .filter((k) => /^v\d?$/.test(k))
      .map((k) => params[k]);
    if (params.ex && /Japan/.test(params.ex)) continue;
    const lines = areaLines(params.area);
    for (const label of labels) {
      if (LEFT_OUT.has(label)) continue;
      const games = GAMES[label];
      if (!games) throw new Error(`Unknown game "${label}"`);
      for (const game of games) if (lines.length) (out[game] ??= []).push(...lines);
    }
  }
  return out;
}

/**
 * The form keys a tag belongs to: every shipped form of its region, else the species. Other forms ("Dusk") stay on the
 * species' rows as a note, since a form with rows of its own would stop being found as its species (`locationsOfForm`).
 */
function keysOfForm(form: string, breeds: string[] | undefined, formKeys: string[]): string[] {
  const region = REGION_KEYS[form];
  if (!region) return [''];
  const keys = formKeys.filter((k) => REGIONAL_FORM.test(k) && k.startsWith(region) && hasOwnFormData(k));
  const chosen = breeds ? keys.filter((k) => breeds.some((b) => k.includes(b.toLowerCase()))) : keys;
  return chosen.length ? chosen : [''];
}

/** Form key ('' = the species) → its pre-evolution as the wiki names it and as it reads, for forms that evolve from a regional form. */
export type RegionalParents = Record<string, { plain: string; regional: string }>;

/** From the species' evolution steps: Alolan Graveler comes from Alolan Geodude and Perrserker from Galarian Meowth, Alolan Raichu from plain Pikachu. */
export function regionalParents(chain: EvolutionMember[], id: number, nameOf: (id: number) => string): RegionalParents {
  const member = chain.find((m) => m.id === id);
  if (member?.from == null) return {};
  const plain = nameOf(member.from);
  const out: RegionalParents = {};
  for (const { from, into } of member.steps ?? []) {
    const word = Object.keys(REGION_KEYS).find((w) => from.startsWith(REGION_KEYS[w]));
    if (word) out[into] = { plain, regional: `${word} ${plain}` };
  }
  return out;
}

/**
 * `locations` with the lines added as text rows (`min` 0, no method; EncounterRow says the columns) where PokeAPI has no
 * row for that game and form. Earlier text rows are dropped first, so a rerun gives the same output.
 * `formGames` (form key → game ids it exists in) gives a regional form left with no row in such a game the untagged lines,
 * which the wiki writes for every form there (Alolan Golem in Let's Go). `parents` names the region in an evolve line.
 */
export function withAvailability(
  locations: Locations,
  availability: Availability,
  formKeys: string[],
  formGames: Record<string, number[]> = {},
  parents: RegionalParents = {},
): Locations {
  const strings = [...locations.strings];
  const asForm = (text: string, key: string) => {
    const parent = parents[key];
    return parent ? text.replace(`Evolve from ${parent.plain}`, `Evolve from ${parent.regional}`) : text;
  };
  const ref = (text: string) => {
    const i = strings.indexOf(text);
    return i >= 0 ? i : strings.push(text) - 1;
  };
  const keyOf = (row: EncounterRow) => (row[8] ? strings[row[8]] : '');
  const games: Locations['games'] = {};
  for (const [game, rows] of Object.entries(locations.games)) {
    const wild = rows.filter((row) => row[2] > 0);
    if (wild.length) games[Number(game)] = wild;
  }
  for (const [game, lines] of Object.entries(availability)) {
    const id = Number(game);
    const wildKeys = new Set((games[id] ?? []).map(keyOf));
    const rows: EncounterRow[] = [];
    for (const { text, forms, breeds } of lines) {
      for (const form of forms.length ? forms : ['']) {
        for (const key of keysOfForm(form, breeds, formKeys)) {
          if (wildKeys.has(key)) continue;
          const shown = asForm(text, key);
          // A form we don't ship keeps its name as the row's form note; a home region needs none, nor a line now naming its region (Perrserker).
          const note = !key && form && !HOME_REGIONS.has(form) && shown === text ? `${form} Form` : '';
          const row: EncounterRow = [ref(shown), 0, 0, 0, 0, 0, 0, ref(note)];
          if (key) row.push(ref(key));
          rows.push(row);
        }
      }
    }
    const covered = new Set([...wildKeys, ...rows.map(keyOf)]);
    const untagged = lines.filter((l) => !l.forms.length);
    for (const key of formKeys) {
      if (covered.has(key) || !REGIONAL_FORM.test(key) || !formGames[key]?.includes(id)) continue;
      for (const { text } of untagged) rows.push([ref(asForm(text, key)), 0, 0, 0, 0, 0, 0, 0, ref(key)]);
    }
    if (rows.length) games[id] = [...(games[id] ?? []), ...rows];
  }
  // A line on both a game and its DLC, or two forms under one label (Toxtricity's Gigantamax), would read twice.
  for (const [game, rows] of Object.entries(games)) games[Number(game)] = [...new Map(rows.map((row) => [row.join(), row])).values()];
  return { strings, games };
}
