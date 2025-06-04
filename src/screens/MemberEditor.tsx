import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadAbilities, loadItems, loadLearnsets, loadMoves, loadSpecies, spriteUrl, useLoad } from '../data/api';
import { MOVE_SLOTS, db, updateMember, type TeamMember } from '../data/db';
import { applyForm } from '../data/forms';
import { moveChoices, otherAbilities } from '../data/memberOptions';
import { NATURES, natureLabel } from '../data/natures';
import { typeTint } from '../data/typeColors';
import type { MoveTable } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip, useModalSheet } from '../components/bits';
import { MoveCells, MoveHead } from './MovesTab';

const loadAll = (id: number) => Promise.all([loadSpecies(id), loadLearnsets(id), loadMoves(), loadItems()]);

type Picking = { kind: 'item' } | { kind: 'ability' } | { kind: 'move'; slot: number };

export function MemberEditor() {
  const params = useParams();
  const teamId = Number(params.id);
  const index = Number(params.index);
  const team = useLiveQuery(() => db.teams.get(teamId).then((t) => t ?? null), [teamId]);
  const member = team?.members[index];
  const { data, error } = useLoad(() => (member ? loadAll(member.speciesId) : Promise.resolve(undefined)), member?.speciesId);
  const godMode = team?.godMode ?? false;
  // Every ability is only needed in god mode, so it loads then.
  const { data: abilities, error: abilitiesError } = useLoad(() => (godMode ? loadAbilities() : Promise.resolve(undefined)), godMode);
  const [picking, setPicking] = useState<Picking>();
  const choices = useMemo(() => (data ? moveChoices(data[1], data[2], godMode) : []), [data, godMode]);
  const itemOptions = useMemo(
    () => Object.entries(data?.[3] ?? {}).map(([id, name]) => ({ id: Number(id), name })).sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );
  const formKey = member?.formKey ?? null;
  const abilityOptions = useMemo(
    () => (data && abilities ? otherAbilities(applyForm(data[0], formKey).view.abilities, abilities) : []),
    [data, formKey, abilities],
  );

  if (team === undefined) return <Loading />;
  if (!member) return <p className="empty">This team member no longer exists.</p>;
  if (error) return <p className="empty">Couldn't load this Pokémon. {error.message}</p>;
  if (!data) return <Loading />;

  const [species, , moves, items] = data;
  // Learnsets stay species-level; name, types and abilities follow the member's form.
  const { view: mon, form, mediaId } = applyForm(species, member.formKey ?? null);
  const chosen = (member.moves ?? []).filter((id) => moves[id]);
  const save = (patch: Partial<TeamMember>) => updateMember(teamId, index, (m) => ({ ...m, ...patch }));
  const setMove = (slot: number, move?: number) =>
    updateMember(teamId, index, (m) => {
      const next = [...(m.moves ?? [])];
      if (move === undefined) next.splice(slot, 1);
      else if (!next.includes(move) && slot < MOVE_SLOTS) next[Math.min(slot, next.length)] = move;
      return { ...m, moves: next };
    });
  /**
   * Switches form, dropping the chosen ability if it was the old form's own and the new form doesn't have it.
   * God mode, and an ability picked in god mode, keep it.
   */
  const setForm = (key: string) =>
    updateMember(teamId, index, (m) => {
      const own = (formKey: string | null) => applyForm(species, formKey).view.abilities.some((a) => a.name === m.ability);
      const keep = godMode || !own(m.formKey ?? null) || own(key);
      return { ...m, formKey: key || undefined, ability: keep ? m.ability : undefined };
    });

  return (
    <>
      <header className="topbar">
        <Link to={`/teams/${teamId}`} className="icon-btn" aria-label={`Back to ${team.name}`}>
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1>{mon.name}</h1>
          <div className="sub">
            {team.name}
            {godMode && ' · God mode'}
          </div>
        </div>
      </header>

      <div className="list">
        <Link to={`/pokemon/${mon.id}${form?.key ? `?${new URLSearchParams({ form: form.key })}` : ''}`} className="slot member-hero" style={{ backgroundColor: typeTint(mon.types[0]) }}>
          <img src={spriteUrl(mediaId)} alt="" width={64} height={64} />
          <div style={{ minWidth: 0 }}>
            <div className="chips">{mon.types.map((t) => <TypeChip key={t} type={t} />)}</div>
            <div className="meta">View in Dex</div>
          </div>
          <Icon name="next" size={20} />
        </Link>
      </div>

      {species.forms && (
        <Field title="Form">
          <div className="ability-row" role="radiogroup" aria-label="Form">
            {species.forms.map((f) => (
              <button key={f.key} className="ability" role="radio" aria-checked={f.key === (form?.key ?? '')} onClick={() => setForm(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </Field>
      )}

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
          {member.ability && !mon.abilities.some((a) => a.name === member.ability) && (
            <button className="ability" role="radio" aria-checked onClick={() => save({ ability: undefined })}>
              {member.ability}
              <small>Not its own</small>
            </button>
          )}
        </div>
        {godMode && (
          <button className="add-slot ability-any" onClick={() => setPicking({ kind: 'ability' })} disabled={!abilities}>
            <Icon name="plus" size={18} /> Any ability
          </button>
        )}
        {godMode && abilitiesError && <p className="hint">Couldn't load the ability list. {abilitiesError.message}</p>}
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
        <MoveSlots chosen={chosen} moves={moves} canAdd={choices.length > 0} onPick={(slot) => setPicking({ kind: 'move', slot })} onRemove={(slot) => setMove(slot)} />
        {!choices.length && <p className="hint">No move data for {mon.name}.</p>}
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
      {picking?.kind === 'ability' && abilities && (
        <PickerSheet
          title="Any ability"
          options={abilityOptions}
          render={(o) => (
            <span className="body">
              <span className="name">{o.name}</span>
              <span className="meta">{abilities[o.id].effect}</span>
            </span>
          )}
          onPick={(id) => save({ ability: abilities[id].name })}
          onClose={() => setPicking(undefined)}
        />
      )}
      {picking?.kind === 'move' && (
        <PickerSheet
          title={chosen[picking.slot] ? `Replace ${moves[chosen[picking.slot]].name}` : 'Add a move'}
          options={choices.filter((m) => !chosen.includes(m)).map((id) => ({ id, name: moves[id].name }))}
          head={<MoveHead />}
          render={(o) => <MoveCells move={moves[o.id]} />}
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
    <>
      {chosen.length > 0 && <MoveHead trailing />}
      <ul className="move-slots move-table">
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
                <MoveCells move={m} />
              </button>
              <button className="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => onRemove(slot)}>
                <Icon name="close" size={20} />
              </button>
            </li>
          );
        })}
      </ul>
    </>
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
  head,
  render,
  onPick,
  onClose,
}: {
  title: string;
  options: Option[];
  /** A header row above the list; the list then lays out as a move table. */
  head?: ReactNode;
  render: (o: Option) => ReactNode;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;

  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet picker" role="dialog" aria-modal="true" aria-label={title}>
        <div className="handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="text-btn" onClick={() => close()}>
            Cancel
          </button>
        </div>
        <label className="search">
          <Icon name="search" size={20} />
          <span className="sr-only">Search</span>
          <input type="search" data-autofocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        </label>
        {head && shown.length > 0 && head}
        <ul className={head ? 'picker-list move-table' : 'picker-list'}>
          {shown.map((o) => (
            <li key={o.id}>
              <button
                className="move-row"
                onClick={() => {
                  onPick(o.id);
                  close();
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
