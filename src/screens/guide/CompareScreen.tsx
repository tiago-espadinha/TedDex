import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadSpecies, loadTypes, useLoad } from '../../data/api';
import {
  SLOTS,
  comparePickPath,
  parseCompare,
  rememberCompare,
  type CompareState,
  type SlotName,
} from '../../data/compare';
import { matchupGroups, type MatchupGroup } from '../../data/coverage';
import { applyForm } from '../../data/forms';
import { formatMultiplier, formatNo, statColor } from '../../data/format';
import { typeChip, typeTint } from '../../data/typeColors';
import type { SpeciesDetail, StatBlock, TypeData } from '../../data/types';
import { Icon } from '../../components/Icon/Icon';
import { Loading } from '../../components/Loading/Loading';
import { MonName } from '../../components/MonName/MonName';
import { TypeChip } from '../../components/TypeChip/TypeChip';
import { MonImg } from '../../components/MonImg/MonImg';
import './CompareScreen.css';

const STAT_ROWS: [keyof StatBlock, string][] = [
  ['hp', 'HP'],
  ['atk', 'Attack'],
  ['def', 'Defense'],
  ['spa', 'Sp. Atk'],
  ['spd', 'Sp. Def'],
  ['spe', 'Speed'],
];

interface SlotView {
  species?: SpeciesDetail;
  view?: SpeciesDetail;
  mediaId?: number;
  error?: Error;
}

/** A slot's species in its form, or nothing while it loads or when the slot is empty. */
function useSlot(slot: CompareState[SlotName]): SlotView {
  const { data, error } = useLoad(() => (slot ? loadSpecies(slot.id) : Promise.resolve(undefined)), slot?.id ?? 0);
  if (!slot || !data) return { error };
  return { species: data, ...applyForm(data, slot.form ?? null) };
}

export function CompareScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const state = parseCompare(params);
  const a = useSlot(state.a);
  const b = useSlot(state.b);
  const { data: typeData } = useLoad(loadTypes, 'types');
  const search = params.toString();
  useEffect(() => rememberCompare(search), [search]);

  const sides = { a, b };
  const both = a.view && b.view ? { a: a.view, b: b.view } : null;

  return (
    <>
      <header className="topbar">
        <button
          className="icon-btn"
          aria-label="Back"
          onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}
        >
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1>Comparator</h1>
        </div>
      </header>

      <div className="cmp-slots">
        {SLOTS.map((s) => {
          const side = sides[s];
          const slot = state[s];
          if (slot && !side.view && !side.error)
            return (
              <div key={s} className="cmp-slot empty-slot">
                <Loading />
              </div>
            );
          return (
            <SlotCard key={s} side={side} label={s === 'a' ? 'first' : 'second'} pick={comparePickPath(s, state)} />
          );
        })}
      </div>

      {!both && <p className="empty">Pick two Pokémon to compare their weaknesses, stats and size.</p>}
      {both && typeData && <Matchups a={both.a} b={both.b} data={typeData} />}
      {both && <StatsCompare a={both.a} b={both.b} />}
      <div style={{ height: 24 }} />
    </>
  );
}

/** A picked Pokémon or an empty slot; either way a button that opens Dex pick mode to swap it. */
function SlotCard({ side, label, pick }: { side: SlotView; label: string; pick: string }) {
  const { view: mon, species, mediaId } = side;
  const navigate = useNavigate();
  const change = () => navigate(pick, { replace: true });
  if (!mon || !species || mediaId == null)
    return (
      <button className="cmp-slot empty-slot" onClick={change} aria-label={`Pick the ${label} Pokémon`}>
        {side.error && <span className="cmp-error">Couldn't load this Pokémon.</span>}
        <Icon name="plus" />
        {side.error ? 'Pick another' : 'Pick a Pokémon'}
      </button>
    );
  return (
    <button
      className="cmp-slot"
      style={{ backgroundColor: typeTint(mon.types[0]) }}
      onClick={change}
      aria-label={`Change ${mon.name}`}
    >
      <MonImg id={mediaId} speciesId={species.id} alt="" width={96} height={96} />
      <span className="no">{formatNo(species.id)}</span>
      <span className="name">
        <MonName name={mon.name} />
      </span>
      <span className="types">
        {mon.types.map((t) => (
          <TypeChip key={t} type={t} />
        ))}
      </span>
    </button>
  );
}

const GROUPS: MatchupGroup['label'][] = ['Weak to', 'Resists', 'Immune to'];

/** Each one's weaknesses, resistances and immunities, a group per row with a column per side. */
function Matchups({ a, b, data }: { a: SpeciesDetail; b: SpeciesDetail; data: TypeData }) {
  const sides = [a, b].map((mon) => ({ name: mon.name, groups: matchupGroups(mon.types, data) }));
  return (
    <div className="section">
      <h2>Type matchups</h2>
      {GROUPS.filter((label) => sides.some((s) => s.groups.some((g) => g.label === label))).map((label) => (
        <div className="eff-group" key={label}>
          <h3>{label}</h3>
          <div className="cmp-sides">
            {sides.map(({ name, groups }, i) => {
              const hits = groups.find((g) => g.label === label)?.hits ?? [];
              return (
                <div className="chip-wrap" key={i}>
                  <span className="sr-only">{name}:</span>
                  {hits.length ? (
                    hits.map(({ type, mult }) => (
                      <span key={type} className="type-chip lg" style={{ backgroundColor: typeChip(type) }}>
                        {type}
                        {mult !== 2 && mult !== 0.5 && mult !== 0 ? ` ${formatMultiplier(mult)}` : ''}
                      </span>
                    ))
                  ) : (
                    <span className="cmp-none">None</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Base stats as mirrored bars, then height and weight; the higher value of each row is bold. */
function StatsCompare({ a, b }: { a: SpeciesDetail; b: SpeciesDetail }) {
  const names = (
    <div className="cmp-row cmp-names" role="row">
      <span role="columnheader">{a.name}</span>
      <span role="columnheader">
        <span className="sr-only">Stat</span>
      </span>
      <span role="columnheader">{b.name}</span>
    </div>
  );
  return (
    <>
      <div className="section">
        <h2>Base stats</h2>
        <div className="cmp-stats" role="table" aria-label="Base stats">
          {names}
          {STAT_ROWS.map(([k, label]) => (
            <CompareRow key={k} label={label} va={a.stats[k]} vb={b.stats[k]} bars />
          ))}
          <CompareRow label="Total" va={a.total} vb={b.total} total />
        </div>
      </div>
      <div className="section">
        <h2>Size</h2>
        <div className="cmp-stats" role="table" aria-label="Size">
          {names}
          <CompareRow label="Height" va={a.heightM} vb={b.heightM} unit="m" />
          <CompareRow label="Weight" va={a.weightKg} vb={b.weightKg} unit="kg" />
        </div>
      </div>
    </>
  );
}

function CompareRow(props: { label: string; va: number; vb: number; unit?: string; bars?: boolean; total?: boolean }) {
  const { label, va, vb, unit, bars, total } = props;
  return (
    <div className={total ? 'cmp-row total' : 'cmp-row'} role="row">
      <Cell v={va} other={vb} unit={unit} bar={bars} />
      <span className="cmp-label" role="rowheader">
        {label}
      </span>
      <Cell v={vb} other={va} unit={unit} bar={bars} />
    </div>
  );
}

function Cell({ v, other, unit, bar }: { v: number; other: number; unit?: string; bar?: boolean }) {
  return (
    <span className="cmp-cell" role="cell">
      <span className={v > other ? 'val more' : 'val'}>{unit ? `${v} ${unit}` : v}</span>
      {bar && (
        <span className="track" aria-hidden="true">
          <span className="fill" style={{ width: `${Math.min(100, (v / 180) * 100)}%`, background: statColor(v) }} />
        </span>
      )}
    </span>
  );
}
