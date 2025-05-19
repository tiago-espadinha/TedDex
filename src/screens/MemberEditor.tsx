import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadItems, loadLearnsets, loadMoves, loadSpecies, spriteUrl, useLoad } from '../data/api';
import { MOVE_SLOTS, db, updateMember, type TeamMember } from '../data/db';
import { NATURES, natureLabel } from '../data/natures';
import { TYPE_COLORS } from '../data/typeColors';
import type { Learnsets, MoveTable } from '../data/types';
import { Icon } from '../components/Icon';
import { TypeChip } from '../components/bits';
import { MoveBody } from './MovesTab';

const loadAll = (id: number) => Promise.all([loadSpecies(id), loadLearnsets(id), loadMoves(), loadItems()]);

/** Every move the species learns in any main-series game, by any method, sorted by name. */
function legalMoves(learnsets: Learnsets, moves: MoveTable): number[] {
  const ids = new Set<number>();
  for (const set of Object.values(learnsets)) {
    set.level.forEach(([m]) => ids.add(m));
    [...set.machine, ...set.tutor, ...set.egg].forEach((m) => ids.add(m));
  }
  return [...ids].sort((a, b) => moves[a].name.localeCompare(moves[b].name));
}

type Picking = { kind: 'item' } | { kind: 'move'; slot: number };

export function MemberEditor() {
  const params = useParams();
  const teamId = Number(params.id);
  const index = Number(params.index);
  const team = useLiveQuery(() => db.teams.get(teamId), [teamId]);
  const member = team?.members[index];
  const { data, error } = useLoad(() => (member ? loadAll(member.speciesId) : Promise.resolve(undefined)), member?.speciesId);
  const [picking, setPicking] = useState<Picking>();
  const legal = useMemo(() => (data ? legalMoves(data[1], data[2]) : []), [data]);
  const itemOptions = useMemo(
    () => Object.entries(data?.[3] ?? {}).map(([id, name]) => ({ id: Number(id), name })).sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  if (team === undefined) return null;
  if (!member) return <p className="empty">This team member no longer exists.</p>;
  if (error) return <p className="empty">Couldn't load this Pokémon. {error.message}</p>;
  if (!data) return <div aria-busy="true" />;

  const [mon, , moves, items] = data;
  const chosen = (member.moves ?? []).filter((id) => moves[id]);
  const save = (patch: Partial<TeamMember>) => updateMember(teamId, index, (m) => ({ ...m, ...patch }));
  const setMove = (slot: number, move?: number) =>
    updateMember(teamId, index, (m) => {
      const next = [...(m.moves ?? [])];
      if (move === undefined) next.splice(slot, 1);
      else if (!next.includes(move) && slot < MOVE_SLOTS) next[Math.min(slot, next.length)] = move;
      return { ...m, moves: next };
    });

  return (
    <>
      <header className="topbar">
        <Link to={`/teams/${teamId}`} className="icon-btn" aria-label={`Back to ${team.name}`}>
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>{mon.name}</h1>
          <div className="sub">{team.name}</div>
        </div>
      </header>

      <div className="list">
        <Link to={`/pokemon/${mon.id}`} className="slot member-hero" style={{ background: TYPE_COLORS[mon.types[0]].tint }}>
          <img src={spriteUrl(mon.id)} alt="" width={64} height={64} />
          <div style={{ minWidth: 0 }}>
            <div className="chips">{mon.types.map((t) => <TypeChip key={t} type={t} />)}</div>
            <div className="meta">View in Dex</div>
          </div>
          <Icon name="next" size={20} />
        </Link>
      </div>

      <Field title="Ability">
        <div className="ability-row" role="radiogroup" aria-label="Ability">
          {mon.abilities.map((a) => (
            <button
              key={a.name}
              className="ability"
              role="radio"
              aria-checked={member.ability === a.name}
              onClick={() => save({ ability: member.ability === a.name ? undefined : a.name })}
            >
              {a.name}
              {a.hidden && <small>Hidden</small>}
            </button>
          ))}
        </div>
      </Field>

      <Field title="Nature">
        <label className="game-select">
          <span className="sr-only">Nature</span>
          <select className={member.nature ? undefined : 'none'} value={member.nature ?? ''} onChange={(e) => save({ nature: e.target.value || undefined })}>
            <option value="">None</option>
            {NATURES.map((n) => (
              <option key={n.name} value={n.name}>
                {natureLabel(n)}
              </option>
            ))}
          </select>
          <Icon name="next" size={18} />
        </label>
      </Field>

      <Field title="Held item">
        <div className="pick-field">
          <button className="game-select" onClick={() => setPicking({ kind: 'item' })}>
            <span className={member.item ? 'v' : 'v none'}>{member.item ? (items[member.item] ?? 'Unknown item') : 'None'}</span>
            <Icon name="next" size={18} />
          </button>
          {member.item !== undefined && (
            <button className="icon-btn" aria-label="Remove held item" onClick={() => save({ item: undefined })}>
              <Icon name="close" size={20} />
            </button>
          )}
        </div>
      </Field>

      <Field title={`Moves · ${chosen.length} of ${MOVE_SLOTS}`}>
        <MoveSlots chosen={chosen} moves={moves} canAdd={legal.length > 0} onPick={(slot) => setPicking({ kind: 'move', slot })} onRemove={(slot) => setMove(slot)} />
        {!legal.length && <p className="hint">No move data for {mon.name}.</p>}
      </Field>

      {picking?.kind === 'item' && (
        <PickerSheet
          title="Held item"
          options={itemOptions}
          render={(o) => <span className="body"><span className="name">{o.name}</span></span>}
          onPick={(item) => save({ item })}
          onClose={() => setPicking(undefined)}
        />
      )}
      {picking?.kind === 'move' && (
        <PickerSheet
          title={chosen[picking.slot] ? `Replace ${moves[chosen[picking.slot]].name}` : 'Add a move'}
          options={legal.filter((m) => !chosen.includes(m)).map((id) => ({ id, name: moves[id].name }))}
          render={(o) => (
            <>
              <MoveBody move={moves[o.id]} />
              <TypeChip type={moves[o.id].type} />
            </>
          )}
          onPick={(move) => setMove(picking.slot, move)}
          onClose={() => setPicking(undefined)}
        />
      )}
    </>
  );
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function MoveSlots({
  chosen,
  moves,
  canAdd,
  onPick,
  onRemove,
}: {
  chosen: number[];
  moves: MoveTable;
  canAdd: boolean;
  onPick: (slot: number) => void;
  onRemove: (slot: number) => void;
}) {
  return (
    <ul className="move-slots">
      {Array.from({ length: MOVE_SLOTS }, (_, slot) => {
        const id = chosen[slot];
        if (id === undefined) {
          return canAdd && slot === chosen.length ? (
            <li key={slot}>
              <button className="add-slot" onClick={() => onPick(slot)}>
                <Icon name="plus" size={18} /> Add move
              </button>
            </li>
          ) : null;
        }
        const m = moves[id];
        return (
          <li key={slot} className="move-row">
            <button className="move-pick" aria-label={`Replace ${m.name}`} onClick={() => onPick(slot)}>
              <MoveBody move={m} />
              <TypeChip type={m.type} />
            </button>
            <button className="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => onRemove(slot)}>
              <Icon name="close" size={20} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface Option {
  id: number;
  name: string;
}

/** Bottom sheet with a search box over a list of options; picking one closes it. */
function PickerSheet({
  title,
  options,
  render,
  onPick,
  onClose,
}: {
  title: string;
  options: Option[];
  render: (o: Option) => ReactNode;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Give focus back to the control that opened the sheet.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="sheet picker" role="dialog" aria-modal="true" aria-label={title}>
        <div className="handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="text-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
        <label className="search">
          <Icon name="search" size={20} />
          <span className="sr-only">Search</span>
          <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        </label>
        <ul className="picker-list">
          {shown.map((o) => (
            <li key={o.id}>
              <button
                className="move-row"
                onClick={() => {
                  onPick(o.id);
                  onClose();
                }}
              >
                {render(o)}
              </button>
            </li>
          ))}
        </ul>
        {!shown.length && <p className="empty">Nothing matches “{query}”.</p>}
      </section>
    </>
  );
}
