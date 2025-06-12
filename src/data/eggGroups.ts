import type { TypeName } from './types';

/** URL key of an egg group, from its name: "Water 1" → "water-1", "Human-Like" → "human-like". Shared with the data build. */
export const eggGroupSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Chip and page colours borrowed from the type chips (white text passes 4.5:1 on each). */
export const EGG_GROUP_COLOR: Record<string, TypeName> = {
  Monster: 'fire', 'Water 1': 'water', 'Water 2': 'water', 'Water 3': 'water', Bug: 'bug', Flying: 'flying', Field: 'ground',
  Fairy: 'fairy', Grass: 'grass', 'Human-Like': 'fighting', Mineral: 'rock', Amorphous: 'ghost', Dragon: 'dragon', Ditto: 'psychic',
  Undiscovered: 'normal',
};

/** Groups that don't breed like the others, with a line for their page. */
export const EGG_GROUP_NOTE: Record<string, string> = {
  Undiscovered: "Pokémon in this group can't breed, not even with Ditto.",
  Ditto: 'Ditto breeds with any Pokémon outside the Undiscovered group, but not with another Ditto.',
};
