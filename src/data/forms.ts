import type { FormVariant, IndexEntry, SpeciesDetail, TypeName } from './types';

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
 * What a team slot shows for a member: its name, types and the id its sprite uses, and its form's abilities when
 * the species file is loaded (the grid row has none).
 */
export interface MemberView {
  name: string;
  types: TypeName[];
  mediaId: number;
  abilities?: SpeciesDetail['abilities'];
}

/**
 * A team member in its form when it has one and `detail` (its species file) is loaded, else as its
 * grid row. Undefined when neither is known.
 */
export function memberView(member: { speciesId: number; formKey?: string }, row?: IndexEntry, detail?: SpeciesDetail): MemberView | undefined {
  if (member.formKey && detail) {
    const { view, mediaId } = applyForm(detail, member.formKey);
    return { name: view.name, types: view.types, mediaId, abilities: view.abilities };
  }
  return row && { name: row.name, types: row.types, mediaId: row.id };
}
