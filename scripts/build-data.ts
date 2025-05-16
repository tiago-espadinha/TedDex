/**
 * Data build: turns PokeAPI's open CSV dump into the compact JSON the app ships.
 *
 *   npm run data          # download (cached in .cache/) and emit public/data/
 *   npm run data -- --fresh   # ignore the cache and re-download
 *
 * Output (all under public/data/):
 *   index.json            one row per species (default form): grid, search, filters
 *   types.json            18 types + full damage matrix (attacker -> defender -> factor)
 *   species/<id>.json     detail page data, loaded on demand
 *   learnsets/<id>.json   moves per version group (level-up, TM, tutor, egg), loaded by the Moves tab
 *   moves.json            every move a learnset references: name, type, category, power, accuracy, PP
 *   versions.json         main-series version groups that have learnsets, oldest first
 *   evolution/<chain>.json  evolution chain members with English condition text, loaded by the Evolution tab
 *   items.json            held items a team member can carry: item id -> English name
 *   meta.json             data version + build time
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'csv');
const OUT = join(ROOT, 'public', 'data');
const ENGLISH = 9;
const FRESH = process.argv.includes('--fresh');
/** Version groups left out of the game picker: Colosseum, XD, Japan-only Red/Green/Blue, Champions. */
const SKIPPED_VERSION_GROUPS = new Set(['12', '13', '28', '29', '32']);
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
    itemNames,
    locationNames,
    typeNames,
    triggerProse,
    items,
    itemCategories,
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
        'item_names',
        'location_names',
        'type_names',
        'evolution_trigger_prose',
        'items',
        'item_categories',
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
  const usedVersionGroups = new Set<string>();

  const STAT_KEYS = ['', 'hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, 'species'), { recursive: true });
  await mkdir(join(OUT, 'learnsets'), { recursive: true });

  const index = [];
  const ordered = [...species].sort((a, b) => Number(a.id) - Number(b.id));
  for (const s of ordered) {
    const p = defaultPokemon.get(s.id);
    if (!p) continue;
    const t = (typesByPokemon.get(p.id) ?? [])
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map((r) => typeName.get(r.type_id))
      .filter((x): x is string => !!x);
    const stats: Record<string, number> = {};
    for (const r of statsByPokemon.get(p.id) ?? []) {
      const key = STAT_KEYS[Number(r.stat_id)];
      if (key) stats[key] = Number(r.base_stat);
    }
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const n = names.get(s.id);
    const id = Number(s.id);

    index.push({
      id,
      name: n?.name ?? s.identifier,
      types: t,
      gen: Number(s.generation_id),
      total,
    });

    const detail = {
      id,
      slug: s.identifier,
      name: n?.name ?? s.identifier,
      genus: n?.genus ?? '',
      types: t,
      gen: Number(s.generation_id),
      heightM: Number(p.height) / 10,
      weightKg: Number(p.weight) / 10,
      stats,
      total,
      abilities: (abilitiesByPokemon.get(p.id) ?? [])
        .sort((a, b) => Number(a.slot) - Number(b.slot))
        .map((a) => ({ name: abilityName.get(a.ability_id) ?? `#${a.ability_id}`, hidden: a.is_hidden === '1' })),
      flavor: flavorBySpecies.get(s.id)?.text ?? '',
      legendary: s.is_legendary === '1',
      mythical: s.is_mythical === '1',
      evolutionChainId: Number(s.evolution_chain_id) || null,
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

  const version = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await writeFile(join(OUT, 'index.json'), JSON.stringify(index));
  await writeFile(join(OUT, 'types.json'), JSON.stringify({ types: battleTypes.map((t) => t.identifier), matrix }));
  await writeFile(join(OUT, 'moves.json'), JSON.stringify(moveTable));
  await writeFile(join(OUT, 'versions.json'), JSON.stringify(versionList));
  await writeFile(join(OUT, 'items.json'), JSON.stringify(itemTable));
  await writeFile(join(OUT, 'meta.json'), JSON.stringify({ version, builtAt: new Date().toISOString(), species: index.length }));
  console.log(
    `Done: ${index.length} species, ${battleTypes.length} types, ${usedMoves.size} moves, ` +
      `${versionList.length} games, ${chains.size} evolution chains, ${Object.keys(itemTable).length} items → public/data (version ${version})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
