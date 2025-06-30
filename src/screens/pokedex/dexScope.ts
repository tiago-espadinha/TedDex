import type { Pokedex } from '../../data/db';
import { lastSpecies } from '../../data/pokedex';
import type { VersionGroup } from '../../data/types';

/**
 * The game's label and how many species the Pokédex lists; undefined until versions.json loads.
 * A game the data no longer has lists every species; a custom Pokédex lists its own.
 */
export function dexScope(dex: Pokedex, versions?: VersionGroup[]) {
  if (dex.species) return { label: 'Custom', last: lastSpecies(), known: false };
  if (dex.game === undefined) return { label: 'National', last: lastSpecies(), known: false };
  if (!versions) return undefined;
  const version = versions.find((v) => v.id === dex.game);
  return version
    ? { label: version.label, last: lastSpecies(version.gen), known: true }
    : { label: 'Unknown game', last: lastSpecies(), known: false };
}
