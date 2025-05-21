import type { Locations } from './types';

export interface Encounter {
  area: string;
  method: string;
  /** "Lv. 2–4", or "Lv. 32" when there is one level. */
  levels: string;
  /** "45%", "Up to 45%" when it depends on time, season or other conditions, or '' when unknown (Let's Go). */
  chance: string;
  note: string;
  /** Form name when it isn't the default form, e.g. "Alolan Form"; '' otherwise. */
  form: string;
}

/** A game's encounters with their strings looked up, in build order (by area, then method). */
export function encountersIn(data: Locations, game: number): Encounter[] {
  return (data.games[game] ?? []).map(([area, method, min, max, rate, upTo, note, form]) => ({
    area: data.strings[area],
    method: data.strings[method],
    levels: min === max ? `Lv. ${min}` : `Lv. ${min}–${max}`,
    chance: rate ? `${upTo ? 'Up to ' : ''}${rate}%` : '',
    note: data.strings[note],
    form: data.strings[form],
  }));
}
