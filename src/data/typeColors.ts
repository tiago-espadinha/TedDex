import type { TypeName } from './types';

/**
 * Design A type palette. `chip` carries white text (all pass 4.5:1);
 * `tint` is the light card background for that type.
 */
export const TYPE_COLORS: Record<TypeName, { chip: string; tint: string }> = {
  normal: { chip: '#6B6B55', tint: '#EFEFE8' },
  fire: { chip: '#B8410E', tint: '#FBE4D6' },
  water: { chip: '#1F62AD', tint: '#DCE8F7' },
  grass: { chip: '#3B7D2E', tint: '#E3F0DD' },
  electric: { chip: '#8F6E00', tint: '#FAF0C8' },
  ice: { chip: '#2B7F8C', tint: '#DDF1F2' },
  fighting: { chip: '#A3302A', tint: '#F6DEDB' },
  poison: { chip: '#7B3FA0', tint: '#EFE3F5' },
  ground: { chip: '#82612A', tint: '#F3E9D6' },
  flying: { chip: '#4A64B0', tint: '#E3E9F8' },
  psychic: { chip: '#B0336A', tint: '#F8DFEA' },
  bug: { chip: '#5B7512', tint: '#ECF1D6' },
  rock: { chip: '#756628', tint: '#EFEBD8' },
  ghost: { chip: '#5A4A8A', tint: '#E7E3F2' },
  dragon: { chip: '#4E3BB0', tint: '#E4E0F8' },
  dark: { chip: '#4E4038', tint: '#E8E3DF' },
  steel: { chip: '#5A6676', tint: '#E4E8EC' },
  fairy: { chip: '#A3437A', tint: '#F7E0EC' },
};
