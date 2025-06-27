import { hasOwnFormData, REGIONAL_FORM } from './forms';
import type { EncounterRow, Game, Locations } from './types';

export interface Encounter {
  area: string;
  method: string;
  /** "Lv. 2–4", "Lv. 32" when there is one level, or '' on a text row (Bulbapedia's "Trade", min 0), which has no method either. */
  levels: string;
  /** "45%", "Up to 45%" when it depends on time, season or other conditions, or '' when unknown (Let's Go). */
  chance: string;
  note: string;
  /** Form name when it isn't the default form, e.g. "Alolan Form"; '' otherwise. */
  form: string;
}

/** An encounter in a version group: `versions` names the games it is limited to, empty when it is in all of them. */
export interface GroupEncounter extends Encounter {
  versions: string[];
}

/**
 * Only the rows of form `formKey` ('' = the species), dropping games left empty. A regional form shows only its own
 * rows (no Alolan Golem in Red); any other form with data of its own shows its rows in the games that have some and is
 * found as its species elsewhere (Wash Rotom in Platinum), like the forms without such data (Megas).
 */
export function locationsOfForm(data: Locations, formKey: string): Locations {
  const keyOf = (row: EncounterRow) => (row[8] ? data.strings[row[8]] : '');
  const own = hasOwnFormData(formKey) ? formKey : '';
  const games: Locations['games'] = {};
  for (const [game, rows] of Object.entries(data.games)) {
    const ofForm = rows.filter((row) => keyOf(row) === own);
    const shown = ofForm.length || REGIONAL_FORM.test(own) ? ofForm : rows.filter((row) => keyOf(row) === '');
    if (shown.length) games[Number(game)] = shown;
  }
  return { strings: data.strings, games };
}

/** A game's encounters with their strings looked up, in build order (by area, then method). */
export function encountersIn(data: Locations, game: number): Encounter[] {
  return (data.games[game] ?? []).map(([area, method, min, max, rate, upTo, note, form]) => ({
    area: data.strings[area],
    method: data.strings[method],
    levels: !min ? '' : min === max ? `Lv. ${min}` : `Lv. ${min}–${max}`,
    chance: rate ? `${upTo ? 'Up to ' : ''}${rate}%` : '',
    note: data.strings[note],
    form: data.strings[form],
  }));
}

/**
 * The encounters of one version group's games (`games`, oldest first) merged into one list: a row that is the
 * same in every game shows once, and a row only some games have (or have with other levels or chances) names them.
 * Rows keep each game's area order; a row a later game adds goes after earlier games' rows it lacks in the same area
 * or in areas it hasn't got. Two exclusive areas between shared ones keep the earlier game's first.
 */
export function encountersInGroup(data: Locations, games: Game[]): GroupEncounter[] {
  const rows: { key: string; encounter: Encounter; versions: string[] }[] = [];
  for (const game of games) {
    const encounters = encountersIn(data, game.id).map((encounter) => ({ key: JSON.stringify(encounter), encounter }));
    const keys = new Set(encounters.map((e) => e.key));
    const areas = new Set(encounters.map((e) => e.encounter.area));
    let at = 0;
    for (const { key, encounter } of encounters) {
      const i = rows.findIndex((r) => r.key === key && !r.versions.includes(game.label));
      if (i >= 0) {
        rows[i].versions.push(game.label);
        at = i + 1;
      } else {
        // Past earlier games' rows this one lacks in the same area, or in areas it hasn't got at all.
        const skip = (r: (typeof rows)[number]) =>
          !keys.has(r.key) && (r.encounter.area === encounter.area || !areas.has(r.encounter.area));
        while (rows[at] && skip(rows[at])) at++;
        rows.splice(at++, 0, { key, encounter, versions: [game.label] });
      }
    }
  }
  return rows.map(({ encounter, versions }) => ({
    ...encounter,
    versions: versions.length === games.length ? [] : versions,
  }));
}
