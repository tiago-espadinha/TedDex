import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { itemSpriteUrl, loadEvolution, loadIndex, useLoad } from '../data/api';
import { branches, currentForm, evolutionLines, shortCondition, type ChainStage, type EvolutionLine } from '../data/evolution';
import type { FormVariant, IndexEntry, SpeciesDetail } from '../data/types';
import { Loading, MonName } from '../components/bits';
import { MonImg } from '../components/MonImg';

const loadAll = (chainId: number | null) => Promise.all([chainId ? loadEvolution(chainId) : Promise.resolve([]), loadIndex()]);

/** `mon` is the species as shown in form `formKey`: its own line, its regional lines, then its Megas and Primals. */
export function EvolutionTab({ mon, formKey }: { mon: SpeciesDetail; formKey: string }) {
  const chainId = mon.evolutionChainId;
  const { data, error } = useLoad(() => loadAll(chainId), chainId);
  const megas = mon.forms?.filter((f) => f.trigger) ?? [];

  if (error) return <Section title="Evolution"><p className="hint">Couldn't load the evolution chain. {error.message}</p></Section>;
  if (!data) return <Loading minHeight={160} />;
  const [chain, index] = data;
  const species = new Map(index.map((s) => [s.id, s]));
  const lines = evolutionLines(chain, mon.id, formKey);
  const current = { id: mon.id, form: currentForm(lines, mon.id, formKey) };
  const name = species.get(mon.id)?.name ?? mon.name;

  return (
    <>
      <Section title="Evolution">
        {lines.length ? (
          lines.map((line) => (
            <Line key={line.key} line={line} species={species} current={current} label={regionLabel(line, species)} />
          ))
        ) : (
          <p className="hint">{mon.name} does not evolve.</p>
        )}
      </Section>
      {megas.length > 0 && (
        <Section title={megas.every((f) => f.key === 'primal') ? 'Primal Reversion' : 'Mega Evolution'}>
          <ul className="evo-card evo-megas">
            {megas.map((f) => (
              <MegaRow key={f.key} mon={mon} form={f} name={name} formKey={formKey} />
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

type Species = Map<number, IndexEntry>;
type Current = { id: number; form: string };

/** "Galarian form" over a regional line, from the form label of the species it is seen from. */
function regionLabel(line: EvolutionLine, species: Species) {
  const label = line.key && species.get(line.viewId)?.forms?.find((f) => f.key === line.key)?.label;
  return label ? `${label} form` : undefined;
}

/** A line as one row with the method over each arrow, or, when it forks, as a fan of targets under each stage. */
function Line({ line, species, current, label }: { line: EvolutionLine; species: Species; current: Current; label?: string }) {
  const { stages } = line;
  const mon = (s: ChainStage) => <Mon stage={s} species={species.get(s.id)} current={current} />;
  const card = branches(stages) ? (
    <div className="evo-card evo-fan">{fan(stages, stages[0], mon)}</div>
  ) : (
    <ol className="evo-card evo-row" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${stages.length - 1}, fit-content(76px) minmax(0, 1fr))` }}>
      {stages.map((s, i) => (
        <li key={s.id}>
          {i > 0 && <Step conditions={s.conditions} />}
          {mon(s)}
        </li>
      ))}
    </ol>
  );
  return label ? (
    <section className="evo-line" aria-label={label}>
      <h3>{label}</h3>
      {card}
    </section>
  ) : (
    card
  );
}

/** `stage` and what it evolves into: one target goes straight below, several share a bracket and a grid. */
function fan(stages: ChainStage[], stage: ChainStage, mon: (s: ChainStage) => ReactNode): ReactNode {
  const next = stages.filter((s) => s.from === stage.id);
  const target = (s: ChainStage) => (
    <>
      <Step conditions={s.conditions} down />
      {fan(stages, s, mon)}
    </>
  );
  return (
    <>
      {mon(stage)}
      {next.length === 1 && target(next[0])}
      {next.length > 1 && (
        <ul className={`evo-targets cols-${next.length === 2 ? 2 : 3}`}>
          {next.map((s) => (
            <li key={s.id}>{target(s)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function Step({ conditions, down = false }: { conditions: string[]; down?: boolean }) {
  return (
    <span className={down ? 'evo-step down' : 'evo-step'}>
      {conditions.map((c) => (
        <b key={c}>{shortCondition(c)}</b>
      ))}
      {down ? (
        <svg viewBox="0 0 14 22" aria-hidden="true">
          <path d="M7 2v18M2 15l5 5 5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 40 14" aria-hidden="true">
          <path d="M2 7h34M29 2l7 5-7 5" />
        </svg>
      )}
    </span>
  );
}

function Mon({ stage, species, current }: { stage: ChainStage; species?: IndexEntry; current: Current }) {
  if (!species) return null;
  const form = species.forms?.find((f) => f.key === stage.form);
  const here = stage.id === current.id && stage.form === current.form;
  return (
    <MonTile
      mediaId={form?.pokemonId ?? species.id}
      speciesId={species.id}
      name={form?.name ?? species.name}
      to={form ? `/pokemon/${species.id}?form=${form.key}` : `/pokemon/${species.id}`}
      current={here}
    />
  );
}

function MonTile({ mediaId, speciesId, name, to, current }: { mediaId: number; speciesId: number; name: string; to: string; current: boolean }) {
  const content = (
    <>
      <MonImg id={mediaId} speciesId={speciesId} alt="" width={80} height={80} />
      <span>
        <MonName name={name} />
      </span>
    </>
  );
  return current ? (
    <div className="evo-mon current" aria-current="page">
      {content}
    </div>
  ) : (
    <Link className="evo-mon" to={to}>
      {content}
    </Link>
  );
}

interface MegaRowProps {
  mon: SpeciesDetail;
  form: FormVariant;
  /** The species' own name (`mon` may be shown as a Mega). */
  name: string;
  formKey: string;
}

/** The species ⇄ one Mega or Primal form, with the stone, orb or move it takes. */
function MegaRow({ mon, form, name, formKey }: MegaRowProps) {
  const trigger = form.trigger!;
  return (
    <li>
      <MonTile mediaId={mon.id} speciesId={mon.id} name={name} to={`/pokemon/${mon.id}`} current={formKey === ''} />
      <span className="evo-step mega">
        <b>
          {trigger.kind === 'item' && <img src={itemSpriteUrl(trigger.id)} alt="" width={24} height={24} loading="lazy" />}
          {trigger.kind === 'item' ? 'Hold' : 'Know'} {trigger.name}
        </b>
        <svg viewBox="0 0 56 14" aria-hidden="true">
          <path d="M4 7h48M45 2l7 5-7 5M11 2L4 7l7 5" />
        </svg>
      </span>
      <MonTile mediaId={form.pokemonId} speciesId={mon.id} name={form.name} to={`/pokemon/${mon.id}?form=${form.key}`} current={formKey === form.key} />
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
