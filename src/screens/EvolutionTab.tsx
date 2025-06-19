import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { itemSpriteUrl, loadEvolution, loadIndex, loadSpecies, useLoad } from '../data/api';
import { branches, currentForm, evolutionLine, megaForms, megaSpecies, shortCondition, targetsOf, type ChainStage } from '../data/evolution';
import type { FormVariant, IndexEntry, SpeciesDetail } from '../data/types';
import { Loading, MonName } from '../components/bits';
import { MonImg } from '../components/MonImg';

async function loadAll(chainId: number | null, id: number) {
  const [chain, index] = await Promise.all([chainId ? loadEvolution(chainId) : Promise.resolve([]), loadIndex()]);
  const megaOwners = await Promise.all(megaSpecies(chain, index, id).map(loadSpecies));
  return { chain, index, megaOwners };
}

/** `mon` is the species as shown in form `formKey`: the line that form follows, then its chain's Megas and Primals. */
export function EvolutionTab({ mon, formKey }: { mon: SpeciesDetail; formKey: string }) {
  const chainId = mon.evolutionChainId;
  const { data, error } = useLoad(() => loadAll(chainId, mon.id), mon.id);

  if (error) return <Section title="Evolution"><p className="hint">Couldn't load the evolution chain. {error.message}</p></Section>;
  if (!data) return <Loading minHeight={160} />;
  const { chain, index, megaOwners } = data;
  const species = new Map(index.map((s) => [s.id, s]));
  const stages = evolutionLine(chain, mon.id, formKey);
  const current = { id: mon.id, form: currentForm(stages, mon.id, formKey) };
  const megas = megaForms(megaOwners, formKey);

  return (
    <>
      <Section title="Evolution">
        {stages.length ? (
          <Line stages={stages} species={species} current={current} />
        ) : (
          <p className="hint">{mon.name} does not evolve.</p>
        )}
      </Section>
      {megas.length > 0 && (
        <Section title={megas.every(({ form }) => form.key === 'primal') ? 'Primal Reversion' : 'Mega Evolution'}>
          <ul className="evo-card evo-megas">
            {megas.map(({ owner, form }) => (
              <MegaRow key={`${owner.id}-${form.key}`} mon={owner} form={form} shownForm={owner.id === mon.id ? formKey : null} />
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

type Species = Map<number, IndexEntry>;
type Current = { id: number; form: string };

/** A line as one row with the method over each arrow, or, when it forks, as a fan of targets under each stage. */
function Line({ stages, species, current }: { stages: ChainStage[]; species: Species; current: Current }) {
  const mon = (s: ChainStage) => <Mon stage={s} species={species.get(s.id)} current={current} />;
  return branches(stages) ? (
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
}

/** `stage` and what it evolves into: one target goes straight below, several share a bracket and a grid. */
function fan(stages: ChainStage[], stage: ChainStage, mon: (s: ChainStage) => ReactNode): ReactNode {
  const next = targetsOf(stages, stage);
  const target = (s: ChainStage) => (
    <>
      <Step conditions={s.conditions} region={s.region} down />
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
            <li key={`${s.id}:${s.form}`}>{target(s)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function Step({ conditions, region, down = false }: { conditions: string[]; region?: string; down?: boolean }) {
  return (
    <span className={down ? 'evo-step down' : 'evo-step'}>
      {conditions.map((c) => (
        <b key={c}>
          {shortCondition(c)}
          {region && ` · ${region}`}
        </b>
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
  /** The form of `mon` this page shows; null on another species' page. */
  shownForm: string | null;
}

/** The species ⇄ one Mega or Primal form, with the stone, orb or move it takes. */
function MegaRow({ mon, form, shownForm }: MegaRowProps) {
  const trigger = form.trigger!;
  return (
    <li>
      <MonTile mediaId={mon.id} speciesId={mon.id} name={mon.name} to={`/pokemon/${mon.id}`} current={shownForm === ''} />
      <span className="evo-step mega">
        <b>
          {trigger.kind === 'item' && <img src={itemSpriteUrl(trigger.id)} alt="" width={24} height={24} loading="lazy" />}
          {trigger.kind === 'item' ? 'Hold' : 'Know'} {trigger.name}
        </b>
        <svg viewBox="0 0 56 14" aria-hidden="true">
          <path d="M4 7h48M45 2l7 5-7 5M11 2L4 7l7 5" />
        </svg>
      </span>
      <MonTile mediaId={form.pokemonId} speciesId={mon.id} name={form.name} to={`/pokemon/${mon.id}?form=${form.key}`} current={shownForm === form.key} />
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
