import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { TrainerKind } from '../../../data/api';
import { Icon } from '../../../components/Icon/Icon';
import { TypeChip } from '../../../components/TypeChip/TypeChip';
import { trainerSlug } from '../../../data/trainers';
import { useTrainer } from './useTrainer';
import { useRestoreScroll } from './useRestoreScroll';
import { BackButton } from './BackButton';
import { TITLES, tintOf } from './leagueTables';
import { TrainerSprite } from './TrainerSprite';
import { Picker } from './Picker';
import { TrainerMon } from './TrainerMon';

export function TrainerScreen({ kind }: { kind: TrainerKind }) {
  const { game, tables, trainer: t, pick, shown, setPick, gamePath, search, missing } = useTrainer(kind);
  const headingId = useId();
  useRestoreScroll(!!shown);
  return (
    <>
      <header className="topbar">
        <BackButton fallback={gamePath} />
        <div className="grow">
          <h1 id={headingId}>{t?.name ?? TITLES[kind]}</h1>
          {game && <div className="sub">{game.label}</div>}
        </div>
      </header>
      {missing}
      {t && tables && shown && (
        <>
          <div className="league-trainer trainer-hero" style={tintOf(t, shown.team.members, tables)}>
            <TrainerSprite sprite={t.sprite} />
            <span className="who">
              <span className="tags">
                <span className="role">{t.role}</span>
                {t.type && <TypeChip type={t.type} />}
              </span>
              {t.badge && <span className="badge-name">{t.badge}</span>}
            </span>
          </div>
          {t.rematches && (
            <button
              type="button"
              className="switch-row"
              role="switch"
              aria-checked={pick.rematch}
              onClick={() => setPick({ rematch: !pick.rematch, stage: 0, pick: 0 })}
            >
              Show rematches
              <span className="seg" aria-hidden="true">
                <span>First</span>
                <span>Rematch</span>
              </span>
            </button>
          )}
          <div className="trainer-picks">
            {pick.rematch && !shown.stages && <p className="hint">No rematch for this trainer: first battle team.</p>}
            {shown.stages && shown.stages.length > 1 && (
              <Picker
                labels={shown.stages.map((s) => s.label.replace(/^Rematch /, ''))}
                fallback="Which rematch"
                pick={shown.stage}
                onPick={(i) => setPick({ rematch: true, stage: i, pick: 0 })}
                labelledBy={headingId}
              />
            )}
            {shown.stages?.length === 1 && shown.stages[0].label !== 'Rematch' && (
              <p className="league-pick-label">{shown.stages[0].label}</p>
            )}
            {shown.teams.length > 1 && (
              <Picker
                labels={shown.teams.map((tm) => tm.label ?? '')}
                fallback="Team"
                pick={shown.pick}
                onPick={(i) => setPick({ ...pick, stage: shown.stage, pick: i })}
                labelledBy={headingId}
              />
            )}
          </div>
          <div className="list">
            <ul className="team-members">
              {shown.team.members.map((m, i) => (
                <TrainerMon key={`${m.id}-${i}`} member={m} tables={tables} />
              ))}
            </ul>
          </div>
          <div className="bottom-cta">
            <Link to={`${gamePath}/${trainerSlug(t.name)}/coverage${search && `?${search}`}`} className="primary-btn">
              <Icon name="shield" size={20} /> Analyse coverage
            </Link>
          </div>
        </>
      )}
    </>
  );
}
