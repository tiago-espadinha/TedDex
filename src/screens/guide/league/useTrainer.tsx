import { useParams, useSearchParams } from 'react-router-dom';
import { useLoad, type TrainerKind } from '../../../data/api';
import { Loading } from '../../../components/Loading/Loading';
import { findTrainer, readTeamPick, shownTeam, teamPickParams, type TeamPick } from '../../../data/trainers';
import { loadGame } from './leagueTables';
import { Missing } from './Missing';

/** The trainer in the URL, its game and tables, and the team its rematch and choice pickers show. */
export function useTrainer(kind: TrainerKind) {
  const { game: gameId = '', trainer: slug = '' } = useParams();
  const { data, error } = useLoad(() => loadGame(kind, gameId), `${kind}/${gameId}`);
  const [game, tables] = data ?? [];
  const trainer = game && findTrainer(game, slug);
  const [params, setParams] = useSearchParams();
  const pick = readTeamPick(params);
  const shown = trainer && shownTeam(trainer, pick);
  const setPick = (p: TeamPick) => setParams(teamPickParams(p), { replace: true, preventScrollReset: true });
  const gamePath = `/reference/${kind}/${gameId}`;
  const missing =
    (error && (
      <Missing
        to={gamePath}
        link="All trainers"
        text="Couldn't load this trainer. Check your connection and try again."
      />
    )) ||
    (data === null && <Missing to={`/reference/${kind}`} link="All games" text="This game isn't in the data." />) ||
    (game && !trainer && <Missing to={gamePath} link="All trainers" text="This trainer isn't in this game." />) ||
    (data === undefined && <Loading />);
  return { game, tables, trainer, pick, shown, setPick, gamePath, search: params.toString(), missing };
}
