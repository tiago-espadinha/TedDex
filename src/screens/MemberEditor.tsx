import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadAbilities, loadItemReference, loadItems, loadLearnsets, loadMoves, loadSpecies, loadVersions, spriteUrl, useLoad } from '../data/api';
import { MOVE_SLOTS, db, updateMember, type TeamMember } from '../data/db';
import { detailPath } from '../data/dexState';
import { applyForm } from '../data/forms';
import { abilityIdByName } from '../data/peek';
import { FIRST_GEN, abilityInGame, formInGame, itemInGame, learnable, moveChoices, otherAbilities } from '../data/memberOptions';
import { NATURES, natureLabel } from '../data/natures';
import { typeTint } from '../data/typeColors';
import type { MoveTable } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip, useModalSheet } from '../components/bits';
import { usePeek } from '../components/usePeek';
import { MoveCells, MoveHead } from './MovesTab';

const loadAll = (id: number) => Promise.all([loadSpecies(id), loadLearnsets(id), loadMoves(), loadItems(), loadVersions()]);

type Picking = { kind: 'item' } | { kind: 'ability' } | { kind: 'move'; slot: number };

export function MemberEditor() {
  const params = useParams();
  const teamId = Number(params.id);
  const index = Number(params.index);
  const team = useLiveQuery(() => db.teams.get(teamId).then((t) => t ?? null), [teamId]);
  const member = team?.members[index];
  const { data, error } = useLoad(() => (member ? loadAll(member.speciesId) : Promise.resolve(undefined)), member?.speciesId);
  const godMode = team?.godMode ?? false;
  const game = team?.game;
  // Every ability is only needed in god mode and, for the generation each came in, with a team game.
  const needAbilities = godMode || game !== undefined;
  const { data: abilities, error: abilitiesError } = useLoad(() => (needAbilities ? loadAbilities() : Promise.resolve(undefined)), needAbilities);
  // Item generations, only needed with a team game.
  const { data: itemInfo } = useLoad(() => (game !== undefined ? loadItemReference() : Promise.resolve(undefined)), game !== undefined);
  const [picking, setPicking] = useState<Picking>();
  const peek = usePeek();
  const choices = useMemo(() => (data ? moveChoices(data[1], data[2], godMode, game) : []), [data, godMode, game]);
  // With a team game, chosen moves it can't learn there are kept and labelled.
  const legal = useMemo(() => (data && game !== undefined ? learnable(data[1], game) : undefined), [data, game]);
  const gen = game !== undefined ? data?.[4].find((v) => v.id === game)?.gen : undefined;
  // With a team game, an item counts as in it once its generation is known.
  const itemOk = (id: number) => itemInGame(gen, itemInfo?.[id]?.gen ?? 1);
  const formKey = member?.formKey ?? null;
  const abilityOptions = useMemo(
    () => (data && abilities ? otherAbilities(applyForm(data[0], formKey).view.abilities, abilities) : []),
    [data, formKey, abilities],
  );

  if (team === undefined) return <Loading />;
  if (!member) return <p className="empty">This team member no longer exists.</p>;
  if (error) return <p className="empty">Couldn't load this Pokémon. {error.message}</p>;
  if (!data) return <Loading />;

  const [species, learnsets, moves, items, versions] = data;
  const gameLabel = game !== undefined ? (versions.find((v) => v.id === game)?.label ?? 'Unknown game') : undefined;
  const moveNote = (id: number) => (legal && !legal.has(id) ? notIn : undefined);
  const notInGame = game !== undefined && !learnsets[game];
  const notIn = `Not in ${gameLabel}`;
  // Learnsets stay species-level; name, types and abilities follow the member's form (set when it was added).
  const { view: mon, form, mediaId } = applyForm(species, member.formKey ?? null);
  const chosen = (member.moves ?? []).filter((id) => moves[id]);
  // Its own abilities carry their id; one picked in god mode is found in the full list.
  const abilityId = member.ability
    ? (mon.abilities.find((a) => a.name === member.ability)?.id ?? (abilities && abilityIdByName(abilities, member.ability)))
    : undefined;
  // What the team's game lacks: offered only in god mode, flagged when already chosen.
  const hasAbilities = gen === undefined || gen >= FIRST_GEN.ability;
  const hasItems = gen === undefined || gen >= FIRST_GEN.item;
  // Until abilities.json loads only the hidden ability rule applies.
  const abilityOk = (id: number | undefined, hidden = false) =>
    abilityInGame(gen, (id !== undefined && abilities?.[id]?.gen) || 1, hidden);
  const ownAbilities = mon.abilities.filter((a) => godMode || member.ability === a.name || abilityOk(a.id, a.hidden));
  // A game with none at all says so once instead of labelling each one.
  const flagAbility = (id: number | undefined, hidden = false) => hasAbilities && !abilityOk(id, hidden);
  const showAbility = godMode || !!member.ability || hasAbilities;
  const showItem = godMode || member.item !== undefined || hasItems;
  const itemOptions = Object.entries(items)
    .map(([id, name]) => ({ id: Number(id), name }))
    .filter((o) => godMode || itemOk(o.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const formMissing = !notInGame && !formInGame(form, game);
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
          <div className="sub">
            {team.name}
            {gameLabel && ` · ${gameLabel}`}
            {godMode && ' · God mode'}
          </div>
        </div>
      </header>

      <div className="list">
        <Link to={detailPath(mon.id, form?.key)} className="slot member-hero" style={{ backgroundColor: typeTint(mon.types[0]) }}>
          <img src={spriteUrl(mediaId)} alt="" width={64} height={64} />
          <div style={{ minWidth: 0 }}>
            <div className="chips">{mon.types.map((t) => <TypeChip key={t} type={t} />)}</div>
            <div className="meta">View in Dex</div>
          </div>
          <Icon name="next" size={20} />
        </Link>
        {formMissing && <p className="hint">{mon.name} isn't in {gameLabel}.</p>}
      </div>

      {showAbility && (
        <Field
          title="Ability"
          action={
            abilityId !== undefined && <InfoButton name={member.ability!} onClick={() => peek({ kind: 'ability', id: abilityId })} />
          }
        >
          <div className="ability-row" role="radiogroup" aria-label="Ability">
            {ownAbilities.map((a) => (
              <button
                key={a.name}
                className="ability"
                role="radio"
                aria-checked={member.ability === a.name}
                onClick={() => save({ ability: member.ability === a.name ? undefined : a.name })}
              >
                {a.name}
                {a.hidden && <small>Hidden</small>}
                {flagAbility(a.id, a.hidden) && <small>{notIn}</small>}
              </button>
            ))}
            {member.ability && !mon.abilities.some((a) => a.name === member.ability) && (
              <button className="ability" role="radio" aria-checked onClick={() => save({ ability: undefined })}>
                {member.ability}
                <small>Not its own</small>
                {flagAbility(abilityId) && <small>{notIn}</small>}
              </button>
            )}
          </div>
          {godMode && (
            <button className="add-slot ability-any" onClick={() => setPicking({ kind: 'ability' })} disabled={!abilities}>
              <Icon name="plus" size={18} /> Any ability
            </button>
          )}
          {!hasAbilities && <p className="hint">{gameLabel} has no abilities.</p>}
          {abilitiesError && <p className="hint">Couldn't load the ability list. {abilitiesError.message}</p>}
        </Field>
      )}

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

      {showItem && (
        <Field title="Held item">
          <div className="pick-field">
            {/* A game without held items keeps the chosen one, with nothing to swap it for. */}
            <button className="game-select" disabled={!godMode && !hasItems} onClick={() => setPicking({ kind: 'item' })}>
              <span className={member.item ? 'v' : 'v none'}>{member.item ? (items[member.item] ?? 'Unknown item') : 'None'}</span>
              <Icon name="next" size={18} />
            </button>
            {member.item !== undefined && items[member.item] && (
              <InfoButton name={items[member.item]} onClick={() => peek({ kind: 'item', id: member.item! })} />
            )}
            {member.item !== undefined && (
              <button className="icon-btn" aria-label="Remove held item" onClick={() => save({ item: undefined })}>
                <Icon name="close" size={20} />
              </button>
            )}
          </div>
          {!hasItems && <p className="hint">{gameLabel} has no held items.</p>}
          {hasItems && member.item !== undefined && items[member.item] && !itemOk(member.item) && <p className="hint">{items[member.item]} isn't in {gameLabel}.</p>}
        </Field>
      )}

      <Field title={`Moves · ${chosen.length} of ${MOVE_SLOTS}`}>
        <MoveSlots
          chosen={chosen}
          moves={moves}
          canAdd={choices.length > 0}
          note={moveNote}
          onPick={(slot) => setPicking({ kind: 'move', slot })}
          onPeek={(id) => peek({ kind: 'move', id })}
          onRemove={(slot) => setMove(slot)}
        />
        {notInGame && (
          <p className="hint">
            {mon.name} isn't in {gameLabel}.{!godMode && " Change the team's game or turn on god mode to add moves."}
          </p>
        )}
        {!choices.length && !notInGame && <p className="hint">No move data for {mon.name}.</p>}
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

function Field({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {action ? (
        <div className="field-head">
          <h2>{title}</h2>
          {action}
        </div>
      ) : (
        <h2>{title}</h2>
      )}
      {children}
    </section>
  );
}

/** Opens the quick view for a chosen ability, item or move. */
function InfoButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button className="icon-btn" aria-label={`About ${name}`} onClick={onClick}>
      <Icon name="info" size={20} />
    </button>
  );
}

function MoveSlots({
  chosen,
  moves,
  canAdd,
  note,
  onPick,
  onPeek,
  onRemove,
}: {
  chosen: number[];
  moves: MoveTable;
  canAdd: boolean;
  /** A label under a chosen move's name (it isn't learnable in the team's game). */
  note: (move: number) => string | undefined;
  onPick: (slot: number) => void;
  onPeek: (move: number) => void;
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
              <button className="move-pick" aria-label={`Replace ${m.name}`} disabled={!canAdd} onClick={() => onPick(slot)}>
                <MoveCells move={m} note={note(id)} />
              </button>
              <span className="slot-actions">
                <InfoButton name={m.name} onClick={() => onPeek(id)} />
                <button className="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => onRemove(slot)}>
                  <Icon name="close" size={20} />
                </button>
              </span>
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
