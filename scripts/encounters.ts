/**
 * Encounter summaries for the Locations tab, kept apart from build-data.ts so they can be tested.
 * PokeAPI lists one row per encounter slot and condition (time, season, swarm…); the tab shows one
 * line per area and method, so the slots are merged here.
 */

export interface SlotRow {
  /** encounter_slots id: PokeAPI repeats a slot once per condition it appears under. */
  slot: string;
  min: number;
  max: number;
  /** Slot chance in percent. */
  rarity: number;
  /** encounter_condition_value ids that must hold for this slot. */
  conditions: string[];
}

export interface ConditionValue {
  /** encounter_condition id (time, season, swarm…). */
  type: string;
  name: string;
}

export interface EncounterSummary {
  min: number;
  max: number;
  /** Chance in percent under the best conditions. */
  rate: number;
  /** The chance depends on the conditions, so `rate` is a best case. */
  upTo?: true;
  /** Conditions that limit the encounter, e.g. "In the morning, At night". */
  note?: string;
}

/**
 * Merges one Pokémon's slots for one area and method in one game.
 * `seen` holds every condition value used for that area, method and game: a condition only goes in the note
 * when the Pokémon is missing under one of its other values there.
 */
export function summariseSlots(
  slots: SlotRow[],
  values: Map<string, ConditionValue>,
  seen: Set<string>,
): EncounterSummary {
  const rates = new Set(ratesPerSituation(slots, values, seen).filter((r) => r > 0));
  const summary: EncounterSummary = {
    min: Math.min(...slots.map((s) => s.min)),
    max: Math.max(...slots.map((s) => s.max)),
    rate: Math.min(100, Math.max(0, ...rates)),
  };
  if (rates.size > 1) summary.upTo = true;
  const note = conditionNote(slots, values, seen);
  if (note) summary.note = note;
  return summary;
}

/**
 * Total chance in every combination of the condition values seen (morning + radio off + no swarm…).
 * A slot counts when all its conditions hold; slots without conditions count in every combination.
 */
function ratesPerSituation(slots: SlotRow[], values: Map<string, ConditionValue>, seen: Set<string>) {
  const typeOf = (id: string) => values.get(id)?.type;
  const types = [...new Set(slots.flatMap((s) => s.conditions.map(typeOf)))].filter((t): t is string => !!t);
  let situations: string[][] = [[]];
  for (const type of types) {
    const options = [...seen].filter((c) => typeOf(c) === type);
    situations = situations.flatMap((s) => options.map((c) => [...s, c]));
  }
  return situations.map((situation) => {
    const holds = new Set(situation);
    const bySlot = new Map(slots.filter((s) => s.conditions.every((c) => holds.has(c))).map((s) => [s.slot, s.rarity]));
    return [...bySlot.values()].reduce((a, b) => a + b, 0);
  });
}

function conditionNote(slots: SlotRow[], values: Map<string, ConditionValue>, seen: Set<string>) {
  const typeOf = (id: string) => values.get(id)?.type;
  const types = new Set(slots.flatMap((s) => s.conditions.map(typeOf)).filter((t): t is string => !!t));
  const parts: string[] = [];
  for (const type of [...types].sort((a, b) => Number(a) - Number(b))) {
    // A slot with no value for this condition appears whatever it is.
    if (slots.some((s) => !s.conditions.some((c) => typeOf(c) === type))) continue;
    const held = new Set(slots.flatMap((s) => s.conditions.filter((c) => typeOf(c) === type)));
    const missing = [...seen].some((c) => typeOf(c) === type && !held.has(c));
    if (!missing) continue;
    parts.push(
      [...held]
        .sort((a, b) => Number(a) - Number(b))
        .map((c) => values.get(c)!.name)
        .join(', '),
    );
  }
  return parts.join(' · ');
}
