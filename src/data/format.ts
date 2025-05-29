const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
export const roman = (n: number) => ROMAN[n] ?? String(n);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** +1, −3, 0 (a real minus sign). */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
export const formatNo = (id: number) => `#${String(id).padStart(4, '0')}`;

/** 0 → "0", 0.25 → "¼", 0.5 → "½", 1 → "", 2 → "2×", 4 → "4×" */
export function formatMultiplier(m: number): string {
  if (m === 0) return '0';
  if (m === 0.25) return '¼';
  if (m === 0.5) return '½';
  if (m === 1) return '';
  return `${m}×`;
}

const STAT_SHORT = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' } as const;

/** { spa: 1 } → "1 Sp. Atk"; { atk: 2, spe: 1 } → "2 Atk, 1 Speed"; {} → "None". */
export function evYieldText(ev: Partial<Record<keyof typeof STAT_SHORT, number>>): string {
  const parts = (Object.keys(STAT_SHORT) as (keyof typeof STAT_SHORT)[]).filter((k) => ev[k]).map((k) => `${ev[k]} ${STAT_SHORT[k]}`);
  return parts.length ? parts.join(', ') : 'None';
}

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
