import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadEvolution, loadIndex, spriteUrl, useLoad } from '../data/api';
import { formatNo } from '../data/format';
import { typeTint } from '../data/typeColors';
import type { EvolutionMember, IndexEntry, SpeciesDetail } from '../data/types';
import { Loading, TypeChip } from '../components/bits';

const loadAll = (chainId: number) => Promise.all([loadEvolution(chainId), loadIndex()]);

export function EvolutionTab({ mon }: { mon: SpeciesDetail }) {
  const chainId = mon.evolutionChainId;
  const { data, error } = useLoad(() => (chainId ? loadAll(chainId) : Promise.resolve(undefined)), chainId);

  if (error) return <Note>Couldn't load the evolution chain. {error.message}</Note>;
  if (chainId && !data) return <Loading minHeight={160} />;
  if (!data || data[0].length < 2) return <Note>{mon.name} does not evolve.</Note>;

  const [chain, index] = data;
  const species = new Map(index.map((s) => [s.id, s]));
  // Nested lists, so the branch structure is visible and exposed to screen readers.
  const branch = (from: number | null): ReactNode[] =>
    chain
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

function EvoMember({ member, species, current }: { member: EvolutionMember; species: IndexEntry; current: boolean }) {
  const content = (
    <>
      <img src={spriteUrl(species.id)} alt="" width={56} height={56} style={{ backgroundColor: typeTint(species.types[0]) }} />
      <span className="body">
        {member.conditions.map((c) => (
          <span className="cond" key={c}>
            {c}
          </span>
        ))}
        <span className="name">
          <span className="no">{formatNo(species.id)}</span> {species.name}
        </span>
        <span className="types">
          {species.types.map((t) => (
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
    <Link className="evo-member" to={`/pokemon/${species.id}`}>
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
