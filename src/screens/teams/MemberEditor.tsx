import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { loadAbilities, loadItems, loadLearnsets, loadMoves, loadSpecies, loadVersions, useLoad } from '../../data/api';
import { MOVE_SLOTS, cleanNickname, db, memberTitle, updateMember, type TeamMember } from '../../data/db';
import { detailPath } from '../../data/dexState';
import { applyForm } from '../../data/forms';
import {
  NO_MOVE_FILTERS,
  activeMoveChoiceFilters,
  memberAbility,
  moveChoices,
  moveFilterGame,
  otherAbilities,
  withMove,
  type MoveChoiceFilters,
} from '../../data/memberOptions';
import { NATURES, natureLabel } from '../../data/natures';
import { parsePeek, type Peek } from '../../data/peek';
import { useGame, useGodMode } from '../../data/settings';
import { typeTint } from '../../data/typeColors';
import type { MoveTable } from '../../data/types';
import { Icon } from '../../components/Icon/Icon';
import { CountBadge } from '../../components/CountBadge/CountBadge';
import { Loading } from '../../components/Loading/Loading';
import { TypeChip } from '../../components/TypeChip/TypeChip';
import { playAnim } from '../../components/playAnim';
import { useModalSheet } from '../../hooks/useModalSheet';
import { useToast } from '../../hooks/useToast';
import { MonImg } from '../../components/MonImg/MonImg';
import { usePeek } from '../../hooks/usePeek';
import { MoveChoiceFilterSheet } from './MoveChoiceFilterSheet';
import { GameSheet, useGameSheet } from '../../components/GamePicker/GamePicker';
import { knownGame } from '../../data/game';
import { MoveCells, MoveHead } from '../detail/MovesTab';
import { QuickView, type PeekAction } from '../guide/QuickView';
import { RenameSheet } from './RenameSheet';

const loadAll = (id: number, formKey?: string) =>
  Promise.all([loadSpecies(id), loadLearnsets(id, formKey), loadMoves(), loadItems(), loadVersions()]);

const godModeText = (on: boolean) =>
  on ? 'God mode on: any move and ability enabled' : 'God mode off: only legal moves and abilities';

type Picking =
  | { kind: 'nickname' }
  | { kind: 'item' }
  | { kind: 'ability' }
  | { kind: 'move' | 'move-filter'; slot: number };

export function MemberEditor() {
  const params = useParams();
  const teamId = Number(params.id);
  const index = Number(params.index);
  const team = useLiveQuery(() => db.teams.get(teamId).then((t) => t ?? null), [teamId]);
  const member = team?.members[index];
  const { data, error } = useLoad(
    () => (member ? loadAll(member.speciesId, member.formKey) : Promise.resolve(undefined)),
    member && `${member.speciesId}|${member.formKey ?? ''}`,
  );
  const [godMode, setGodMode] = useGodMode();
  const toast = useToast();
  // Every ability is only needed for god mode's picker.
  const { data: abilities, error: abilitiesError } = useLoad(
    () => (godMode ? loadAbilities() : Promise.resolve(undefined)),
    godMode,
  );
  const [picking, setPicking] = useState<Picking>();
  // Kept while the editor is open, so reopening the move picker keeps them.
  const [moveFilters, setMoveFilters] = useState(NO_MOVE_FILTERS);
  // The game choice made in this editor; until one is, god mode opens on every move and otherwise the shared game shows.
  const [pickedAnyGame, setPickedAnyGame] = useState<boolean>();
  const anyGame = pickedAnyGame ?? godMode;
  const [storedGame, setGame] = useGame();
  const gameSheet = useGameSheet();
  const peek = usePeek();
  const [search] = useSearchParams();
  // Every move it can have decides whether moves can be added; the filters only narrow the picker.
  const choices = useMemo(() => (data ? moveChoices(data[1], data[2], godMode) : []), [data, godMode]);
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
  // Name, types, abilities and moves follow the member's form (set when it was added); saved moves stay even when it can't learn them.
  const { view: mon, form, mediaId } = applyForm(species, member.formKey ?? null);
  const chosen = (member.moves ?? []).filter((id) => moves[id]);
  const abilityId = memberAbility(mon.abilities, member.ability, abilities)?.id;
  const itemOptions = Object.entries(items)
    .map(([id, { name }]) => ({ id: Number(id), name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const speciesGames = versions.filter((v) => learnsets[v.id]);
  const sharedGame = knownGame(storedGame, versions);
  const newestGame = speciesGames.at(-1)?.id;
  const filterGame = moveFilterGame(sharedGame, anyGame, newestGame);
  const moveOptions = (f: MoveChoiceFilters) =>
    moveChoices(learnsets, moves, godMode, { ...f, game: filterGame }).filter((m) => !chosen.includes(m));
  const notInGame =
    filterGame !== undefined &&
    !learnsets[filterGame] &&
    `${mon.name} isn't in ${versions.find((v) => v.id === filterGame)?.label}.`;
  const save = (patch: Partial<TeamMember>) => updateMember(teamId, index, (m) => ({ ...m, ...patch }));
  const setMove = (slot: number, move?: number) =>
    updateMember(teamId, index, (m) => ({ ...m, moves: withMove(m.moves ?? [], moves, slot, move) }));
  /** Replace and Remove for the item or move this member has, none for anything else (a link, or Forward after a removal). */
  const peekActions = ({ kind, id }: Peek): PeekAction[] => {
    const slot = kind === 'move' ? chosen.indexOf(id) : -1;
    if (kind === 'item' ? id !== member.item : slot < 0) return [];
    const name = kind === 'item' ? (items[id]?.name ?? 'held item') : moves[id].name;
    const replace: PeekAction = {
      label: 'Replace',
      name: `Replace ${name}`,
      run: () => setPicking(kind === 'item' ? { kind: 'item' } : { kind: 'move', slot }),
    };
    const remove: PeekAction = {
      label: 'Remove',
      name: `Remove ${name}`,
      danger: true,
      run: () => (kind === 'item' ? save({ item: undefined }) : setMove(slot)),
    };
    return kind === 'item' || choices.length > 0 ? [replace, remove] : [remove];
  };
  // Replace sets the picker while the quick view steps off its history entry: it opens as the
  // quick view goes, so the quick view's cleanup can't take its focus or unlock the page under it.
  const peeked = parsePeek(search.get('peek'));
  const sheet = peeked || gameSheet.open ? undefined : picking;

  return (
    <>
      <header className="topbar">
        <Link to={`/teams/${teamId}`} className="icon-btn" aria-label={`Back to ${team.name}`}>
          <Icon name="back" />
        </Link>
        <div className="grow">
          <h1 className="team-name">
            <button
              aria-label={`Set nickname, ${memberTitle(mon.name, member.nickname)}`}
              onClick={() => setPicking({ kind: 'nickname' })}
            >
              <span>{memberTitle(mon.name, member.nickname)}</span>
            </button>
          </h1>
          <div className="sub">
            {team.name}
            {godMode && ' · God mode'}
          </div>
        </div>
        <button
          className="icon-btn shiny-toggle"
          aria-label="Shiny"
          aria-pressed={!!member.shiny}
          title="Shiny"
          onClick={(e) => {
            playAnim(e.currentTarget, member.shiny ? 'star-off' : 'star-on');
            updateMember(teamId, index, ({ shiny, ...m }) => (shiny ? m : { ...m, shiny: true }));
          }}
        >
          <Icon name="star" />
        </button>
        <button
          className="icon-btn"
          aria-label="God mode"
          aria-pressed={godMode}
          title={godModeText(godMode)}
          onClick={(e) => {
            playAnim(e.currentTarget, godMode ? 'bolt-off' : 'bolt-on');
            setGodMode(!godMode);
            setPickedAnyGame(undefined);
            toast({ text: godModeText(!godMode) });
          }}
        >
          <Icon name="bolt" />
        </button>
      </header>

      <div className="list">
        <Link
          to={detailPath(mon.id, form?.key)}
          className="slot member-hero"
          style={{ backgroundColor: typeTint(mon.types[0]) }}
        >
          <MonImg id={mediaId} speciesId={member.speciesId} shiny={member.shiny} alt="" width={64} height={64} />
          <div style={{ minWidth: 0 }}>
            <div className="chips">
              {mon.types.map((t) => (
                <TypeChip key={t} type={t} />
              ))}
            </div>
            <div className="meta">View in Dex</div>
          </div>
          <Icon name="next" size={20} />
        </Link>
      </div>

      <Field
        title="Ability"
        action={
          abilityId !== undefined && (
            <InfoButton name={member.ability!} onClick={() => peek({ kind: 'ability', id: abilityId })} />
          )
        }
      >
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
          <button
            className="add-slot ability-any"
            onClick={() => setPicking({ kind: 'ability' })}
            disabled={!abilities}
          >
            <Icon name="plus" size={18} /> Any ability
          </button>
        )}
        {abilitiesError && <p className="hint">Couldn't load the ability list. {abilitiesError.message}</p>}
      </Field>

      <Field title="Nature">
        <label className="game-select">
          <span className="sr-only">Nature</span>
          <select
            className={member.nature ? undefined : 'none'}
            value={member.nature ?? ''}
            onChange={(e) => save({ nature: e.target.value || undefined })}
          >
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
        <button
          className="game-select"
          aria-label={member.item ? `About ${items[member.item]?.name ?? 'held item'}` : 'Choose a held item'}
          onClick={() => (member.item ? peek({ kind: 'item', id: member.item }) : setPicking({ kind: 'item' }))}
        >
          <span className={member.item ? 'v' : 'v none'}>
            {member.item ? (items[member.item]?.name ?? 'Unknown item') : 'None'}
          </span>
          {!member.item && <Icon name="next" size={18} />}
        </button>
      </Field>

      <Field title={`Moves · ${chosen.length} of ${MOVE_SLOTS}`}>
        <MoveSlots
          chosen={chosen}
          moves={moves}
          canAdd={choices.length > 0}
          onAdd={(slot) => setPicking({ kind: 'move', slot })}
          onPeek={(id) => peek({ kind: 'move', id })}
        />
        {!choices.length && <p className="hint">No move data for {mon.name}.</p>}
      </Field>

      {peeked && <QuickView actions={peekActions} />}
      {sheet?.kind === 'nickname' && (
        <RenameSheet
          noun={mon.name}
          name={member.nickname ?? ''}
          nickname
          onSave={(name) => save({ nickname: cleanNickname(name) })}
          onClose={() => setPicking(undefined)}
        />
      )}
      {sheet?.kind === 'item' && (
        <PickerSheet
          title="Held item"
          options={itemOptions}
          render={(o) => (
            <span className="body">
              <span className="name">{o.name}</span>
            </span>
          )}
          onPick={(item) => save({ item })}
          onClose={() => setPicking(undefined)}
        />
      )}
      {sheet?.kind === 'ability' && abilities && (
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
      {sheet?.kind === 'move' && (
        <PickerSheet
          title={chosen[sheet.slot] ? `Replace ${moves[chosen[sheet.slot]].name}` : 'Add a move'}
          options={moveOptions(moveFilters).map((id) => ({ id, name: moves[id].name }))}
          head={<MoveHead />}
          render={(o) => <MoveCells move={moves[o.id]} />}
          filters={activeMoveChoiceFilters(moveFilters, anyGame !== godMode)}
          emptyNote={notInGame || undefined}
          onFilter={() => setPicking({ kind: 'move-filter', slot: sheet.slot })}
          onPick={(move) => setMove(sheet.slot, move)}
          onClose={() => setPicking(undefined)}
        />
      )}
      {sheet?.kind === 'move-filter' && (
        <MoveChoiceFilterSheet
          value={moveFilters}
          game={anyGame ? 'any' : sharedGame}
          versions={versions}
          shows={newestGame}
          onGame={gameSheet.show}
          onReset={() => setPickedAnyGame(undefined)}
          countFor={(f) => moveOptions(f).length}
          onChange={setMoveFilters}
          onClose={() => setPicking({ kind: 'move', slot: sheet.slot })}
        />
      )}
      {gameSheet.open && (
        <GameSheet
          value={anyGame ? 'any' : sharedGame}
          versions={versions}
          offerAny
          onPick={(choice) => {
            setPickedAnyGame(choice === 'any');
            if (choice !== 'any') setGame(choice);
          }}
          onClose={gameSheet.hide}
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

/** Opens the quick view for the chosen ability. */
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
  onAdd,
  onPeek,
}: {
  chosen: number[];
  moves: MoveTable;
  canAdd: boolean;
  onAdd: (slot: number) => void;
  onPeek: (move: number) => void;
}) {
  return (
    <>
      {chosen.length > 0 && <MoveHead />}
      <ul className="move-slots move-table">
        {Array.from({ length: MOVE_SLOTS }, (_, slot) => {
          const id = chosen[slot];
          if (id === undefined) {
            return canAdd && slot === chosen.length ? (
              <li key={slot}>
                <button className="add-slot" onClick={() => onAdd(slot)}>
                  <Icon name="plus" size={18} /> Add move
                </button>
              </li>
            ) : null;
          }
          const m = moves[id];
          return (
            <li key={slot} className="move-row">
              <button className="move-pick" aria-label={`About ${m.name}`} onClick={() => onPeek(id)}>
                <MoveCells move={m} />
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
  filters = 0,
  emptyNote,
  onFilter,
  onPick,
  onClose,
}: {
  title: string;
  options: Option[];
  /** A header row above the list; the list then lays out as a move table. */
  head?: ReactNode;
  render: (o: Option) => ReactNode;
  /** How many filters are on, for the badge on the filter button. */
  filters?: number;
  /** Why the list is empty, in place of "Nothing matches the filters." */
  emptyNote?: string;
  /** Shows a filter button beside the search, which closes the picker and calls this. */
  onFilter?: () => void;
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
        <div className="picker-search">
          <label className="search">
            <Icon name="search" size={20} />
            <span className="sr-only">Search</span>
            <input
              type="search"
              data-autofocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
            />
          </label>
          {onFilter && (
            <button
              className="icon-btn filter-btn"
              aria-label={filters ? `Filter, ${filters} active` : 'Filter'}
              onClick={() => close(onFilter)}
            >
              <Icon name="filter" size={22} />
              <CountBadge count={filters} />
            </button>
          )}
        </div>
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
        {!shown.length && (
          <p className="empty">
            {emptyNote ?? (q || !onFilter ? `Nothing matches “${query}”.` : 'Nothing matches the filters.')}
          </p>
        )}
      </section>
    </>
  );
}
