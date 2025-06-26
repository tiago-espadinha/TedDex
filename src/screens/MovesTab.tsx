import { useState, type ReactNode } from 'react';
import { loadLearnsets, loadMoves, loadVersions, useLoad } from '../data/api';
import { knownGame, shownGame } from '../data/game';
import { useGame } from '../data/settings';
import type { Learnset, MoveInfo, MoveTable, SpeciesDetail } from '../data/types';
import { signed } from '../data/format';
import type { Peek } from '../data/peek';
import { typeChip } from '../data/typeColors';
import { GamePicker, NotInGame } from '../components/GamePicker';
import { CategoryIcon, Loading, Segmented, TypeChip } from '../components/bits';
import { usePeek } from '../components/usePeek';

type Method = keyof Learnset;
const METHODS: { key: Method; title: string }[] = [
  { key: 'level', title: 'Level up' },
  { key: 'machine', title: 'TM/HM' },
  { key: 'tutor', title: 'Tutor' },
  { key: 'egg', title: 'Egg' },
];

const loadAll = (id: number, formKey: string) => Promise.all([loadLearnsets(id, formKey), loadMoves(), loadVersions()]);

/** `mon` is the species as shown in form `formKey`; the moves are that form's when it learns its own. */
export function MovesTab({ mon, formKey }: { mon: SpeciesDetail; formKey: string }) {
  const { data, error } = useLoad(() => loadAll(mon.id, formKey), `${mon.id}|${formKey}`);
  const [stored] = useGame();
  const [method, setMethod] = useState<Method>('level');
  const peek = usePeek();

  if (error) return <Note>Couldn't load moves. {error.message}</Note>;
  if (!data) return <Loading minHeight={320} />;

  const [learnsets, moves, versions] = data;
  const games = versions.filter((v) => learnsets[v.id]);
  if (!games.length) return <Note>No move data for {mon.name} yet.</Note>;

  const chosen = knownGame(stored, versions);
  const vg = shownGame(
    games.map((g) => g.id),
    chosen,
  );
  if (vg === undefined) {
    return (
      <div className="section">
        <GamePicker versions={versions} describedBy="moves-missing" />
        <NotInGame id="moves-missing" name={mon.name} versions={versions} />
      </div>
    );
  }

  const set = learnsets[vg];
  // Only methods with moves in this game; keep the chosen one if the game has it.
  const methods = METHODS.filter((m) => set[m.key].length > 0);
  const shown = methods.find((m) => m.key === method) ?? methods[0];
  const byName = (a: number, b: number) => moves[a].name.localeCompare(moves[b].name);

  return (
    <div className="section">
      <GamePicker versions={versions} shows={vg} />

      {methods.length > 1 && (
        <Segmented className="method-pick" aria-label="How it learns them">
          {methods.map((m) => (
            <button key={m.key} role="radio" aria-checked={m.key === shown.key} onClick={() => setMethod(m.key)}>
              {m.title}
            </button>
          ))}
        </Segmented>
      )}

      {shown && (
        <MoveGroup title={`${shown.title} · ${set[shown.key].length}`} level={shown.key === 'level'}>
          {shown.key === 'level'
            ? set.level.map(([move, level]) => <MoveRow key={`${move}-${level}`} move={move} moves={moves} level={level} onPeek={peek} />)
            : [...set[shown.key]].sort(byName).map((move) => <MoveRow key={move} move={move} moves={moves} onPeek={peek} />)}
        </MoveGroup>
      )}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="section">
      <p className="empty">{children}</p>
    </div>
  );
}

function MoveGroup({ title, level, children }: { title: string; level: boolean; children: ReactNode }) {
  return (
    <section className="move-group">
      <h2>{title}</h2>
      <MoveHead level={level} />
      <ul className={level ? 'move-table with-lv' : 'move-table'}>{children}</ul>
    </section>
  );
}

function MoveRow({ move, moves, level, onPeek }: { move: number; moves: MoveTable; level?: number; onPeek: (peek: Peek) => void }) {
  const m = moves[move];
  return (
    <li>
      <button className="move-row" onClick={() => onPeek({ kind: 'move', id: move })}>
        {level !== undefined && (
          <span className="lv" style={{ borderColor: typeChip(m.type) }}>
            {level === 0 ? (
              <>
                <span aria-hidden="true">Evo</span>
                <span className="sr-only">On evolution</span>
              </>
            ) : (
              <>
                <span className="sr-only">Level </span>
                {level}
              </>
            )}
          </span>
        )}
        <MoveCells move={m} />
      </button>
    </li>
  );
}

/** Column labels over a move table; screen readers get each label inside its cell instead. */
export function MoveHead({ level }: { level?: boolean }) {
  return (
    <div className={level ? 'move-head with-lv' : 'move-head'} aria-hidden="true">
      {level && <span>Lv</span>}
      <span className="move">Move</span>
      <span>Type</span>
      <span className="cat">Cat</span>
      <span className="num">Pow</span>
      <span className="num">Acc</span>
      <span className="num">PP</span>
    </div>
  );
}

/**
 * A move as table cells: name (with any priority), type, category, power, accuracy, PP; shared with the Guide
 * and the member editor.
 */
export function MoveCells({ move: m }: { move: MoveInfo }) {
  return (
    <>
      <span className="name">
        {m.name}
        {m.priority !== 0 && ' '}
        {m.priority !== 0 && <span className="prio">Priority {signed(m.priority)}</span>}
      </span>
      <TypeChip type={m.type} />
      <CategoryIcon category={m.category} />
      <Stat label="Power" value={m.category === 'status' ? null : m.power} />
      <Stat label="Accuracy" value={m.accuracy} unit="%" />
      <Stat label="PP" value={m.pp} />
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <span className="num">
      <span className="sr-only">{label} </span>
      {value === null ? (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">none</span>
        </>
      ) : (
        <>
          {value}
          {unit && <span className="sr-only">{unit}</span>}
        </>
      )}
    </span>
  );
}
