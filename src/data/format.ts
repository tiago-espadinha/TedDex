const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
export const roman = (n: number) => ROMAN[n] ?? String(n);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const formatNo = (id: number) => `#${String(id).padStart(4, '0')}`;

/** 0 → "0", 0.25 → "¼", 0.5 → "½", 1 → "", 2 → "2×", 4 → "4×" */
export function formatMultiplier(m: number): string {
  if (m === 0) return '0';
  if (m === 0.25) return '¼';
  if (m === 0.5) return '½';
  if (m === 1) return '';
  return `${m}×`;
}
