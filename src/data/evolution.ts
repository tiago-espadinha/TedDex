import type { EvolutionMember } from './types';
import { REGIONAL_FORM } from './forms';

/** A chain member as shown: in form `form` ('' = default), evolving by `conditions`. */
export type ChainStage = Omit<EvolutionMember, 'steps'> & { form: string };

/**
 * The chain as seen from species `id` in form `formKey`: the members that line passes through, each in its form.
 * Ancestors are in the form the steps came from (Alolan Raichu from plain Pikachu); descendants of a member in a form
 * follow its steps or are left out (Galarian Meowth gives Perrserker, not Persian). Forms with no steps in the chain
 * (Megas, Rotom) see the plain chain.
 */
export function chainInForm(chain: EvolutionMember[], id: number, formKey: string): ChainStage[] {
  const plain = chain.map(({ id, from, conditions }) => ({ id, from, conditions, form: '' }));
  const byId = new Map(chain.map((m) => [m.id, m]));
  const inSteps = (key: string) => chain.some((m) => m.steps?.some((s) => s.from === key || s.into === key));
  // A sub-form without steps follows its region's line: Galarian Zen Darmanitan evolves as Galarian Standard.
  const region = formKey.split('-')[0];
  const lineKey = inSteps(formKey) ? formKey : byId.get(id)?.steps?.find((s) => s.into.split('-')[0] === region)?.into;
  if (!formKey || !lineKey) return plain;

  const path = new Map<number, { form: string; conditions: string[] }>();
  for (let m = byId.get(id), form = lineKey; m; ) {
    const step = form ? m.steps?.find((s) => s.into === form) : undefined;
    path.set(m.id, { form, conditions: step?.conditions ?? m.conditions });
    form = step?.from ?? '';
    m = m.from === null ? undefined : byId.get(m.from);
  }
  path.get(id)!.form = formKey;

  const out: ChainStage[] = [];
  const walk = (parent: number | null, parentForm: string) => {
    for (const m of chain.filter((c) => c.from === parent)) {
      let shown = path.get(m.id);
      if (!shown && parentForm) {
        const steps = m.steps?.filter((s) => s.from === parentForm) ?? [];
        if (!steps.length) continue;
        shown = { form: steps[0].into, conditions: [...new Set(steps.flatMap((s) => s.conditions))] };
      }
      shown ??= { form: '', conditions: m.conditions };
      out.push({ id: m.id, from: m.from, ...shown });
      walk(m.id, shown.form);
    }
  };
  walk(null, '');
  return out;
}

/** One chain to draw: the species' own line (`key` '') or a regional form's (`key` = the form its line is seen in). */
export interface EvolutionLine {
  key: string;
  /** Species id the line is seen from, whose form `key` names it. */
  viewId: number;
  stages: ChainStage[];
}

/** Region of a regional form key ("galar-zen" → "galar"), or undefined. */
const regionOf = (key: string) => key.match(REGIONAL_FORM)?.[1];

/**
 * Every line of the chain, as seen on species `id` in form `formKey`: first its own line (in that form when the form
 * has its own steps, Low Key Toxtricity; the plain chain for regional forms and Megas), without members only a
 * regional form evolves into (Perrserker), then one line per region whose forms are in the chain, seen from that
 * region's form nearest the base (Galarian Meowth → Perrserker). Lines of one stage are left out.
 */
export function evolutionLines(chain: EvolutionMember[], id: number, formKey: string): EvolutionLine[] {
  const byId = new Map(chain.map((m) => [m.id, m]));
  const depth = (memberId: number): number => {
    const from = byId.get(memberId)?.from;
    return from == null ? 0 : 1 + depth(from);
  };
  const regionalOnly = new Set(chain.filter((m) => m.steps?.some((s) => s.into === '' && regionOf(s.from))).map((m) => m.id));
  const ownKey = regionOf(formKey) ? '' : formKey;
  const own = chainInForm(chain, id, ownKey);
  const dropped = new Set<number>();
  for (const s of own) if (regionalOnly.has(s.id) || (s.from !== null && dropped.has(s.from))) dropped.add(s.id);
  const lines: EvolutionLine[] = [{ key: '', viewId: id, stages: own.filter((s) => !dropped.has(s.id)) }];

  // Each region's line is seen from its shallowest form: the species a step goes into or comes from.
  const views = new Map<string, { id: number; key: string }>();
  for (const m of chain) {
    for (const s of m.steps ?? []) {
      const candidates = [{ id: m.id, key: s.into }, ...(m.from !== null ? [{ id: m.from, key: s.from }] : [])];
      for (const c of candidates) {
        const region = regionOf(c.key);
        const seen = region && views.get(region);
        if (region && (!seen || depth(c.id) < depth(seen.id))) views.set(region, c);
      }
    }
  }
  for (const view of views.values()) lines.push({ key: view.key, viewId: view.id, stages: chainInForm(chain, view.id, view.key) });
  return lines.filter((l) => l.stages.length > 1);
}

/**
 * The form of species `id` to highlight as the one shown in form `formKey`: the form itself when a line has it, else a
 * form of its region (Galarian Zen Darmanitan → Galarian Standard), else the default form (Megas).
 */
export function currentForm(lines: EvolutionLine[], id: number, formKey: string): string {
  const forms = lines.flatMap((l) => l.stages).filter((s) => s.id === id).map((s) => s.form);
  if (forms.includes(formKey)) return formKey;
  const region = regionOf(formKey);
  return forms.find((f) => region && regionOf(f) === region) ?? '';
}

/** Whether a line forks anywhere, so it is drawn as a fan instead of a row. */
export const branches = (stages: ChainStage[]) => new Set(stages.map((s) => s.from)).size < stages.length;

const SHORT_PARTS: [RegExp, string][] = [
  [/^Lv\. (\d+)$/, 'Lv $1'],
  [/^high friendship$/, 'friendship'],
  [/^during the day$/, 'day'],
  [/^at night$/, 'night'],
  [/^at dusk$/, 'dusk'],
  [/^50% chance$/, 'random'],
  [/^Attack ([<>=]) Defense$/, 'Atk $1 Def'],
  [/^knowing a (\w+)-type move$/, '$1 move'],
  [/^knowing (.+)$/, 'know $1'],
  [/^holding (.+)$/, 'hold $1'],
  [/^Trade holding (.+)$/, 'Trade, hold $1'],
  [/^Use (?!.* times$)(.+)$/, '$1'],
];

/**
 * A condition as short as fits over an arrow: "Level up · high friendship · during the day" → "Friendship, day",
 * "Lv. 16" → "Lv 16", "Use Water Stone" → "Water Stone". Parts with no short form stay as they are.
 */
export function shortCondition(condition: string): string {
  const parts = condition.split(' · ');
  const kept = parts.length > 1 ? parts.filter((p) => p !== 'Level up') : parts;
  const text = kept
    .map((part) => SHORT_PARTS.reduce((out, [pattern, short]) => (pattern.test(out) ? out.replace(pattern, short) : out), part))
    .join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
