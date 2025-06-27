import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadAbilityNames, loadItems, loadMoves, useLoad } from '../../data/api';
import { TEAM_SIZE, db, memberTitle, removeFromTeam, renameTeam } from '../../data/db';
import { formatNo } from '../../data/format';
import { typeTint } from '../../data/typeColors';
import { Icon } from '../../components/Icon/Icon';
import { Loading } from '../../components/Loading/Loading';
import { playAnim } from '../../components/playAnim';
import { MonHead } from '../../components/MonCard/MonCard';
import { useMemberViews } from './useMemberViews';
import { NatureChip } from './NatureChip';
import { MemberDetails } from './MemberDetails';
import { RenameSheet } from './RenameSheet';
import { DeleteSheet } from './DeleteSheet';

export function TeamEditor() {
  const id = Number(useParams().id);
  const team = useLiveQuery(() => db.teams.get(id).then((t) => t ?? null), [id]);
  const { view } = useMemberViews(team?.members);
  const { data: items } = useLoad(loadItems, 'items');
  const { data: moves } = useLoad(loadMoves, 'moves');
  const { data: abilities } = useLoad(loadAbilityNames, 'ability-names');
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  if (team === undefined) return <Loading />;
  if (!team) return <p className="empty">This team no longer exists.</p>;

  return (
    <>
      <header className="topbar" data-morph={`/teams/${id}`} data-morph-card>
        <Link to="/teams" className="icon-btn" aria-label="Back to teams">
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1 className="team-name">
            <button aria-label={`Rename team ${team.name}`} onClick={() => setRenaming(true)}>
              <span>{team.name}</span>
            </button>
          </h1>
          <div className="sub">
            {team.members.length} of {TEAM_SIZE}
          </div>
        </div>
        <button
          className="icon-btn"
          aria-label="Delete team"
          aria-haspopup="dialog"
          onClick={(e) => {
            playAnim(e.currentTarget, 'bin');
            setDeleting(true);
          }}
        >
          <Icon name="trash" />
        </button>
      </header>

      <div className="list">
        {team.members.length > 0 && (
          <ul className="team-members">
            {team.members.map((m, i) => {
              const mon = view?.(m);
              const name = memberTitle(mon?.name ?? formatNo(m.speciesId), m.nickname);
              return (
                <li
                  key={`${m.speciesId}-${i}`}
                  className="team-mon"
                  style={{ backgroundColor: mon ? typeTint(mon.types[0]) : 'var(--surface)' }}
                >
                  <Link to={`/teams/${id}/member/${i}`} className="evo-member">
                    <MonHead
                      spriteId={mon?.mediaId ?? m.speciesId}
                      speciesId={m.speciesId}
                      shiny={m.shiny}
                      name={name}
                      types={mon?.types ?? []}
                      note={m.nature && <NatureChip name={m.nature} />}
                    />
                  </Link>
                  <MemberDetails
                    member={m}
                    name={name}
                    items={items}
                    moves={moves}
                    abilities={abilities}
                    own={mon?.abilities}
                  />
                  <button className="icon-btn" aria-label={`Remove ${name}`} onClick={() => removeFromTeam(id, i)}>
                    <Icon name="close" size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {team.members.length < TEAM_SIZE && (
          <Link to={`/?pick=${id}`} className="add-slot">
            <Icon name="plus" size={18} /> Add Pokémon
          </Link>
        )}
      </div>

      {team.members.length > 0 && (
        <div className="bottom-cta team-cta">
          <Link to={`/teams/${id}/coverage`} className="primary-btn">
            <Icon name="shield" size={20} /> Analyse team
          </Link>
        </div>
      )}
      {renaming && (
        <RenameSheet
          noun="team"
          name={team.name}
          onSave={(name) => renameTeam(id, name)}
          onClose={() => setRenaming(false)}
        />
      )}
      {deleting && (
        <DeleteSheet
          name={team.name}
          lost={
            team.members.length
              ? `Its ${team.members.length} Pokémon and their moves, items and nicknames go with it.`
              : 'It has no Pokémon yet.'
          }
          onDelete={() =>
            db.teams.delete(id).then(
              () => navigate('/teams', { replace: true }),
              () => setDeleting(false),
            )
          }
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}
