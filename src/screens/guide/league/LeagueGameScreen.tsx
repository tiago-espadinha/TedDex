import { useParams } from 'react-router-dom';
import { useLoad, type TrainerKind } from '../../../data/api';
import { Loading } from '../../../components/Loading/Loading';
import { trainerSlug } from '../../../data/trainers';
import { loadGame, TITLES } from './leagueTables';
import { useRestoreScroll } from './useRestoreScroll';
import { BackButton } from './BackButton';
import { Missing } from './Missing';
import { TrainerRow } from './TrainerRow';
import './LeagueGameScreen.css';

export function LeagueGameScreen({ kind }: { kind: TrainerKind }) {
  const id = useParams().game ?? '';
  const { data, error } = useLoad(() => loadGame(kind, id), `${kind}/${id}`);
  const [game, tables] = data ?? [];
  useRestoreScroll(!!tables);
  return (
    <>
      <header className="topbar">
        <BackButton fallback={`/reference/${kind}`} />
        <div className="grow">
          <h1>{game?.label ?? TITLES[kind]}</h1>
          {game && (
            <div className="sub">
              {game.region} · Gen {game.gen}
            </div>
          )}
        </div>
      </header>
      {error && (
        <Missing
          to={`/reference/${kind}`}
          link="All games"
          text="Couldn't load this game. Check your connection and try again."
        />
      )}
      {data === null && <Missing to={`/reference/${kind}`} link="All games" text="This game isn't in the data." />}
      {data === undefined && !error && <Loading />}
      {game && tables && (
        <>
          {game.note && <p className="hint league-note">{game.note}</p>}
          <ul className="league-trainers">
            {game.trainers.map((t, i) => (
              <TrainerRow
                key={`${t.name}-${i}`}
                to={`/reference/${kind}/${game.id}/${trainerSlug(t.name)}`}
                trainer={t}
                tables={tables}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
