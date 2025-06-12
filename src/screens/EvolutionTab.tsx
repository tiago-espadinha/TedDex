import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadEvolution, loadIndex, spriteUrl, useLoad } from '../data/api';
import { chainInForm, type ChainStage } from '../data/evolution';
import { formatNo } from '../data/format';
import { typeTint } from '../data/typeColors';
import type { IndexEntry, SpeciesDetail } from '../data/types';
import { Loading, TypeChip } from '../components/bits';

const loadAll = (chainId: number) => Promise.all([loadEvolution(chainId), loadIndex()]);

/** `mon` is the species as shown in form `formKey`; a form with its own evolutions shows that line. */
export function EvolutionTab({ mon, formKey }: { mon: SpeciesDetail; formKey: string }) {
  const chainId = mon.evolutionChainId;
  const { data, error } = useLoad(() => (chainId ? loadAll(chainId) : Promise.resolve(undefined)), chainId);

  if (error) return <Note>Couldn't load the evolution chain. {error.message}</Note>;
  if (chainId && !data) return <Loading minHeight={160} />;
  const stages = data ? chainInForm(data[0], mon.id, formKey) : [];
  if (!data || stages.length < 2) return <Note>{mon.name} does not evolve.</Note>;

  const index = data[1];
  const species = new Map(index.map((s) => [s.id, s]));
  // Nested lists, so the branch structure is visible and exposed to screen readers.
  const branch = (from: number | null): ReactNode[] =>
    stages
      .filter((m) => m.from === from)
      .flatMap((m) => {
        const s = species.get(m.id);
        if (!s) return [];
        const children = branch(m.id);
        return [
          <li key={m.id}>
            <EvoMember member={m} species={s} current={m.id === mon.id} />
            {children.length > 0 && <ul className="evo-branch">{children}</ul>}
          </li>,
        ];
      });

  return (
    <div className="section">
      <h2>Evolution</h2>
      <ul className="evo-list">{branch(null)}</ul>
    </div>
  );
}

function EvoMember({ member, species, current }: { member: ChainStage; species: IndexEntry; current: boolean }) {
  const form = species.forms?.find((f) => f.key === member.form);
  const shown = { id: form?.pokemonId ?? species.id, name: form?.name ?? species.name, types: form?.types ?? species.types };
  const content = (
    <>
      <img src={spriteUrl(shown.id)} alt="" width={56} height={56} style={{ backgroundColor: typeTint(shown.types[0]) }} />
      <span className="body">
        {member.conditions.map((c) => (
          <span className="cond" key={c}>
            {c}
          </span>
        ))}
        <span className="name">
          <span className="no">{formatNo(species.id)}</span> {shown.name}
        </span>
        <span className="types">
          {shown.types.map((t) => (
            <TypeChip key={t} type={t} />
          ))}
        </span>
      </span>
    </>
  );
  return current ? (
    <div className="evo-member current" aria-current="page">
      {content}
    </div>
  ) : (
    <Link className="evo-member" to={form ? `/pokemon/${species.id}?form=${form.key}` : `/pokemon/${species.id}`}>
      {content}
    </Link>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="section">
      <h2>Evolution</h2>
      <p className="hint">{children}</p>
    </div>
  );
}
