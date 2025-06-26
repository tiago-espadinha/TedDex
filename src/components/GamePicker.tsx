import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { loadVersions, useLoad } from '../data/api';
import { roman } from '../data/format';
import { knownGame, type GamePref } from '../data/game';
import { bandStyle } from '../data/gameColors';
import { useGame } from '../data/settings';
import type { VersionGroup } from '../data/types';
import { Icon } from './Icon';
import { useModalSheet } from './bits';

/** What a picker can hold: the shared game, or the member filter's own Any game. */
export type GameChoice = GamePref | 'any';

const PARAM = 'game-sheet';

/** The game sheet lives in the URL as a history entry, so Back closes it. */
export function useGameSheet() {
  const [params, setParams] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const show = () =>
    setParams(
      (p) => {
        p.set(PARAM, '1');
        return p;
      },
      { preventScrollReset: true, state: { gameSheet: true } },
    );
  // Opened in the app: step back off its history entry. Opened from a link: drop the param.
  const hide = () =>
    (state as { gameSheet?: boolean } | null)?.gameSheet
      ? navigate(-1)
      : setParams(
          (p) => {
            p.delete(PARAM);
            return p;
          },
          { replace: true, preventScrollReset: true },
        );
  return { open: params.has(PARAM), show, hide };
}

/** The control that opens the sheet. `shows` is the game on screen, named beside Latest as Latest differs per species. */
export function GameTrigger({
  value,
  versions,
  shows,
  describedBy,
  autoFocus,
  onClick,
}: {
  value: GameChoice;
  versions: VersionGroup[];
  shows?: number;
  describedBy?: string;
  autoFocus?: boolean;
  onClick: () => void;
}) {
  const label = (id?: number) => versions.find((v) => v.id === id)?.label;
  const banded = value === 'any' ? undefined : label(value === 'latest' ? shows : value);
  const text = value === 'any' ? 'Any game' : value === 'latest' ? ['Latest', banded].filter(Boolean).join(' · ') : banded;
  return (
    <button
      className={banded ? 'game-select game-band' : 'game-select'}
      style={banded ? bandStyle(banded) : undefined}
      aria-haspopup="dialog"
      aria-describedby={describedBy}
      data-autofocus={autoFocus || undefined}
      onClick={onClick}
    >
      <span className="k">Game</span>
      <span className="v">{text}</span>
      <Icon name="next" size={18} />
    </button>
  );
}

function GameRow({ name, note, band, on, onPick }: { name: string; note?: string; band?: string; on: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        className={band ? 'game-row game-band' : 'game-row'}
        style={band ? bandStyle(band) : undefined}
        aria-current={on || undefined}
        data-autofocus={on || undefined}
        onClick={onPick}
      >
        <span className="body">
          <span className="name">{name}</span>
          {note && <span className="meta">{note}</span>}
        </span>
        {on && <Icon name="check" size={20} />}
      </button>
    </li>
  );
}

/** Latest, then Any game when `offerAny`, then every game by generation; a pick closes the sheet. */
export function GameSheet({
  value,
  versions,
  offerAny,
  latestNote = "Each Pokémon's newest game",
  onPick,
  onClose,
}: {
  value: GameChoice;
  versions: VersionGroup[];
  offerAny?: boolean;
  latestNote?: string;
  onPick: (choice: GameChoice) => void;
  onClose: () => void;
}) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const pick = (choice: GameChoice) => {
    onPick(choice);
    close();
  };
  const gens = [...new Set(versions.map((v) => v.gen))];

  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="game-sheet-title">
        <div className="handle" />
        <div className="sheet-head">
          <h2 id="game-sheet-title">Game</h2>
          <button className="text-btn" onClick={() => close()}>
            Cancel
          </button>
        </div>
        <ul className="game-rows">
          <GameRow name="Latest" note={latestNote} on={value === 'latest'} onPick={() => pick('latest')} />
          {offerAny && <GameRow name="Any game" on={value === 'any'} onPick={() => pick('any')} />}
        </ul>
        {gens.map((gen) => (
          <section key={gen}>
            <h3>Generation {roman(gen)}</h3>
            <ul className="game-rows">
              {versions
                .filter((v) => v.gen === gen)
                .map((v) => (
                  <GameRow key={v.id} name={v.label} band={v.label} on={value === v.id} onPick={() => pick(v.id)} />
                ))}
            </ul>
          </section>
        ))}
      </section>
    </>
  );
}

/** The shared game's control; the screen renders `SharedGameSheet` once, outside any pager or `.section`. */
export function GamePicker({ versions, shows, describedBy }: { versions: VersionGroup[]; shows?: number; describedBy?: string }) {
  const [stored] = useGame();
  const { show } = useGameSheet();
  return <GameTrigger value={knownGame(stored, versions)} versions={versions} shows={shows} describedBy={describedBy} onClick={show} />;
}

/** The sheet of the screen's `GamePicker`s, while the URL asks for it. */
export function SharedGameSheet({ latestNote }: { latestNote?: string }) {
  const [stored, setGame] = useGame();
  const { open, hide } = useGameSheet();
  const { data: versions } = useLoad(loadVersions, 'versions');
  if (!open || !versions) return null;
  return <GameSheet value={knownGame(stored, versions)} versions={versions} latestNote={latestNote} onPick={(choice) => choice !== 'any' && setGame(choice)} onClose={hide} />;
}

/** Goes after a `GamePicker` whose game has nothing for `name`; `id` is that picker's `describedBy`. */
export function NotInGame({ id, name, versions }: { id: string; name: string; versions: VersionGroup[] }) {
  const [stored, setGame] = useGame();
  const game = versions.find((v) => v.id === stored)?.label;
  const toLatest = (button: HTMLElement) => {
    // The button goes with this state; the picker above it stays, so focus waits there.
    button.closest('.section')?.querySelector<HTMLElement>('.game-select')?.focus();
    setGame('latest');
  };
  return (
    <div className="game-absent">
      <p id={id} role="status" className="hint">
        {name} isn't in {game}.
      </p>
      <button className="text-btn" onClick={(e) => toLatest(e.currentTarget)}>
        Show Latest
      </button>
    </div>
  );
}
