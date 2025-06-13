import type { EvolutionMember } from './types';

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
