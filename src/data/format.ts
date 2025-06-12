import type { StatBlock } from './types';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
export const roman = (n: number) => ROMAN[n] ?? String(n);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** +1, −3, 0 (a real minus sign). */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
export const formatNo = (id: number, digits = 4) => `#${String(id).padStart(digits, '0')}`;

/** 0 → "0", 0.25 → "¼", 0.5 → "½", 1 → "", 2 → "2×", 4 → "4×" */
export function formatMultiplier(m: number): string {
  if (m === 0) return '0';
  if (m === 0.25) return '¼';
  if (m === 0.5) return '½';
  if (m === 1) return '';
  return `${m}×`;
}

const STAT_SHORT = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' } as const;

/** { atk: 2, spe: 1 } → [{ stat: 'atk', text: "2 Atk" }, { stat: 'spe', text: "1 Speed" }], in stat order; {} → []. */
export function evYieldParts(ev: Partial<Record<keyof typeof STAT_SHORT, number>>): { stat: keyof typeof STAT_SHORT; text: string }[] {
  return (Object.keys(STAT_SHORT) as (keyof typeof STAT_SHORT)[]).filter((k) => ev[k]).map((k) => ({ stat: k, text: `${ev[k]} ${STAT_SHORT[k]}` }));
}

/** Catch rate (3–255) → the chance with a Poké Ball at full HP and no status, about rate / 3 / 255: 45 → "5.9%", 255 → "33.3%". */
export const catchChance = (rate: number) => `${((Math.min(255, rate) / 3 / 255) * 100).toFixed(1)}%`;

/** Female share in eighths (-1 genderless) → "87.5% ♂ · 12.5% ♀", "100% ♂", "Genderless". */
export function genderText(rate: number): string {
  if (rate < 0) return 'Genderless';
  const female = (rate / 8) * 100;
  if (female === 0) return '100% ♂';
  if (female === 100) return '100% ♀';
  return `${100 - female}% ♂ · ${female}% ♀`;
}

/** Shop price in Pokédollars: 4000 → "₽4,000"; 0 (not sold) → "—". */
export const formatPrice = (cost: number) => (cost > 0 ? `₽${cost.toLocaleString('en-US')}` : '—');

/** A base stat bar's colour: high from 90, mid from 60, else low. */
export const statColor = (v: number) => (v >= 90 ? 'var(--stat-high)' : v >= 60 ? 'var(--stat-mid)' : 'var(--stat-low)');

/** Base stat keys with their labels, in game order. */
export const STAT_ROWS: [keyof StatBlock, string][] = [
  ['hp', 'HP'],
  ['atk', 'Attack'],
  ['def', 'Defense'],
  ['spa', 'Sp. Atk'],
  ['spd', 'Sp. Def'],
  ['spe', 'Speed'],
];

/** A score with its sign: 2 → "+2", −1 → "−1" (a minus sign), 0 → "0". */
export const formatScore = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
