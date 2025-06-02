import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { artworkUrl, cryUrl, defensiveMultipliers, loadSpecies, loadTypes, spriteUrl, useLoad } from '../data/api';
import { addToTeam, currentTeamId, db } from '../data/db';
import { neighbours } from '../data/dexState';
import { applyForm } from '../data/forms';
import { evYieldText, formatMultiplier, formatNo, genderText } from '../data/format';
import { typeChip, typeTint } from '../data/typeColors';
import type { FormVariant, SpeciesDetail, TypeData, TypeName } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, TypeChip, useToast } from '../components/bits';
import { usePager } from '../components/usePager';
import { EvolutionTab } from './EvolutionTab';
import { LocationsTab } from './LocationsTab';
import { MovesTab } from './MovesTab';

const TABS = ['About', 'Stats', 'Moves'] as const;
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
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = sessionStorage.getItem(TAB_KEY) as Tab;
    return TABS.includes(saved) ? saved : 'Stats';
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    sessionStorage.setItem(TAB_KEY, t);
  };
  const navigate = useNavigate();
  const toast = useToast();
  const { prev, next } = neighbours(id);
  // A sideways swipe on the hero steps through species; the panel below pages through the tabs.
  const touch = useRef<Point | null>(null);
  const { ref: panelRef, target: selected, turn: showTab, handlers: swipe } = usePager<HTMLDivElement>(TABS.indexOf(tab), TABS.length, (i) => setTab(TABS[i]));

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
    const i = selected;
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const t = (to + TABS.length) % TABS.length;
    showTab(t);
    document.getElementById(`tab-${TABS[t]}`)?.focus();
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

  const [playing, setPlaying] = useState(false);
  function playCry() {
    const audio = new Audio(cryUrl(id));
    const stop = () => setPlaying(false);
    audio.addEventListener('ended', stop);
    setPlaying(true);
    audio.play().catch(() => {
      stop();
      toast({ text: navigator.onLine ? "This browser can't play the cry" : "This cry isn't saved offline yet" });
    });
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
          const step = swipeStep(touch.current, e.changedTouches[0]);
          touch.current = null;
          if (step) go(step > 0 ? next : prev);
        }}
      >
        <div className="bar">
          <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}>
            <Icon name="back" />
          </button>
          <div>
            <button className={playing ? 'icon-btn playing' : 'icon-btn'} aria-label={playing ? 'Playing cry' : 'Play cry'} onClick={playCry}>
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
          {view.genus && <p className="genus">{view.genus}</p>}
          <div className="types">
            {view.types.map((t) => (
              <TypeChip key={t} type={t} large />
            ))}
          </div>
          <dl className="size">
            <div>
              <dt>
                <Icon name="height" size={16} />
                <span className="sr-only">Height</span>
              </dt>
              <dd>{view.heightM} m</dd>
            </div>
            <div>
              <dt>
                <Icon name="weight" size={16} />
                <span className="sr-only">Weight</span>
              </dt>
              <dd>{view.weightKg} kg</dd>
            </div>
          </dl>
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

      <div className="tabs" role="tablist" aria-label="Sections" onKeyDown={onTabKey} style={{ '--tab': selected } as CSSProperties}>
        <span className="tab-ink" aria-hidden="true" />
        {TABS.map((t, i) => (
          <button
            key={t}
            id={`tab-${t}`}
            role="tab"
            aria-selected={selected === i}
            aria-controls="tab-panel"
            tabIndex={selected === i ? 0 : -1}
            onClick={() => showTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pager" {...swipe}>
        <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} ref={panelRef}>
          {tab === 'About' && <About mon={view} species={mon} />}
          {tab === 'Stats' && <Stats mon={view} typeData={typeData} />}
          {tab === 'Moves' && <MovesTab key={mon.id} mon={mon} />}
        </div>
      </div>
      <div style={{ height: 24 }} />
    </>
  );
}

interface Point {
  x: number;
  y: number;
}

/** 1 for a swipe to the left (next), -1 to the right (previous), 0 when the gesture is mostly vertical or short. */
function swipeStep(start: Point | null, end: { clientX: number; clientY: number }): number {
  if (!start) return 0;
  const dx = end.clientX - start.x;
  const dy = end.clientY - start.y;
  if (Math.abs(dx) <= 60 || Math.abs(dx) <= Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
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

/** Description, evolution and locations, then training and breeding facts. Evolution and locations stay species-level. */
function About({ mon, species }: { mon: SpeciesDetail; species: SpeciesDetail }) {
  const facts: [string, string][] = [
    ['Catch rate', String(mon.catchRate)],
    ['EV yield', evYieldText(mon.evYield)],
    ['Leveling rate', mon.growthRate],
    ['Egg groups', mon.eggGroups.join(', ')],
    ['Gender ratio', genderText(mon.genderRate)],
  ];
  return (
    <>
      {mon.flavor && (
        <div className="section">
          <p className="flavor">{mon.flavor}</p>
        </div>
      )}
      <EvolutionTab mon={species} />
      <LocationsTab key={species.id} mon={species} />
      <div className="section">
        <h2>Training and breeding</h2>
        <div className="facts">
          {facts.map(([k, v]) => (
            <div className="fact" key={k}>
              <div className="k">{k}</div>
              <div className="v">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </>
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
            <Link className="ability link" key={a.name} to={`/reference/abilities/${a.id}`}>
              {a.name}
              {a.hidden && <small>hidden</small>}
            </Link>
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
