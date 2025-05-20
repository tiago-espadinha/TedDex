import type { FormVariant, SpeciesDetail } from './types';

/**
 * The species as seen in form `key`: its name, types, stats, abilities and size replaced by the
 * form's. Unknown or empty keys give the default form. `mediaId` is the id its sprite and artwork use.
 */
export function applyForm(mon: SpeciesDetail, key: string | null): { view: SpeciesDetail; form?: FormVariant; mediaId: number } {
  const form = key ? mon.forms?.find((f) => f.key === key) : undefined;
  if (!form) return { view: mon, mediaId: mon.id };
  const { name, types, stats, total, abilities, heightM, weightKg } = form;
  return { view: { ...mon, name, types, stats, total, abilities, heightM, weightKg }, form, mediaId: form.pokemonId };
}
