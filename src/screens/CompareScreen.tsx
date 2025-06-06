import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadSpecies, loadTypes, spriteUrl, useLoad } from '../data/api';
import { SLOTS, comparePickPath, compareSearch, parseCompare, rememberCompare, typeHits, type CompareState, type SlotName } from '../data/compare';
import { detailPath } from '../data/dexState';
import { applyForm } from '../data/forms';
import { formatNo, statColor } from '../data/format';
import { typeTint } from '../data/typeColors';
import type { SpeciesDetail, StatBlock, TypeData } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip } from '../components/bits';

const STAT_ROWS: [keyof StatBlock, string][] = [
  ['hp', 'HP'],
  ['atk', 'Attack'],
  ['def', 'Defense'],
  ['spa', 'Sp. Atk'],
  ['spd', 'Sp. Def'],
  ['spe', 'Speed'],
];

/** The words and pill tone (a matchup token) for a damage factor. */
const hitLabel = (m: number) =>
  m > 1 ? ['Super effective', 'weak'] : m === 1 ? ['Neutral', 'neutral'] : m > 0 ? ['Not very effective', 'resist'] : ['No effect', 'immune'];

const multText = (m: number) => (m === 0.5 ? '½×' : m === 0.25 ? '¼×' : `${m}×`);

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
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const state = parseCompare(params);
  const a = useSlot(state.a);
  const b = useSlot(state.b);
  const { data: typeData } = useLoad(loadTypes, 'types');
  const search = params.toString();
  useEffect(() => rememberCompare(search), [search]);

  const pickForm = (s: SlotName, id: number, form: string) =>
    setParams(compareSearch({ ...state, [s]: { id, form: form || undefined } }), { replace: true });

  const sides = { a, b };
  const both = a.view && b.view ? { a: a.view, b: b.view } : null;

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}>
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1>Compare</h1>
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
            <SlotCard
              key={s}
              side={side}
              label={s === 'a' ? 'first' : 'second'}
              pick={comparePickPath(s, state)}
              form={slot?.form ?? ''}
              onForm={(f) => slot && pickForm(s, slot.id, f)}
            />
          );
        })}
      </div>

      {!both && <p className="empty">Pick two Pokémon to compare their types, stats and size.</p>}
      {both && typeData && <Matchups a={both.a} b={both.b} data={typeData} />}
      {both && <StatsCompare a={both.a} b={both.b} />}
      <div style={{ height: 24 }} />
    </>
  );
}

/** A picked Pokémon, or a button to pick one (also when the slot's Pokémon couldn't load). */
function SlotCard(props: { side: SlotView; label: string; pick: string; form: string; onForm: (key: string) => void }) {
  const { side, label, pick, form, onForm } = props;
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
    <div className="cmp-slot" style={{ backgroundColor: typeTint(mon.types[0]) }}>
      <button className="cmp-pick" onClick={change} aria-label={`Change ${mon.name}`}>
        <img src={spriteUrl(mediaId)} alt="" width={96} height={96} />
      </button>
      <div className="no">{formatNo(species.id)}</div>
      <Link className="name" to={detailPath(species.id, form || undefined)}>
        {mon.name}
      </Link>
      <div className="types">
        {mon.types.map((t) => (
          <TypeChip key={t} type={t} />
        ))}
      </div>
      {species.forms && (
        <label className="cmp-form">
          <span className="sr-only">{species.name} form</span>
          <select value={form} onChange={(e) => onForm(e.target.value)}>
            {species.forms.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <Icon name="next" size={16} />
        </label>
      )}
    </div>
  );
}

/** How each one's types hit the other, strongest first. */
function Matchups({ a, b, data }: { a: SpeciesDetail; b: SpeciesDetail; data: TypeData }) {
  return (
    <div className="section">
      <h2>Type matchups</h2>
      {[
        [a, b],
        [b, a],
      ].map(([atk, def], i) => (
        <div className="eff-group" key={i}>
          <h3>
            {atk.name}'s types against {def.name}
          </h3>
          <ul className="cmp-hits">
            {typeHits(atk.types, def.types, data).map(({ type, mult }) => {
              const [label, tone] = hitLabel(mult);
              return (
                <li key={type}>
                  <TypeChip type={type} />
                  <span className={`cmp-mult ${tone}`}>{multText(mult)}</span>
                  <span className="cmp-hit-label">{label}</span>
                </li>
              );
            })}
          </ul>
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
