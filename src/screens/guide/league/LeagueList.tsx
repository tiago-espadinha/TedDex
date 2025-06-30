import { Link } from 'react-router-dom';
import { loadTrainerGames, useLoad, type TrainerKind } from '../../../data/api';
import { bandStyle } from '../../../data/gameColors';
import { Icon } from '../../../components/Icon/Icon';
import { Loading } from '../../../components/Loading/Loading';
import { TITLES } from './leagueTables';
import './LeagueList.css';

export function LeagueList({ kind }: { kind: TrainerKind }) {
  const { data, error } = useLoad(() => loadTrainerGames(kind), kind);
  return (
    <>
      <header className="topbar">
        <Link to="/reference" className="icon-btn" aria-label="Back to Guide">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>{TITLES[kind]}</h1>
          {data && <div className="sub">{data.length} games</div>}
        </div>
      </header>
      {error && <p className="empty">Couldn't load the games. {error.message}</p>}
      {!data && !error && <Loading />}
      {data && (
        <ul className="ref-list">
          {data.map((g) => (
            <li key={g.id}>
              <Link to={`/reference/${kind}/${g.id}`} className="move-row game-band" style={bandStyle(g.label)}>
                <span className="body">
                  <span className="name">{g.label}</span>
                  <span className="meta">
                    <span>{g.region}</span>
                    <span>Gen {g.gen}</span>
                  </span>
                </span>
                <Icon name="next" size={20} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
