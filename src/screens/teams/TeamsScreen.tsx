import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createTeam, db } from '../../data/db';
import { teamMatches } from '../../data/teamSearch';
import { Icon } from '../../components/Icon/Icon';
import { Loading } from '../../components/Loading/Loading';
import { SearchField } from '../../components/SearchField/SearchField';
import { MonImg } from '../../components/MonImg/MonImg';
import { useMemberViews } from './useMemberViews';
import { TeamTabs } from './TeamTabs';
import './TeamsScreen.css';

export function TeamsScreen() {
  const teams = useLiveQuery(() => db.teams.orderBy('updatedAt').reverse().toArray(), []);
  const { view, formsReady } = useMemberViews(teams?.flatMap((t) => t.members));
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  // Member names come with the index and form species files; a search waits for them rather than missing.
  const shown =
    query && !formsReady
      ? undefined
      : teams?.filter((t) =>
          teamMatches(
            t.name,
            t.members.flatMap((m) => [view?.(m)?.name, m.nickname]).filter((n): n is string => !!n),
            query,
          ),
        );

  return (
    <>
      <header className="dex-head">
        <h1>Teams</h1>
        <SearchField
          label="Search teams"
          placeholder="Team or Pokémon"
          value={query}
          onChange={(q) => setParams(q ? { q } : {}, { replace: true })}
        />
      </header>
      <TeamTabs />
      <div className="list with-fab">
        {!shown && <Loading />}
        {teams?.length === 0 && <p className="empty">No teams yet. Tap + to create one.</p>}
        {teams?.length !== 0 && shown?.length === 0 && <p className="empty">No teams match “{query}”.</p>}
        {shown?.map((t) => (
          <Link
            key={t.id}
            to={`/teams/${t.id}`}
            className="team-row team-list-row"
            data-morph={`/teams/${t.id}`}
            data-morph-card
          >
            <span className="head">
              <Icon name="ball" size={16} />
              <span className="name">{t.name}</span>
            </span>
            {t.members.length > 0 && (
              <span className="minis" aria-hidden="true">
                {t.members.map((m, i) => {
                  const mon = view?.(m);
                  return (
                    <span key={i}>
                      <MonImg
                        id={mon?.mediaId ?? m.speciesId}
                        speciesId={m.speciesId}
                        shiny={m.shiny}
                        alt=""
                        title={mon?.name}
                        width={80}
                        height={80}
                      />
                    </span>
                  );
                })}
              </span>
            )}
          </Link>
        ))}
      </div>
      <button className="fab" aria-label="New team" onClick={async () => navigate(`/teams/${await createTeam()}`)}>
        <Icon name="plus" size={24} />
      </button>
    </>
  );
}
