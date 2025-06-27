import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db } from '../../data/db';
import { Icon } from '../../components/Icon/Icon';
import { Loading } from '../../components/Loading/Loading';
import { useMemberViews } from './useMemberViews';
import { CoverageBody, type CoverageMember } from './CoverageBody';

export function CoverageScreen() {
  const id = Number(useParams().id);
  const team = useLiveQuery(() => db.teams.get(id).then((t) => t ?? null), [id]);
  // The analysis waits for the forms' types and stats; slots elsewhere show the default form meanwhile.
  const { view, formsReady } = useMemberViews(team?.members);

  const members = (team?.members ?? [])
    .map((m) => ({ mon: view?.(m), moves: m.moves }))
    .filter((x): x is CoverageMember => !!x.mon);
  if (team === undefined || !view || !formsReady) return <Loading />;
  if (!team) return <p className="empty">This team no longer exists.</p>;

  return (
    <>
      <header className="topbar">
        <Link to={`/teams/${id}`} className="icon-btn" aria-label="Back to team">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>Analyse team</h1>
          <div className="sub">
            {team.name} · {members.length} member{members.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>
      {!members.length ? (
        <p className="empty">Add Pokémon to this team to analyse it.</p>
      ) : (
        <CoverageBody members={members} />
      )}
    </>
  );
}
