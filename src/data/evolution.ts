import type { EvolutionMember, IndexEntry, SpeciesDetail } from './types';
import { REGIONAL_FORM } from './forms';

/**
 * A chain member as shown: in form `form` ('' = default), evolving from its parent's form `fromForm` by `conditions`.
 * `region` names the region on the arrow of a regional branch folded into the species' own line.
 */
export type ChainStage = Omit<EvolutionMember, 'steps'> & { form: string; fromForm: string; region?: string };

/**
 * The chain as seen from species `id` in form `formKey`: the members that line passes through, each in its form.
 * Ancestors are in the form the steps came from (Alolan Raichu from plain Pikachu); descendants of a member in a form
 * follow its steps or are left out (Galarian Meowth gives Perrserker, not Persian). Forms with no steps in the chain
 * (Megas, Rotom) see the plain chain.
 */
export function chainInForm(chain: EvolutionMember[], id: number, formKey: string): ChainStage[] {
  const plain = chain.map(({ id, from, conditions }) => ({ id, from, conditions, form: '', fromForm: '' }));
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
      out.push({ id: m.id, from: m.from, fromForm: parentForm, ...shown });
      walk(m.id, shown.form);
    }
  };
  walk(null, '');
  return out;
}

/** Region of a regional form key ("galar-zen" → "galar"), or undefined. */
const regionOf = (key: string) => key.match(REGIONAL_FORM)?.[1];

/**
 * The line a page of species `id` in form `formKey` follows: forms evolve only along their own line, so plain Rattata
 * never shows Alolan Raticate, nor the Alolan form plain Raticate. A species only a regional form reaches shows that
 * form's line (Perrserker), and a stage with nothing to follow shows none (plain Farfetch'd). A region that starts
 * after the base is a real fork of the own line, on all its pages (Cubone → Marowak | Alolan Marowak). A non-regional
 * form with steps keeps its own line (Low Key Toxtricity); other forms see the plain chain.
 */
export function evolutionLine(chain: EvolutionMember[], id: number, formKey: string): ChainStage[] {
  const byId = new Map(chain.map((m) => [m.id, m]));
  const depth = (memberId: number): number => {
    const from = byId.get(memberId)?.from;
    return from == null ? 0 : 1 + depth(from);
  };
  const regionalOnly = new Set(chain.filter((m) => m.steps?.some((s) => s.into === '' && regionOf(s.from))).map((m) => m.id));
  const dropped = new Set<number>();
  const plain = chainInForm(chain, id, regionOf(formKey) ? '' : formKey);
  for (const s of plain) if (regionalOnly.has(s.id) || (s.from !== null && dropped.has(s.from))) dropped.add(s.id);
  const own = plain.filter((s) => !dropped.has(s.id));

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
  const regional = new Map<string, ChainStage[]>();
  for (const [region, view] of views) {
    const stages = chainInForm(chain, view.id, view.key);
    const branch = regionalBranch(stages, view, own);
    if (branch) own.push(...branch);
    else regional.set(region, stages);
  }
  const regionOnly = own.some((s) => s.id === id) ? undefined : [...regional.values()].find((l) => l.some((s) => s.id === id));
  const line = regional.get(regionOf(formKey) ?? '') ?? regionOnly ?? own;
  return line.length > 1 ? line : [];
}

/** The part of a regional line to fold into the `own` line: from `view` on, when its parent there is in default form. */
function regionalBranch(stages: ChainStage[], view: { id: number; key: string }, own: ChainStage[]): ChainStage[] | undefined {
  const start = stages.findIndex((s) => s.id === view.id);
  const parent = stages[start].from;
  if (parent === null || stages[start].fromForm || !own.some((s) => s.id === parent && !s.form)) return undefined;
  const region = regionOf(view.key)!;
  const branch: ChainStage[] = [{ ...stages[start], region: region.charAt(0).toUpperCase() + region.slice(1) }];
  // Stages come parent first, so one test keeps the descendants and leaves out what forks off above the view.
  for (const s of stages.slice(start + 1)) if (branch.some((b) => b.id === s.from && b.form === s.fromForm)) branch.push(s);
  return branch;
}

/** What `stage` evolves into: Galarian Mr. Mime leads to Mr. Rime, plain Mr. Mime to nothing. */
export const targetsOf = (stages: ChainStage[], stage: ChainStage) => stages.filter((s) => s.from === stage.id && s.fromForm === stage.form);

/**
 * Species of the chain (`id` itself when it has no chain) with Mega or Primal forms, `id` first, whichever stage is
 * shown: Ivysaur's page leads to Venusaur's Mega.
 */
export function megaSpecies(chain: EvolutionMember[], index: IndexEntry[], id: number): number[] {
  const hasMega = new Set(index.filter((s) => s.forms?.some((f) => f.kind === 'mega')).map((s) => s.id));
  return [...new Set([id, ...chain.map((m) => m.id)])].filter((m) => hasMega.has(m));
}

/**
 * The Mega and Primal forms a page in form `formKey` lists. Only default forms Mega Evolve, so a regional form's page
 * lists none: Galarian Slowpoke never becomes Mega Slowbro, nor Alolan Raichu Mega Raichu.
 */
export const megaForms = (owners: SpeciesDetail[], formKey: string) =>
  regionOf(formKey) ? [] : owners.flatMap((owner) => (owner.forms ?? []).filter((f) => f.trigger).map((form) => ({ owner, form })));

/** `megas` by species, so Charizard's two Megas share one graph while Gardevoir and Gallade each keep their own. */
export const megaGroups = (megas: ReturnType<typeof megaForms>) =>
  [...new Set(megas.map((m) => m.owner))].map((owner) => ({ owner, forms: megas.filter((m) => m.owner === owner).map((m) => m.form) }));

/**
 * The form of species `id` to highlight as the one shown in form `formKey`: the form itself when the line has it, else a
 * form of its region (Galarian Zen Darmanitan → Galarian Standard), else the default form (Megas).
 */
export function currentForm(stages: ChainStage[], id: number, formKey: string): string {
  const forms = stages.filter((s) => s.id === id).map((s) => s.form);
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
