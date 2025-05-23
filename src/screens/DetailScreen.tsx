import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { artworkUrl, cryUrl, defensiveMultipliers, loadSpecies, loadTypes, spriteUrl, useLoad } from '../data/api';
import { addToTeam, currentTeamId, db } from '../data/db';
import { neighbours } from '../data/dexState';
import { applyForm } from '../data/forms';
import { formatMultiplier, formatNo, roman } from '../data/format';
import { typeChip, typeTint } from '../data/typeColors';
import type { FormVariant, SpeciesDetail, TypeData, TypeName } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip, useToast } from '../components/bits';
import { EvolutionTab } from './EvolutionTab';
import { LocationsTab } from './LocationsTab';
import { MovesTab } from './MovesTab';

const TABS = ['About', 'Stats', 'Moves', 'Evolution', 'Locations'] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY = 'detail-tab';

const STAT_ROWS: [keyof SpeciesDetail['stats'], string][] = [
  ['hp', 'HP'],
  ['atk', 'Attack'],
  ['def', 'Defense'],
  ['spa', 'Sp. Atk'],
  ['spd', 'Sp. Def'],
  ['spe', 'Speed'],
];

const statColor = (v: number) => (v >= 90 ? 'var(--stat-high)' : v >= 60 ? 'var(--stat-mid)' : 'var(--stat-low)');

export function DetailScreen() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const { data: mon, error } = useLoad(() => loadSpecies(id), id);
  const { data: typeData } = useLoad(loadTypes, 'types');
  const [tab, setTabState] = useState<Tab>(() => (sessionStorage.getItem(TAB_KEY) as Tab) || 'Stats');
  const setTab = (t: Tab) => {
    setTabState(t);
    sessionStorage.setItem(TAB_KEY, t);
  };
  const navigate = useNavigate();
  const toast = useToast();
  const { prev, next } = neighbours(id);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);
  // Fetch the whole cry once so the service worker caches it: Safari's own audio requests are
  // byte ranges, which aren't cacheable. Offline before first view is fine, the cry button toasts.
  const monId = mon?.id;
  useEffect(() => {
    if (monId) fetch(cryUrl(monId)).catch(() => {});
  }, [monId]);
  // Offline, artwork that was never viewed isn't cached: show the precached sprite and say so.
  const [noArtworkFor, setNoArtworkFor] = useState<number>();

  const go = (target?: number) => target && navigate(`/pokemon/${target}`, { replace: true });
  const pickForm = (key: string) => setParams(key ? { form: key } : {}, { replace: true });

  /** Arrow keys, Home and End move between tabs (ARIA tabs pattern, selection follows focus). */
  function onTabKey(e: KeyboardEvent) {
    const i = TABS.indexOf(tab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const t = TABS[(to + TABS.length) % TABS.length];
    setTab(t);
    const el = document.getElementById(`tab-${t}`);
    el?.focus();
    // focus() alone leaves a tab scrolled out of the overflowing row at 375 px.
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** Adds this species, in the form shown (`formKey`), to the most recently edited team. */
  async function addToCurrentTeam(formKey?: string) {
    const teamId = await currentTeamId();
    const team = await db.teams.get(teamId);
    const ok = await addToTeam(teamId, id, formKey);
    toast(
      ok
        ? { text: `Added to ${team?.name ?? 'team'}`, action: { label: 'View', href: `/teams/${teamId}` } }
        : { text: `${team?.name ?? 'That team'} is full`, action: { label: 'Open', href: `/teams/${teamId}` } },
    );
  }

  function playCry() {
    const audio = new Audio(cryUrl(id));
    audio.play().catch(() =>
      toast({ text: navigator.onLine ? "This browser can't play the cry" : "This cry isn't saved offline yet" }),
    );
  }

  if (error) return <p className="empty">Couldn't load this Pokémon. {error.message}</p>;
  if (!mon) return <Loading minHeight="100dvh" />;

  // Moves and Evolution stay species-level; the hero, About and Stats follow the chosen form.
  const { view, form, mediaId } = applyForm(mon, params.get('form'));
  const tint = typeTint(view.types[0]);

  return (
    <>
      <section
        className="detail-hero"
        style={{ backgroundColor: tint, paddingTop: 'var(--safe-top)', marginTop: 'calc(-1 * var(--safe-top))' }}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? next : prev);
        }}
      >
        <div className="bar">
          <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}>
            <Icon name="back" />
          </button>
          <div>
            <button className="icon-btn" aria-label="Play cry" onClick={playCry}>
              <Icon name="sound" />
            </button>
            <button className="icon-btn" aria-label="Add to team" onClick={() => addToCurrentTeam(form?.key)}>
              <Icon name="plus" />
            </button>
          </div>
        </div>
        <div className="title">
          <div className="no">{formatNo(mon.id)}</div>
          <h1>{view.name}</h1>
          <div className="types">
            {view.types.map((t) => (
              <TypeChip key={t} type={t} large />
            ))}
          </div>
        </div>
        {mon.forms && <FormPicker forms={mon.forms} current={form?.key ?? ''} onPick={pickForm} />}
        <div className="art-row">
          <StepLink to={prev} label="Previous" icon="back" />
          {noArtworkFor === mediaId ? (
            <img className="sprite" src={spriteUrl(mediaId)} alt={view.name} width={184} height={184} />
          ) : (
            <img src={artworkUrl(mediaId)} onError={() => setNoArtworkFor(mediaId)} alt={view.name} width={184} height={184} />
          )}
          <StepLink to={next} label="Next" icon="next" />
        </div>
        {noArtworkFor === mediaId && <p className="art-note">Artwork isn't saved offline yet</p>}
      </section>

      <div className="tabs" ref={trackScrollEdges} role="tablist" aria-label="Sections" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls="tab-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'About' && <About mon={view} />}
        {tab === 'Stats' && <Stats mon={view} typeData={typeData} />}
        {tab === 'Moves' && <MovesTab key={mon.id} mon={mon} />}
        {tab === 'Evolution' && <EvolutionTab mon={mon} />}
        {tab === 'Locations' && <LocationsTab key={mon.id} mon={mon} />}
      </div>
      <div style={{ height: 24 }} />
    </>
  );
}

/**
 * Ref callback for a horizontal scroller: sets `data-more` to the end(s) with content scrolled out
 * of view ('start', 'end' or 'both'), so CSS can fade that edge. Observes the children too, since a
 * late web font widens them without resizing the scroller.
 */
function trackScrollEdges(el: HTMLElement | null) {
  if (!el) return;
  const update = () => {
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    if (start || end) el.dataset.more = start && end ? 'both' : start ? 'start' : 'end';
    else delete el.dataset.more;
  };
  const observer = new ResizeObserver(update);
  observer.observe(el);
  for (const child of el.children) observer.observe(child);
  el.addEventListener('scroll', update, { passive: true });
  return () => {
    observer.disconnect();
    el.removeEventListener('scroll', update);
  };
}

/** Prev/next arrow; at either end of the list it is shown dimmed and leaves the tab order. */
function StepLink({ to, label, icon }: { to?: number; label: string; icon: 'back' | 'next' }) {
  if (!to)
    return (
      <span className="nav-round" aria-disabled="true" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
    );
  return (
    <Link className="nav-round" to={`/pokemon/${to}`} replace aria-label={label}>
      <Icon name={icon} size={20} />
    </Link>
  );
}

/** One toggle button per form; the default form has the empty key. */
function FormPicker({ forms, current, onPick }: { forms: FormVariant[]; current: string; onPick: (key: string) => void }) {
  return (
    <div className="form-row" role="group" aria-label="Forms">
      {forms.map((f) => (
        <button key={f.key} type="button" className="form-btn" aria-pressed={f.key === current} onClick={() => onPick(f.key)}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

function About({ mon }: { mon: SpeciesDetail }) {
  return (
    <div className="section">
      {mon.flavor && <p className="flavor">{mon.flavor}</p>}
      <div className="facts">
        <div className="fact">
          <div className="k">Category</div>
          <div className="v">{mon.genus || '—'}</div>
        </div>
        <div className="fact">
          <div className="k">Introduced</div>
          <div className="v">Gen {roman(mon.gen)}</div>
        </div>
        <div className="fact">
          <div className="k">Height</div>
          <div className="v">{mon.heightM} m</div>
        </div>
        <div className="fact">
          <div className="k">Weight</div>
          <div className="v">{mon.weightKg} kg</div>
        </div>
      </div>
    </div>
  );
}

function Stats({ mon, typeData }: { mon: SpeciesDetail; typeData?: TypeData }) {
  return (
    <>
      <div className="section">
        {STAT_ROWS.map(([k, label]) => {
          const v = mon.stats[k];
          return (
            <div className="stat-row" key={k}>
              <span className="label">{label}</span>
              <span className="val">{v}</span>
              <span className="track">
                <span className="fill" style={{ display: 'block', width: `${Math.min(100, (v / 180) * 100)}%`, background: statColor(v) }} />
              </span>
            </div>
          );
        })}
        <div className="stat-row total">
          <span className="label">Total</span>
          <span className="val">{mon.total}</span>
          <span />
        </div>
      </div>

      <div className="section">
        <h2>Abilities</h2>
        <div className="ability-row">
          {!mon.abilities.length && <p className="hint">Not in the data yet</p>}
          {mon.abilities.map((a) => (
            <span className="ability" key={a.name}>
              {a.name}
              {a.hidden && <small>hidden</small>}
            </span>
          ))}
        </div>
      </div>

      {typeData && <Matchups types={mon.types} data={typeData} />}
    </>
  );
}

function Matchups({ types, data }: { types: TypeName[]; data: TypeData }) {
  const mult = defensiveMultipliers(types, data);
  const groups: { label: string; test: (m: number) => boolean }[] = [
    { label: 'Weak to', test: (m) => m > 1 },
    { label: 'Resists', test: (m) => m > 0 && m < 1 },
    { label: 'Immune to', test: (m) => m === 0 },
  ];
  return (
    <div className="section">
      <h2>Type matchups</h2>
      {groups.map((g) => {
        const hits = data.types.filter((t) => g.test(mult[t])).sort((a, b) => mult[b] - mult[a]);
        if (!hits.length) return null;
        return (
          <div className="eff-group" key={g.label}>
            <h3>{g.label}</h3>
            <div className="chip-wrap">
              {hits.map((t) => (
                <span key={t} className="type-chip lg" style={{ backgroundColor: typeChip(t) }}>
                  {t}
                  {mult[t] !== 2 && mult[t] !== 0.5 && mult[t] !== 0 ? ` ${formatMultiplier(mult[t])}` : ''}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
