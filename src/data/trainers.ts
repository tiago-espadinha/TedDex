import type { LeagueGame, LeagueRematch, LeagueTeam, LeagueTrainer } from './types';

/** "Lt. Surge" → "lt-surge": a trainer's URL segment, unique within its game file. */
export const trainerSlug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const findTrainer = (game: LeagueGame, slug: string) => game.trainers.find((t) => trainerSlug(t.name) === slug);

/** Which of a trainer's teams to show: rematches on or off, the rematch stage and the choice among alternatives. */
export interface TeamPick {
  rematch: boolean;
  stage: number;
  pick: number;
}

/**
 * The team a pick shows, with the stage and pick clamped to what the trainer has. With rematches on, a trainer
 * without any shows the first battle team (`stages` undefined).
 */
export function shownTeam(t: LeagueTrainer, { rematch, stage, pick }: TeamPick) {
  const stages: LeagueRematch[] | undefined = rematch ? t.rematches : undefined;
  const s = stages ? clamp(stage, stages.length) : 0;
  const teams: LeagueTeam[] = stages?.[s].teams ?? t.teams;
  const p = clamp(pick, teams.length);
  return { stages, stage: s, teams, pick: p, team: teams[p] };
}

const clamp = (i: number, length: number) => (Number.isInteger(i) && i > 0 ? Math.min(i, length - 1) : 0);

/** "2 Pokémon · Lv 14": the team's size and its highest level. */
export function teamSummary(team: LeagueTeam) {
  return { count: team.members.length, level: Math.max(...team.members.map((m) => m.level)) };
}

/** The pick in a trainer page's URL: `?rematch=1&stage=<i>&team=<i>`. */
export function readTeamPick(params: URLSearchParams): TeamPick {
  return {
    rematch: params.get('rematch') === '1',
    stage: Number(params.get('stage') ?? 0),
    pick: Number(params.get('team') ?? 0),
  };
}

export function teamPickParams({ rematch, stage, pick }: TeamPick): Record<string, string> {
  return {
    ...(rematch && { rematch: '1' }),
    ...(rematch && stage > 0 && { stage: String(stage) }),
    ...(pick > 0 && { team: String(pick) }),
  };
}
