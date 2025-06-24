import type { FormKind, FormVariant, IndexEntry, SpeciesDetail, StatBlock, TypeName } from './types';

/** Form keys of regional variants: "alola", "galar-zen", "paldea-aqua-breed"… */
export const REGIONAL_FORM = /^(alola|galar|hisui|paldea)\b/;

/** Which Dex switch shows a form as its own row: Gigantamax first ("amped-gmax"), then Megas and Primals ("curly-mega"). */
export function formKind(key: string): FormKind {
  if (/gmax$/.test(key)) return 'gmax';
  if (/(^|-)mega($|-)/.test(key) || key === 'primal') return 'mega';
  if (REGIONAL_FORM.test(key)) return 'regional';
  return 'other';
}

/**
 * Whether form `key` has moves and wild encounters of its own. Megas, Primals and Gigantamax change only in battle:
 * they learn and are found as their species.
 */
export const hasOwnFormData = (key: string) => !!key && formKind(key) !== 'mega' && formKind(key) !== 'gmax';

/**
 * The species as seen in form `key`: its name, types, stats, abilities, size and EV yield replaced by the
 * form's. Unknown or empty keys give the default form. `mediaId` is the id its sprite and artwork use.
 */
export function applyForm(mon: SpeciesDetail, key: string | null): { view: SpeciesDetail; form?: FormVariant; mediaId: number } {
  const form = key ? mon.forms?.find((f) => f.key === key) : undefined;
  if (!form) return { view: mon, mediaId: mon.id };
  const { name, types, stats, total, abilities, heightM, weightKg, evYield } = form;
  return { view: { ...mon, name, types, stats, total, abilities, heightM, weightKg, evYield }, form, mediaId: form.pokemonId };
}

/**
 * What a team slot shows for a member: its name, types, base stats, the id its sprite uses and whether it is shiny,
 * and its form's abilities when the species file is loaded (the grid row has none).
 */
export interface MemberView {
  name: string;
  types: TypeName[];
  stats: StatBlock;
  total: number;
  mediaId: number;
  /** Its species, whose sprite stands in for a form without one. */
  speciesId: number;
  shiny?: boolean;
  abilities?: SpeciesDetail['abilities'];
}

/**
 * A team member in its form when it has one and `detail` (its species file) is loaded, else as its
 * grid row. Undefined when neither is known.
 */
export function memberView(member: { speciesId: number; formKey?: string; shiny?: boolean }, row?: IndexEntry, detail?: SpeciesDetail): MemberView | undefined {
  const shiny = member.shiny && { shiny: true };
  if (member.formKey && detail) {
    const { view, mediaId } = applyForm(detail, member.formKey);
    return { name: view.name, types: view.types, stats: view.stats, total: view.total, mediaId, speciesId: member.speciesId, abilities: view.abilities, ...shiny };
  }
  return row && { name: row.name, types: row.types, stats: row.stats, total: row.total, mediaId: row.id, speciesId: row.id, ...shiny };
}
