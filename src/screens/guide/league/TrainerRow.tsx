import { Link } from 'react-router-dom';
import type { LeagueTrainer } from '../../../data/types';
import { Icon } from '../../../components/Icon/Icon';
import { TypeChip } from '../../../components/TypeChip/TypeChip';
import { teamSummary } from '../../../data/trainers';
import { tintOf, type Tables } from './leagueTables';
import { TrainerSprite } from './TrainerSprite';
import './TrainerRow.css';

/** A trainer in the game's list: "Badge · Name", role and type, and the first battle team's size and top level. */
export function TrainerRow({ to, trainer: t, tables }: { to: string; trainer: LeagueTrainer; tables: Tables }) {
  const team = t.teams[0];
  const { count, level } = teamSummary(team);
  return (
    <li className="league-trainer" style={tintOf(t, team.members, tables)}>
      <Link className="league-head" to={to}>
        <TrainerSprite sprite={t.sprite} />
        <span className="who">
          <span className="trainer-name">
            <span className="name">{t.name}</span>
            {t.badge && <span className="badge-name"> · {t.badge}</span>}
          </span>
          <span className="tags">
            <span className="role">{t.role}</span>
            {t.type && <TypeChip type={t.type} />}
          </span>
          <span className="team-size">
            {count} Pokémon · Lv {level}
          </span>
        </span>
        <Icon name="next" size={20} />
      </Link>
    </li>
  );
}
