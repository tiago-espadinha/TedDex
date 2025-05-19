import { useState, type ReactNode } from 'react';
import { loadLearnsets, loadMoves, loadVersions, useLoad } from '../data/api';
import type { Learnset, MoveInfo, MoveTable, SpeciesDetail } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip } from '../components/bits';

const GROUPS: { key: Exclude<keyof Learnset, 'level'>; title: string }[] = [
  { key: 'machine', title: 'TM' },
  { key: 'tutor', title: 'Tutor' },
  { key: 'egg', title: 'Egg moves' },
];

const loadAll = (id: number) => Promise.all([loadLearnsets(id), loadMoves(), loadVersions()]);

export function MovesTab({ mon }: { mon: SpeciesDetail }) {
  const { data, error } = useLoad(() => loadAll(mon.id), mon.id);
  const [pick, setPick] = useState<number>();

  if (error) return <Note>Couldn't load moves. {error.message}</Note>;
  if (!data) return <Loading minHeight={320} />;

  const [learnsets, moves, versions] = data;
  const games = versions.filter((v) => learnsets[v.id]);
  if (!games.length) return <Note>No move data for {mon.name} yet.</Note>;

  const vg = pick ?? games[games.length - 1].id;
  const set = learnsets[vg];
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

      {set.level.length > 0 && (
        <MoveGroup title="Level up">
          {set.level.map(([move, level]) => (
            <MoveRow key={`${move}-${level}`} move={move} moves={moves} level={level} />
          ))}
        </MoveGroup>
      )}
      {GROUPS.map(
        ({ key, title }) =>
          set[key].length > 0 && (
            <MoveGroup key={key} title={title}>
              {[...set[key]].sort(byName).map((move) => (
                <MoveRow key={move} move={move} moves={moves} />
              ))}
            </MoveGroup>
          ),
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
    <li className="move-row">
      {level !== undefined && (
        <span className="lv">
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
    </li>
  );
}

/** Name plus category, power, accuracy and PP; shared with the team member editor. */
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
        ]
          .filter(Boolean)
          .map((part, i) => (
            <span key={i}>{part}</span>
          ))}
      </span>
    </span>
  );
}
