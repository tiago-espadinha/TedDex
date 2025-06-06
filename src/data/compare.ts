import { defensiveMultipliers } from './api';
import type { TypeData, TypeName } from './types';

/** One side of the compare screen: a species and, when not the default, its form key. */
export interface CompareSlot {
  id: number;
  form?: string;
}

export type SlotName = 'a' | 'b';

export type CompareState = Partial<Record<SlotName, CompareSlot>>;

export const SLOTS: SlotName[] = ['a', 'b'];

/** The two slots from `?a=6&af=mega-x&b=9`; an id that isn't a positive whole number leaves its slot empty. */
export function parseCompare(params: URLSearchParams): CompareState {
  const out: CompareState = {};
  for (const s of SLOTS) {
    const raw = params.get(s);
    const id = raw && /^\d+$/.test(raw) ? Number(raw) : 0;
    const form = params.get(`${s}f`);
    if (id > 0) out[s] = form ? { id, form } : { id };
  }
  return out;
}

/** The search string (`a=6&af=mega-x&b=9`) for a compare state, slots in order, empty slots left out. */
export function compareSearch(state: CompareState): string {
  const params = new URLSearchParams();
  for (const s of SLOTS) {
    const slot = state[s];
    if (!slot) continue;
    params.set(s, String(slot.id));
    if (slot.form) params.set(`${s}f`, slot.form);
  }
  return params.toString();
}

/** The compare screen for `state`. */
export const comparePath = (state: CompareState) => {
  const search = compareSearch(state);
  return search ? `/compare?${search}` : '/compare';
};

/** The Dex in pick mode for `slot`, carrying the current state so the pick can return to it. */
export const comparePickPath = (slot: SlotName, state: CompareState) => {
  const search = compareSearch(state);
  return `/?compare=${slot}${search ? `&${search}` : ''}`;
};

/**
 * How each attacking type does against the defender's types, strongest first (ties keep the attacker's order).
 * Plain type chart, like the detail page's matchups.
 */
export function typeHits(attack: TypeName[], defend: TypeName[], data: TypeData): { type: TypeName; mult: number }[] {
  const mult = defensiveMultipliers(defend, data);
  return attack.map((type) => ({ type, mult: mult[type] })).sort((x, y) => y.mult - x.mult);
}

const LAST_KEY = 'compare-last';

/** Remembers the last compare's search string, so Compare from a detail page keeps the other side; an empty compare keeps the last one. */
export function rememberCompare(search: string) {
  if (!Object.keys(parseCompare(new URLSearchParams(search))).length) return;
  try {
    sessionStorage.setItem(LAST_KEY, search);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

/** Compare with `slot` on the left and a Pokémon from the last compare (its right side first) on the right. */
export function compareFrom(slot: CompareSlot): string {
  let last: CompareState = {};
  try {
    last = parseCompare(new URLSearchParams(sessionStorage.getItem(LAST_KEY) ?? ''));
  } catch {
    /* fall through */
  }
  const other = [last.b, last.a].find((s) => s && s.id !== slot.id);
  return comparePath(other ? { a: slot, b: other } : { a: slot });
}
