import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadLearnsets, loadMoves, loadVersions, useLoad } from '../data/api';
import type { Learnset, MoveInfo, MoveTable, SpeciesDetail } from '../data/types';
import { signed } from '../data/format';
import { typeChip } from '../data/typeColors';
import { Icon } from '../components/Icon';
import { Loading, TypeChip } from '../components/bits';

type Method = keyof Learnset;
const METHODS: { key: Method; title: string }[] = [
  { key: 'level', title: 'Level up' },
  { key: 'machine', title: 'TM/HM' },
  { key: 'tutor', title: 'Tutor' },
  { key: 'egg', title: 'Egg' },
];

const loadAll = (id: number) => Promise.all([loadLearnsets(id), loadMoves(), loadVersions()]);

export function MovesTab({ mon }: { mon: SpeciesDetail }) {
  const { data, error } = useLoad(() => loadAll(mon.id), mon.id);
  const [pick, setPick] = useState<number>();
  const [method, setMethod] = useState<Method>('level');

  if (error) return <Note>Couldn't load moves. {error.message}</Note>;
  if (!data) return <Loading minHeight={320} />;

  const [learnsets, moves, versions] = data;
  const games = versions.filter((v) => learnsets[v.id]);
  if (!games.length) return <Note>No move data for {mon.name} yet.</Note>;

  const vg = pick ?? games[games.length - 1].id;
  const set = learnsets[vg];
  // Only methods with moves in this game; keep the chosen one if the game has it.
  const methods = METHODS.filter((m) => set[m.key].length > 0);
  const shown = methods.find((m) => m.key === method) ?? methods[0];
  const byName = (a: number, b: number) => moves[a].name.localeCompare(moves[b].name);

  return (
    <div className="section">
      <label className="game-select">
        <span className="k">Game</span>
        <select value={vg} onChange={(e) => setPick(Number(e.target.value))}>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <Icon name="next" size={18} />
      </label>

      {methods.length > 1 && (
        <div className="segmented method-pick" role="radiogroup" aria-label="How it learns them">
          {methods.map((m) => (
            <button key={m.key} role="radio" aria-checked={m.key === shown.key} onClick={() => setMethod(m.key)}>
              {m.title}
            </button>
          ))}
        </div>
      )}

      {shown && (
        <MoveGroup title={`${shown.title} · ${set[shown.key].length}`}>
          {shown.key === 'level'
            ? set.level.map(([move, level]) => <MoveRow key={`${move}-${level}`} move={move} moves={moves} level={level} />)
            : [...set[shown.key]].sort(byName).map((move) => <MoveRow key={move} move={move} moves={moves} />)}
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

function MoveGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="move-group">
      <h2>{title}</h2>
      <ul>{children}</ul>
    </section>
  );
}

function MoveRow({ move, moves, level }: { move: number; moves: MoveTable; level?: number }) {
  const m = moves[move];
  return (
    <li>
      <Link className="move-row" to={`/reference/moves/${move}`}>
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
      <MoveBody move={m} />
      <TypeChip type={m.type} />
      </Link>
    </li>
  );
}

/** Name plus category, power, accuracy, PP and any priority; shared with the team member editor. */
export function MoveBody({ move: m }: { move: MoveInfo }) {
  return (
    <span className="body">
      <span className="name">{m.name}</span>
      <span className="meta">
        {[
          m.category,
          m.category !== 'status' && `Pow ${m.power ?? '—'}`,
          `Acc ${m.accuracy ? `${m.accuracy}%` : '—'}`,
          m.pp && `PP ${m.pp}`,
          m.priority !== 0 && `Priority ${signed(m.priority)}`,
        ]
          .filter(Boolean)
          .map((part, i) => (
            <span key={i}>{part}</span>
          ))}
      </span>
    </span>
  );
}
