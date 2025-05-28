/**
 * Data build: turns PokeAPI's open CSV dump into the compact JSON the app ships.
 *
 *   npm run data          # download (cached in .cache/) and emit public/data/
 *   npm run data -- --fresh   # ignore the cache and re-download
 *
 * Output (all under public/data/):
 *   index.json            one row per species (default form): grid, search, filters, sorting by stat and size
 *   types.json            18 types + full damage matrix (attacker -> defender -> factor)
 *   species/<id>.json     detail page data (incl. catch rate, EV yield, growth rate, egg groups, gender), loaded on demand;
 *                         `forms` lists battle forms (regional, mega, gmax…)
 *   learnsets/<id>.json   moves per version group (level-up, TM, tutor, egg), loaded by the Moves tab
 *   moves.json            every move a learnset references: name, type, category, power, accuracy, PP, priority, generation
 *   versions.json         main-series version groups that have learnsets, oldest first
 *   evolution/<chain>.json  evolution chain members with English condition text, loaded by the Evolution tab
 *   items.json            held items a team member can carry: item id -> English name
 *   reference/abilities.json  ability id -> name, short effect, full details, generation, species that have it (any form)
 *   reference/items.json      held item id -> short effect, species that hold it in the wild
 *   reference/moves/<id>.json move description, full effect, and its learners per method as [species, generation bitmask]
 *   locations/<id>.json   wild encounters per game (version id) as tuples into a string table, any form
 *   games.json            games (versions) with encounter data, oldest first
 *   meta.json             data version + build time (the HEAD commit date, so it never postdates the history)
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { summariseSlots, type ConditionValue } from './encounters';

const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'csv');
const OUT = join(ROOT, 'public', 'data');
const ENGLISH = 9;
const FRESH = process.argv.includes('--fresh');

/** Build time for meta.json: the HEAD commit date; now when git or a commit is missing. */
function buildTime(): Date {
  try {
    const date = new Date(execFileSync('git', ['log', '-1', '--format=%cI'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim());
    if (!Number.isNaN(date.getTime())) return date;
  } catch {
    // no git, or no commits
  }
  return new Date();
}

/** Version groups left out of the game picker: Colosseum, XD, Japan-only Red/Green/Blue, Champions. */
const SKIPPED_VERSION_GROUPS = new Set(['12', '13', '28', '29', '32']);
/** Let's Go Pikachu/Eevee: PokeAPI gives every slot 100%, so the Locations tab shows no chance there. */
const LETS_GO = '19';
/** pokemon_move_methods ids the Moves tab shows. */
const LEARN_METHODS: Record<string, 'level' | 'machine' | 'tutor' | 'egg'> = {
  '1': 'level',
  '2': 'egg',
  '3': 'tutor',
  '4': 'machine',
};
const DAMAGE_CLASSES: Record<string, string> = { '1': 'status', '2': 'physical', '3': 'special' };
/** Labels for the forms an evolution can be limited to (other form differences, like Vivillon's, are cosmetic). */
const FORM_LABELS: Record<string, string> = {
  alola: 'Alolan',
  galar: 'Galarian',
  hisui: 'Hisuian',
  paldea: 'Paldean',
  'white-striped': 'White-Striped',
};
/**
 * item_categories identifiers whose items are battle held items. The holdable flags in item_flag_map
 * are missing for most items from Gen 5 on (Assault Vest, Eviolite), so categories decide instead.
 */
const HELD_ITEM_CATEGORIES = new Set([
  'held-items', 'choice', 'type-enhancement', 'plates', 'species-specific', 'bad-held-items',
  'effort-training', 'training', 'jewels', 'mega-stones', 'memories', 'z-crystals',
  'medicine', 'picky-healing', 'in-a-pinch', 'type-protection', 'other',
]);
/** Short labels for encounter_methods identifiers; the rest use their English prose. */
const METHOD_LABELS: Record<string, string> = {
  walk: 'Grass or cave',
  'dark-grass': 'Dark grass',
  'grass-spots': 'Rustling grass',
  'cave-spots': 'Dust clouds',
  'bridge-spots': 'Bridge shadows',
  'yellow-flowers': 'Yellow flowers',
  'red-flowers': 'Red flowers',
  'purple-flowers': 'Purple flowers',
  'rough-terrain': 'Rough terrain',
  surf: 'Surfing',
  'surf-spots': 'Surfing in dark spots',
  seaweed: 'Diving in seaweed',
  'old-rod': 'Old Rod',
  'good-rod': 'Good Rod',
  'super-rod': 'Super Rod',
  'super-rod-spots': 'Fishing in dark spots',
  'bubbling-spots': 'Fishing in bubbling spots',
  'feebas-tile-fishing': 'Fishing on Feebas tiles',
  'rock-smash': 'Rock Smash',
  headbutt: 'Headbutt',
  'headbutt-low': 'Headbutt (rare trees)',
  'headbutt-normal': 'Headbutt (some trees)',
  'headbutt-high': 'Headbutt (common trees)',
  'honey-tree': 'Honey tree',
  'berry-trees': 'Berry tree',
  horde: 'Horde',
  'hidden-grotto': 'Hidden Grotto',
  sos: 'SOS battle',
  'sos-from-bubbling-spot': 'SOS battle (bubbling spots)',
  'island-scan': 'Island Scan',
  gift: 'Gift',
  'gift-egg': 'Gift egg',
  'npc-trade': 'In-game trade',
  static: 'Single encounter',
  pokeflute: 'Poké Flute',
  'squirt-bottle': 'Squirt Bottle',
  'wailmer-pail': 'Wailmer Pail',
  'devon-scope': 'Devon Scope',
  'roaming-grass': 'Roaming',
  'roaming-water': 'Roaming (water)',
  overworld: 'Overworld',
  'overworld-water': 'Overworld (water)',
  'overworld-flying': 'Overworld (sky)',
  'overworld-special': 'Fixed overworld spawn',
  'overworld-water-special': 'Fixed overworld spawn (water)',
  'overworld-flying-special': 'Rare sky spawn',
  'overworld-dirt': 'Overworld (underground)',
  wanderer: 'Wanderer',
  'wanderer-water': 'Wanderer (water)',
  'max-raid': 'Max Raid',
  'dynamax-adventure': 'Dynamax Adventure',
  'ceiling-ambush': 'Ambush from the ceiling',
  'ground-ambush': 'Ambush from the ground',
  'sky-ambush': 'Ambush from the sky',
  'rustling-bush-ambush': 'Ambush from a bush',
  'trash-can-ambush': 'Ambush from a trash can',
  'chase-water': 'Chased in the water',
};
/** Short labels for encounter conditions whose English prose is a sentence (Max Raid dens, honey trees). */
const CONDITION_LABELS: Record<string, string> = {
  'max-den-rarity-common': 'Red beam',
  'max-den-rarity-rare': 'Purple beam',
  'max-den-rarity-special': 'Red beam after Wild Area News',
  'honey-tree-group-a': 'Honey tree group A',
  'honey-tree-group-b': 'Honey tree group B',
  'honey-tree-group-c': 'Honey tree group C',
};
/** Hand-picked categories PokeAPI has no flag for, by species identifier (the build fails on an unknown one). */
const STARTERS = [
  'bulbasaur', 'charmander', 'squirtle', 'chikorita', 'cyndaquil', 'totodile', 'treecko', 'torchic', 'mudkip',
  'turtwig', 'chimchar', 'piplup', 'snivy', 'tepig', 'oshawott', 'chespin', 'fennekin', 'froakie',
  'rowlet', 'litten', 'popplio', 'grookey', 'scorbunny', 'sobble', 'sprigatito', 'fuecoco', 'quaxly',
];
/** Revived from fossils, with their evolutions. */
const FOSSILS = [
  'omanyte', 'omastar', 'kabuto', 'kabutops', 'aerodactyl', 'lileep', 'cradily', 'anorith', 'armaldo',
  'cranidos', 'rampardos', 'shieldon', 'bastiodon', 'tirtouga', 'carracosta', 'archen', 'archeops',
  'tyrunt', 'tyrantrum', 'amaura', 'aurorus', 'dracozolt', 'arctozolt', 'dracovish', 'arctovish',
];
const PARADOX = [
  'great-tusk', 'scream-tail', 'brute-bonnet', 'flutter-mane', 'slither-wing', 'sandy-shocks', 'roaring-moon',
  'walking-wake', 'gouging-fire', 'raging-bolt', 'iron-treads', 'iron-bundle', 'iron-hands', 'iron-jugulis',
  'iron-moth', 'iron-thorns', 'iron-valiant', 'iron-leaves', 'iron-boulder', 'iron-crown',
];
const EVOLUTION_STONES = new Set([
  'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone', 'shiny-stone', 'dusk-stone',
  'dawn-stone', 'ice-stone',
]);
const EEVEE_CHAIN = '67';
/** The games' names for growth_rates and egg_groups identifiers (PokeAPI uses the internal ones). */
const GROWTH_RATES: Record<string, string> = {
  slow: 'Slow', medium: 'Medium Fast', fast: 'Fast', 'medium-slow': 'Medium Slow',
  'slow-then-very-fast': 'Erratic', 'fast-then-very-slow': 'Fluctuating',
};
const EGG_GROUPS: Record<string, string> = {
  monster: 'Monster', water1: 'Water 1', bug: 'Bug', flying: 'Flying', ground: 'Field', fairy: 'Fairy', plant: 'Grass',
  humanshape: 'Human-Like', water3: 'Water 3', mineral: 'Mineral', indeterminate: 'Amorphous', water2: 'Water 2',
  ditto: 'Ditto', dragon: 'Dragon', 'no-eggs': 'Undiscovered',
};
/** Form keys of regional variants: "alola", "galar-zen", "paldea-aqua-breed"… */
const REGIONAL_FORM = /^(alola|galar|hisui|paldea)\b/;
const TIMES: Record<string, string> = { day: 'during the day', night: 'at night', dusk: 'at dusk', 'full-moon': 'under a full moon' };

type Row = Record<string, string>;

/** RFC 4180 CSV parser (handles quoted fields with commas and newlines). */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

async function load(name: string): Promise<Row[]> {
  const file = join(CACHE, `${name}.csv`);
  if (FRESH || !existsSync(file)) {
    const res = await fetch(`${CSV_BASE}/${name}.csv`);
    if (!res.ok) throw new Error(`Download failed for ${name}: ${res.status}`);
    await writeFile(file, await res.text());
    console.log(`  downloaded ${name}.csv`);
  }
  return parseCsv(await readFile(file, 'utf8'));
}

const groupBy = <T,>(rows: T[], key: (r: T) => string | number) => {
  const m = new Map<string | number, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
};

const clean = (s: string) => s.replace(/[\f\n\r]+/g, ' ').replace(/­/g, '').replace(/\s+/g, ' ').trim();
/** Long prose: each paragraph cleaned, paragraphs kept apart by a blank line. */
const paragraphs = (s: string) => s.split(/\n\s*\n/).map(clean).filter(Boolean).join('\n\n');

interface Learnset {
  level: [number, number][];
  machine: number[];
  tutor: number[];
  egg: number[];
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  console.log('Loading CSVs…');
  const [
    species,
    pokemon,
    types,
    pokemonTypes,
    pokemonStats,
    pokemonAbilities,
    abilityNames,
    efficacy,
    speciesNames,
    flavor,
    pokemonMoves,
    moves,
    moveNames,
    versionGroups,
    versions,
    versionNames,
    evolutions,
    pokemonForms,
    formNames,
    itemNames,
    locationNames,
    typeNames,
    triggerProse,
    items,
    itemCategories,
    abilities,
    abilityProse,
    abilityFlavor,
    moveEffectProse,
    moveFlavor,
    itemProse,
    itemFlavor,
    pokemonItems,
    encounters,
    encounterSlots,
    encounterMethods,
    encounterMethodProse,
    encounterConditionValues,
    encounterConditionValueProse,
    encounterConditionValueMap,
    locations,
    locationAreas,
    locationAreaProse,
    growthRates,
    eggGroups,
    pokemonEggGroups,
  ] = await Promise.all(
      [
        'pokemon_species',
        'pokemon',
        'types',
        'pokemon_types',
        'pokemon_stats',
        'pokemon_abilities',
        'ability_names',
        'type_efficacy',
        'pokemon_species_names',
        'pokemon_species_flavor_text',
        'pokemon_moves',
        'moves',
        'move_names',
        'version_groups',
        'versions',
        'version_names',
        'pokemon_evolution',
        'pokemon_forms',
        'pokemon_form_names',
        'item_names',
        'location_names',
        'type_names',
        'evolution_trigger_prose',
        'items',
        'item_categories',
        'abilities',
        'ability_prose',
        'ability_flavor_text',
        'move_effect_prose',
        'move_flavor_text',
        'item_prose',
        'item_flavor_text',
        'pokemon_items',
        'encounters',
        'encounter_slots',
        'encounter_methods',
        'encounter_method_prose',
        'encounter_condition_values',
        'encounter_condition_value_prose',
        'encounter_condition_value_map',
        'locations',
        'location_areas',
        'location_area_prose',
        'growth_rates',
        'egg_groups',
        'pokemon_egg_groups',
      ].map(load),
    );

  // --- types: the 18 battle types only (skip stellar/unknown/shadow) ---
  const battleTypes = types.filter((t) => Number(t.id) <= 18);
  const typeName = new Map(battleTypes.map((t) => [t.id, t.identifier]));
  const matrix: Record<string, Record<string, number>> = {};
  for (const e of efficacy) {
    const atk = typeName.get(e.damage_type_id);
    const def = typeName.get(e.target_type_id);
    if (!atk || !def) continue;
    (matrix[atk] ??= {})[def] = Number(e.damage_factor) / 100;
  }

  // --- lookups ---
  const defaultPokemon = new Map(
    pokemon.filter((p) => p.is_default === '1').map((p) => [p.species_id, p]),
  );
  const altPokemon = groupBy(
    pokemon.filter((p) => p.is_default === '0' && !p.identifier.includes('totem')),
    (p) => p.species_id,
  );
  /** English names of each Pokémon's default form, e.g. "Alolan Form" / "Alolan Vulpix". */
  const defaultFormOf = new Map(pokemonForms.filter((f) => f.is_default === '1').map((f) => [f.pokemon_id, f]));
  const formName = new Map(
    formNames.filter((n) => Number(n.local_language_id) === ENGLISH).map((n) => [n.pokemon_form_id, n]),
  );
  const typesByPokemon = groupBy(pokemonTypes, (r) => r.pokemon_id);
  const statsByPokemon = groupBy(pokemonStats, (r) => r.pokemon_id);
  const abilitiesByPokemon = groupBy(pokemonAbilities, (r) => r.pokemon_id);
  const abilityName = new Map(
    abilityNames.filter((a) => Number(a.local_language_id) === ENGLISH).map((a) => [a.ability_id, a.name]),
  );
  const names = new Map(
    speciesNames.filter((n) => Number(n.local_language_id) === ENGLISH).map((n) => [n.pokemon_species_id, n]),
  );
  // latest English flavor text per species
  const flavorBySpecies = new Map<string, { v: number; text: string }>();
  for (const f of flavor) {
    if (Number(f.language_id) !== ENGLISH) continue;
    const v = Number(f.version_id);
    const prev = flavorBySpecies.get(f.species_id);
    if (!prev || v > prev.v) flavorBySpecies.set(f.species_id, { v, text: clean(f.flavor_text) });
  }

  // --- learnsets: default forms, main-series games, the four methods the Moves tab shows ---
  const defaultPokemonIds = new Set([...defaultPokemon.values()].map((p) => p.id));
  const movesByPokemon = groupBy(
    pokemonMoves.filter(
      (r) =>
        defaultPokemonIds.has(r.pokemon_id) &&
        !SKIPPED_VERSION_GROUPS.has(r.version_group_id) &&
        LEARN_METHODS[r.pokemon_move_method_id],
    ),
    (r) => r.pokemon_id,
  );
  const usedMoves = new Set<string>();
  /** move id -> species ids that learn it, filled while writing learnsets. */
  /** move id -> learn method -> species id -> bitmask of generations (bit n-1 = Gen n), filled while writing learnsets. */
  const learnersByMove = new Map<string, Record<string, Map<number, number>>>();
  const genOfVersionGroup = new Map(versionGroups.map((g) => [g.id, Number(g.generation_id)]));
  const usedVersionGroups = new Set<string>();

  const STAT_KEYS = ['', 'hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
  /** Game name for an identifier from one of the tables above; fails on one the table lacks. */
  const gameName = (table: Record<string, string>, rows: Row[], label: string) => {
    const byId = new Map(rows.map((r) => [r.id, r.identifier]));
    return (id: string) => {
      const name = table[byId.get(id) ?? ''];
      if (!name) throw new Error(`${label}: no name for id ${id}`);
      return name;
    };
  };
  const growthName = gameName(GROWTH_RATES, growthRates, 'GROWTH_RATES');
  const eggGroupName = gameName(EGG_GROUPS, eggGroups, 'EGG_GROUPS');
  const eggGroupsBySpecies = groupBy(pokemonEggGroups, (r) => r.species_id);

  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, 'species'), { recursive: true });
  await mkdir(join(OUT, 'learnsets'), { recursive: true });

  /** What a Pokémon (default or form) brings to battle, plus its size. */
  function battleData(p: Row) {
    const types = (typesByPokemon.get(p.id) ?? [])
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map((r) => typeName.get(r.type_id))
      .filter((x): x is string => !!x);
    const stats: Record<string, number> = {};
    const evYield: Record<string, number> = {};
    for (const r of statsByPokemon.get(p.id) ?? []) {
      const key = STAT_KEYS[Number(r.stat_id)];
      if (!key) continue;
      stats[key] = Number(r.base_stat);
      if (Number(r.effort)) evYield[key] = Number(r.effort);
    }
    return {
      types,
      stats,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
      abilities: (abilitiesByPokemon.get(p.id) ?? [])
        .sort((a, b) => Number(a.slot) - Number(b.slot))
        .map((a) => ({ id: Number(a.ability_id), name: abilityName.get(a.ability_id) ?? `#${a.ability_id}`, hidden: a.is_hidden === '1' })),
      heightM: Number(p.height) / 10,
      weightKg: Number(p.weight) / 10,
      evYield,
    };
  }

  const titleCase = (key: string) => key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  /** Form key (unique in its species), chip label and full name, e.g. "mega-x" / "Mega X" / "Mega Charizard X". */
  function formLabels(p: Row, s: Row, speciesName: string) {
    const f = defaultFormOf.get(p.id);
    const fullName = (f && formName.get(f.id)?.pokemon_name) || '';
    const key = p.identifier.replace(`${s.identifier}-`, '');
    const label =
      fullName.replace(speciesName, '').replace(/\s+/g, ' ').trim() ||
      (p.is_default === '1' ? speciesName : titleCase(key));
    return { key: p.is_default === '1' ? '' : key, label, name: fullName || speciesName };
  }

  /** Battle forms: alternate Pokémon whose types, stats or abilities differ, plus every Gigantamax. */
  function formsOf(s: Row, p: Row, speciesName: string) {
    const base = battleData(p);
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const alts = (altPokemon.get(s.id) ?? [])
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((alt) => ({ alt, data: battleData(alt), labels: formLabels(alt, s, speciesName) }))
      .filter(
        ({ data, labels }) =>
          labels.key.endsWith('gmax') ||
          !same(data.types, base.types) || !same(data.stats, base.stats) || !same(data.abilities, base.abilities),
      );
    if (!alts.length) return undefined;
    const first = { pokemonId: Number(p.id), ...formLabels(p, s, speciesName), ...base };
    const forms = [first, ...alts.map(({ alt, data, labels }) => ({ pokemonId: Number(alt.id), ...labels, ...data }))];
    // Forms sharing a label: name the ability when that tells them apart (Zygarde 10% with Power Construct),
    // else spell out the key (Meowstic "Male Mega" / "Female Mega").
    for (const group of groupBy(forms, (f) => f.label).values()) {
      if (group.length < 2) continue;
      const abilities = group.map((f) => f.abilities[0]?.name);
      const distinct = abilities.every(Boolean) && new Set(abilities).size === group.length;
      for (const f of group) f.label = distinct ? `${f.label} (${f.abilities[0].name})` : titleCase(f.key) || f.label;
    }
    return forms;
  }

  // --- quick categories (Dex chip bar) ---
  const speciesByIdentifier = new Map(species.map((s) => [s.identifier, s.id]));
  const handPicked = (list: string[], label: string) =>
    new Set(
      list.map((identifier) => {
        const id = speciesByIdentifier.get(identifier);
        if (!id) throw new Error(`${label}: no species "${identifier}"`);
        return id;
      }),
    );
  const starters = handPicked(STARTERS, 'STARTERS');
  const fossils = handPicked(FOSSILS, 'FOSSILS');
  const paradox = handPicked(PARADOX, 'PARADOX');
  const stoneItems = new Set(items.filter((it) => EVOLUTION_STONES.has(it.identifier)).map((it) => it.id));
  if (stoneItems.size !== EVOLUTION_STONES.size) throw new Error('EVOLUTION_STONES: an item is missing from items.csv');
  const stoneEvolved = new Set(evolutions.filter((e) => stoneItems.has(e.trigger_item_id)).map((e) => e.evolved_species_id));
  /** Categories a species belongs to, from its flags, forms and evolution. */
  function tagsOf(s: Row, forms: { key: string }[] = []) {
    const tags: string[] = [];
    if (starters.has(s.id)) tags.push('starter');
    if (forms.some((f) => f.key.startsWith('mega'))) tags.push('mega');
    if (fossils.has(s.id)) tags.push('fossil');
    if (s.evolution_chain_id === EEVEE_CHAIN) tags.push('eeveelution');
    if (s.is_legendary === '1') tags.push('legendary');
    if (s.is_mythical === '1') tags.push('mythical');
    if (forms.some((f) => REGIONAL_FORM.test(f.key))) tags.push('regional');
    if (s.is_baby === '1') tags.push('baby');
    if (paradox.has(s.id)) tags.push('paradox');
    if (stoneEvolved.has(s.id)) tags.push('stone');
    return tags;
  }

  const index = [];
  let formCount = 0;
  const ordered = [...species].sort((a, b) => Number(a.id) - Number(b.id));
  for (const s of ordered) {
    const p = defaultPokemon.get(s.id);
    if (!p) continue;
    const { types: t, stats, total, abilities, heightM, weightKg, evYield } = battleData(p);
    const n = names.get(s.id);
    const id = Number(s.id);
    const forms = formsOf(s, p, n?.name ?? s.identifier);
    formCount += forms ? forms.length - 1 : 0;
    const tags = tagsOf(s, forms);

    index.push({
      id,
      name: n?.name ?? s.identifier,
      types: t,
      gen: Number(s.generation_id),
      total,
      stats,
      heightM,
      weightKg,
      ...(tags.length && { tags }),
    });

    const detail = {
      id,
      slug: s.identifier,
      name: n?.name ?? s.identifier,
      genus: n?.genus ?? '',
      types: t,
      gen: Number(s.generation_id),
      heightM,
      weightKg,
      stats,
      total,
      abilities,
      flavor: flavorBySpecies.get(s.id)?.text ?? '',
      catchRate: Number(s.capture_rate),
      evYield,
      growthRate: growthName(s.growth_rate_id),
      eggGroups: (eggGroupsBySpecies.get(s.id) ?? []).map((r) => eggGroupName(r.egg_group_id)),
      genderRate: Number(s.gender_rate),
      legendary: s.is_legendary === '1',
      mythical: s.is_mythical === '1',
      evolutionChainId: Number(s.evolution_chain_id) || null,
      ...(forms && { forms }),
    };
    await writeFile(join(OUT, 'species', `${id}.json`), JSON.stringify(detail));

    const learnset: Record<string, Learnset> = {};
    const rows = (movesByPokemon.get(p.id) ?? []).sort(
      (a, b) => Number(a.level) - Number(b.level) || Number(a.order || 0) - Number(b.order || 0),
    );
    for (const r of rows) {
      const set = (learnset[r.version_group_id] ??= { level: [], machine: [], tutor: [], egg: [] });
      const method = LEARN_METHODS[r.pokemon_move_method_id];
      const move = Number(r.move_id);
      if (method === 'level') {
        if (!set.level.some(([m, l]) => m === move && l === Number(r.level))) set.level.push([move, Number(r.level)]);
      } else if (!set[method].includes(move)) set[method].push(move);
      usedMoves.add(r.move_id);
      const byMethod = learnersByMove.get(r.move_id) ?? {};
      learnersByMove.set(r.move_id, byMethod);
      const bySpecies = (byMethod[method] ??= new Map());
      bySpecies.set(id, (bySpecies.get(id) ?? 0) | (1 << (genOfVersionGroup.get(r.version_group_id)! - 1)));
      usedVersionGroups.add(r.version_group_id);
    }
    await writeFile(join(OUT, 'learnsets', `${id}.json`), JSON.stringify(learnset));
  }

  // --- moves referenced by any learnset ---
  const moveName = new Map(
    moveNames.filter((n) => Number(n.local_language_id) === ENGLISH).map((n) => [n.move_id, n.name]),
  );
  const moveTable: Record<string, unknown> = {};
  for (const m of moves) {
    if (!usedMoves.has(m.id)) continue;
    moveTable[m.id] = {
      name: moveName.get(m.id) ?? m.identifier,
      type: typeName.get(m.type_id) ?? 'normal',
      category: DAMAGE_CLASSES[m.damage_class_id] ?? 'status',
      power: m.power ? Number(m.power) : null,
      accuracy: m.accuracy ? Number(m.accuracy) : null,
      pp: m.pp ? Number(m.pp) : null,
      priority: Number(m.priority),
      gen: Number(m.generation_id),
    };
  }

  // --- version groups, labelled from their versions' English names ---
  const versionName = new Map(
    versionNames.filter((n) => Number(n.local_language_id) === ENGLISH).map((n) => [n.version_id, n.name]),
  );
  const versionsByGroup = groupBy(versions, (v) => v.version_group_id);
  const versionList = versionGroups
    .filter((g) => usedVersionGroups.has(g.id))
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((g) => ({
      id: Number(g.id),
      label: (versionsByGroup.get(g.id) ?? [])
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((v) => versionName.get(v.id) ?? v.identifier)
        .join(' / '),
      gen: Number(g.generation_id),
    }));

  // --- evolution chains ---
  const english = (rows: Row[], key: string) =>
    new Map(rows.filter((r) => Number(r.local_language_id) === ENGLISH).map((r) => [r[key], r.name]));
  const itemName = english(itemNames, 'item_id');
  const locationName = english(locationNames, 'location_id');
  const typeLabel = english(typeNames, 'type_id');
  const triggerName = english(triggerProse, 'evolution_trigger_id');
  const speciesName = (id: string) => names.get(id)?.name ?? `#${id}`;
  const formById = new Map(pokemonForms.map((f) => [f.id, f]));
  /** A form id is "default" when it belongs to a species' default Pokémon and is its default form. */
  const isDefaultForm = (id: string) => {
    const f = formById.get(id);
    return !id || !f || (f.is_default === '1' && defaultPokemonIds.has(f.pokemon_id));
  };

  function conditionText(e: Row): string {
    const parts: string[] = [];
    const level = Number(e.minimum_level);
    // Trigger ids from evolution_triggers.csv; the rest fall back to their English prose.
    switch (e.evolution_trigger_id) {
      case '1': // level up
        parts.push(level ? `Lv. ${level}` : 'Level up');
        break;
      case '10': // level up in battle
        parts.push(level ? `Lv. ${level}` : 'Level up', 'in battle');
        break;
      case '2': // trade
        parts.push(e.held_item_id ? `Trade holding ${itemName.get(e.held_item_id)}` : 'Trade');
        if (e.trade_species_id) parts.push(`for ${speciesName(e.trade_species_id)}`);
        break;
      case '3': // use item
        parts.push(`Use ${itemName.get(e.trigger_item_id) ?? 'an item'}`);
        break;
      case '4': // shed (Shedinja)
        parts.push(`Lv. ${level || 20}, with a free party slot and a Poké Ball`);
        break;
      case '11': // use move in agile style
      case '12': // use move in strong style
      case '14': {
        // use move
        const times = Number(e.minimum_move_count);
        parts.push(`Use ${moveName.get(e.used_move_id) ?? 'a move'}${times ? ` ${times} times` : ''}`);
        if (e.evolution_trigger_id !== '14') parts.push(e.evolution_trigger_id === '11' ? 'agile style' : 'strong style');
        break;
      }
      default:
        parts.push(triggerName.get(e.evolution_trigger_id) ?? 'Special');
        if (level) parts.push(`Lv. ${level}`);
    }
    if (e.held_item_id && e.evolution_trigger_id !== '2') parts.push(`holding ${itemName.get(e.held_item_id)}`);
    if (e.minimum_happiness) parts.push('high friendship');
    if (e.minimum_beauty) parts.push('high beauty');
    if (e.minimum_affection) parts.push('high affection');
    if (e.known_move_id) parts.push(`knowing ${moveName.get(e.known_move_id)}`);
    if (e.known_move_type_id) parts.push(`knowing a ${typeLabel.get(e.known_move_type_id)}-type move`);
    if (e.gender_id === '1') parts.push('female');
    if (e.gender_id === '2') parts.push('male');
    if (e.time_of_day) parts.push(TIMES[e.time_of_day] ?? e.time_of_day);
    if (e.location_id) parts.push(`at ${locationName.get(e.location_id)}`);
    else if (e.near_special_rock === '1') parts.push('near a special rock');
    if (e.party_species_id) parts.push(`with ${speciesName(e.party_species_id)} in the party`);
    if (e.party_type_id) parts.push(`with a ${typeLabel.get(e.party_type_id)}-type in the party`);
    const rel = e.relative_physical_stats;
    if (rel) parts.push(rel === '1' ? 'Attack > Defense' : rel === '-1' ? 'Attack < Defense' : 'Attack = Defense');
    if (e.needs_overworld_rain === '1') parts.push('in rain');
    if (e.turn_upside_down === '1') parts.push('console held upside down');
    if (e.needs_multiplayer === '1') parts.push('in Union Circle');
    if (e.minimum_steps) parts.push(`after ${Number(e.minimum_steps).toLocaleString('en')} steps`);
    if (e.minimum_damage_taken && e.evolution_trigger_id !== '9') parts.push(`after losing ${e.minimum_damage_taken} HP`);
    if (e.nature_bitmask) parts.push('certain natures');
    // A chance that only picks the form (Maushold, Dudunsparce) isn't a condition of evolving.
    if (e.percentage_chance && !e.evolved_pokemon_form_id) parts.push(`${e.percentage_chance}% chance`);
    return parts.join(' · ');
  }

  /** Conditions per evolved species: current-game default-form rows, else any default-form rows,
   *  else (evolves only from one form) every row, prefixed with the form. */
  const evoRows = groupBy(evolutions, (e) => e.evolved_species_id);
  function conditionsFor(speciesId: string): string[] {
    const rows = evoRows.get(speciesId) ?? [];
    const plain = rows.filter((e) => isDefaultForm(e.required_pokemon_form_id) && isDefaultForm(e.evolved_pokemon_form_id));
    const latest = (list: Row[]) => {
      const current = list.filter((e) => e.is_default === '1');
      return current.length ? current : list;
    };
    const texts = plain.length
      ? latest(plain).map(conditionText)
      : latest(rows).map((e) => {
          const form = FORM_LABELS[formById.get(e.required_pokemon_form_id)?.form_identifier ?? ''];
          return [form && `${form} form`, conditionText(e)].filter(Boolean).join(' · ');
        });
    return [...new Set(texts)];
  }

  await mkdir(join(OUT, 'evolution'), { recursive: true });
  const shipped = new Set(index.map((m) => String(m.id)));
  const chains = groupBy(
    species.filter((s) => s.evolution_chain_id && shipped.has(s.id)),
    (s) => s.evolution_chain_id,
  );
  for (const [chainId, members] of chains) {
    const children = groupBy(members, (s) => s.evolves_from_species_id);
    const out: { id: number; from: number | null; conditions: string[] }[] = [];
    const walk = (s: Row) => {
      const from = Number(s.evolves_from_species_id) || null;
      out.push({ id: Number(s.id), from, conditions: from ? conditionsFor(s.id) : [] });
      for (const c of (children.get(s.id) ?? []).sort((a, b) => Number(a.id) - Number(b.id))) walk(c);
    };
    for (const root of members.filter((s) => !s.evolves_from_species_id)) walk(root);
    await writeFile(join(OUT, 'evolution', `${chainId}.json`), JSON.stringify(out));
  }

  // --- held items ---
  const heldCategories = new Set(itemCategories.filter((c) => HELD_ITEM_CATEGORIES.has(c.identifier)).map((c) => c.id));
  const itemTable: Record<string, string> = {};
  for (const it of items) {
    const name = itemName.get(it.id);
    if (!name || !heldCategories.has(it.category_id)) continue;
    itemTable[it.id] = name;
  }

  // --- reference: effect text, plus the species each move, ability and held item belongs to ---
  /** English short effect by id, else the newest English flavor text. */
  function effectText(prose: Row[], proseKey: string, flavorRows: Row[], flavorKey: string) {
    const out = new Map<string, string>();
    const newest = new Map<string, number>();
    for (const f of flavorRows) {
      const vg = Number(f.version_group_id);
      if (Number(f.language_id) !== ENGLISH || vg <= (newest.get(f[flavorKey]) ?? 0)) continue;
      newest.set(f[flavorKey], vg);
      out.set(f[flavorKey], clean(f.flavor_text));
    }
    for (const p of prose) {
      if (Number(p.local_language_id) === ENGLISH && p.short_effect) out.set(p[proseKey], clean(p.short_effect));
    }
    return out;
  }
  const speciesOfPokemon = new Map(pokemon.map((p) => [p.id, Number(p.species_id)]));
  /** Species ids (sorted, deduplicated) for rows keyed by Pokémon id; forms count as their species. */
  const speciesIds = (rows: Row[]) =>
    [...new Set(rows.map((r) => speciesOfPokemon.get(r.pokemon_id)).filter((id): id is number => !!id && id <= index.length))]
      .sort((a, b) => a - b);

  await mkdir(join(OUT, 'reference', 'moves'), { recursive: true });
  const moveProseIds = new Map<string, string>();
  for (const p of moveEffectProse) if (Number(p.local_language_id) === ENGLISH) moveProseIds.set(p.move_effect_id, paragraphs(p.effect));
  const moveFlavorText = effectText([], '', moveFlavor, 'move_id');
  for (const m of moves) {
    if (!usedMoves.has(m.id)) continue;
    const description = moveFlavorText.get(m.id) ?? '';
    const effect = moveProseIds.get(m.effect_id) ?? '';
    const learners: Record<string, [number, number][]> = {};
    for (const [method, bySpecies] of Object.entries(learnersByMove.get(m.id) ?? {})) {
      learners[method] = [...bySpecies].sort(([a], [b]) => a - b);
    }
    await writeFile(join(OUT, 'reference', 'moves', `${m.id}.json`), JSON.stringify({ description, effect, learners }));
  }

  const abilityEffect = effectText(abilityProse, 'ability_id', abilityFlavor, 'ability_id');
  const abilityDetails = new Map(
    abilityProse.filter((p) => Number(p.local_language_id) === ENGLISH && p.effect).map((p) => [p.ability_id, paragraphs(p.effect)]),
  );
  const holdersByAbility = groupBy(pokemonAbilities, (r) => r.ability_id);
  const abilityTable: Record<string, unknown> = {};
  for (const a of abilities) {
    const holders = speciesIds(holdersByAbility.get(a.id) ?? []);
    if (a.is_main_series !== '1' || !holders.length) continue;
    abilityTable[a.id] = {
      name: abilityName.get(a.id) ?? a.identifier,
      effect: abilityEffect.get(a.id) ?? '',
      details: abilityDetails.get(a.id) ?? '',
      gen: Number(a.generation_id),
      species: holders,
    };
  }

  const itemEffect = effectText(itemProse, 'item_id', itemFlavor, 'item_id');
  const wildHolders = groupBy(pokemonItems, (r) => r.item_id);
  const itemReference: Record<string, unknown> = {};
  for (const id of Object.keys(itemTable)) {
    itemReference[id] = { effect: itemEffect.get(id) ?? '', species: speciesIds(wildHolders.get(id) ?? []) };
  }

  // --- locations: wild encounters per game (PokeAPI has them from Red/Blue to Sword/Shield) ---
  const gameVersions = new Map(versions.filter((v) => !SKIPPED_VERSION_GROUPS.has(v.version_group_id)).map((v) => [v.id, v]));
  const slotById = new Map(encounterSlots.map((s) => [s.id, s]));
  const methodById = new Map(encounterMethods.map((m) => [m.id, m]));
  const methodProse = english(encounterMethodProse, 'encounter_method_id');
  const areaById = new Map(locationAreas.map((a) => [a.id, a]));
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const areaProse = english(locationAreaProse, 'location_area_id');
  const conditionProse = english(encounterConditionValueProse, 'encounter_condition_value_id');
  const conditionLabel = (v: Row) => {
    const stars = v.identifier.match(/^max-den-rating-(\d)-star$/)?.[1];
    return stars ? `${stars}★` : CONDITION_LABELS[v.identifier] ?? conditionProse.get(v.id) ?? titleCase(v.identifier);
  };
  const conditionValues = new Map<string, ConditionValue>(
    encounterConditionValues.map((v) => [v.id, { type: v.encounter_condition_id, name: conditionLabel(v) }]),
  );
  const conditionsOf = groupBy(encounterConditionValueMap, (r) => r.encounter_id);
  const conditionIds = (e: Row) => (conditionsOf.get(e.id) ?? []).map((r) => r.encounter_condition_value_id);

  /** "Route 1", "Mt. Coronet (2F)": the English place name plus the area within it, if any. */
  function areaName(id: string) {
    const area = areaById.get(id);
    if (!area) return `Area ${id}`;
    const place = locationName.get(area.location_id) ?? titleCase(locationById.get(area.location_id)?.identifier ?? '');
    if (!area.identifier) return place;
    const prose = areaProse.get(id) ?? '';
    const part =
      prose.match(/\((.+)\)$/)?.[1] ?? (prose.startsWith(`${place} `) ? prose.slice(place.length + 1) : titleCase(area.identifier));
    return `${place} (${part})`;
  }
  const methodLabel = (id: string) => {
    const m = methodById.get(id);
    return METHOD_LABELS[m?.identifier ?? ''] ?? methodProse.get(id) ?? titleCase(m?.identifier ?? id);
  };
  /** Form name for encounters with a non-default Pokémon, e.g. "Alolan Form". */
  const encounterForm = (pokemonId: string) =>
    defaultPokemonIds.has(pokemonId) ? undefined : formName.get(defaultFormOf.get(pokemonId)?.id ?? '')?.form_name || undefined;

  const wild = encounters.filter((e) => gameVersions.has(e.version_id) && (speciesOfPokemon.get(e.pokemon_id) ?? Infinity) <= index.length);
  /** Condition values used for each game, area and method, so a note only names a real limit. */
  const seenInArea = new Map<string, Set<string>>();
  for (const e of wild) {
    const key = `${e.version_id}|${e.location_area_id}|${slotById.get(e.encounter_slot_id)!.encounter_method_id}`;
    const seen = seenInArea.get(key) ?? new Set();
    for (const c of conditionIds(e)) seen.add(c);
    seenInArea.set(key, seen);
  }

  await mkdir(join(OUT, 'locations'), { recursive: true });
  const wildBySpecies = groupBy(wild, (e) => speciesOfPokemon.get(e.pokemon_id)!);
  const gamesWithEncounters = new Set<string>();
  for (const { id } of index) {
    // Area, method, note and form repeat across games, so rows point into one string table; 0 is "".
    const strings = [''];
    const ref = (text = '') => {
      const i = strings.indexOf(text);
      return i >= 0 ? i : strings.push(text) - 1;
    };
    const byGame: Record<string, unknown[]> = {};
    const slotKey = (e: Row) => {
      const slot = slotById.get(e.encounter_slot_id)!;
      return [e.version_id, e.location_area_id, slot.encounter_method_id, e.pokemon_id].join('|');
    };
    const groups = [...groupBy(wildBySpecies.get(id) ?? [], slotKey)].sort(([a], [b]) => {
      const [, areaA, methodA, monA] = String(a).split('|').map(Number);
      const [, areaB, methodB, monB] = String(b).split('|').map(Number);
      return areaA - areaB || methodA - methodB || monA - monB;
    });
    for (const [key, rows] of groups) {
      const [versionId, areaId, methodId, pokemonId] = String(key).split('|');
      const slots = rows.map((e) => ({
        slot: e.encounter_slot_id,
        min: Number(e.min_level),
        max: Number(e.max_level),
        rarity: Number(slotById.get(e.encounter_slot_id)!.rarity),
        conditions: conditionIds(e),
      }));
      const s = summariseSlots(slots, conditionValues, seenInArea.get(`${versionId}|${areaId}|${methodId}`)!);
      const rate = gameVersions.get(versionId)!.version_group_id === LETS_GO ? 0 : s.rate;
      (byGame[versionId] ??= []).push([
        ref(areaName(areaId)), ref(methodLabel(methodId)), s.min, s.max, rate, s.upTo ? 1 : 0, ref(s.note), ref(encounterForm(pokemonId)),
      ]);
      gamesWithEncounters.add(versionId);
    }
    await writeFile(join(OUT, 'locations', `${id}.json`), JSON.stringify({ strings, games: byGame }));
  }
  const versionGroupById = new Map(versionGroups.map((g) => [g.id, g]));
  const gameList = [...gamesWithEncounters]
    .map((id) => gameVersions.get(id)!)
    .sort(
      (a, b) =>
        Number(versionGroupById.get(a.version_group_id)?.order) - Number(versionGroupById.get(b.version_group_id)?.order) ||
        Number(a.id) - Number(b.id),
    )
    .map((v) => ({
      id: Number(v.id),
      label: versionName.get(v.id) ?? v.identifier,
      gen: Number(versionGroupById.get(v.version_group_id)?.generation_id),
    }));

  const builtAt = buildTime().toISOString();
  const version = builtAt.slice(0, 10).replace(/-/g, '');
  await writeFile(join(OUT, 'index.json'), JSON.stringify(index));
  await writeFile(join(OUT, 'types.json'), JSON.stringify({ types: battleTypes.map((t) => t.identifier), matrix }));
  await writeFile(join(OUT, 'moves.json'), JSON.stringify(moveTable));
  await writeFile(join(OUT, 'versions.json'), JSON.stringify(versionList));
  await writeFile(join(OUT, 'items.json'), JSON.stringify(itemTable));
  await writeFile(join(OUT, 'games.json'), JSON.stringify(gameList));
  await writeFile(join(OUT, 'reference', 'abilities.json'), JSON.stringify(abilityTable));
  await writeFile(join(OUT, 'reference', 'items.json'), JSON.stringify(itemReference));
  await writeFile(join(OUT, 'meta.json'), JSON.stringify({ version, builtAt, species: index.length }));
  console.log(
    `Done: ${index.length} species, ${battleTypes.length} types, ${usedMoves.size} moves, ` +
      `${versionList.length} games, ${chains.size} evolution chains, ${Object.keys(itemTable).length} items, ` +
      `${gameList.length} games with encounters, ` +
      `${formCount} forms → public/data (version ${version})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
