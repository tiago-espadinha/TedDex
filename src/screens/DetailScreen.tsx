import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cryUrl, loadSpecies, loadTypes, useLoad } from '../data/api';
import { compareFrom } from '../data/compare';
import { matchupGroups } from '../data/coverage';
import { toggleFavourite } from '../data/db';
import { EGG_GROUP_COLOR, eggGroupSlug } from '../data/eggGroups';
import { useIsFavourite } from '../data/favourites';
import { neighbours } from '../data/dexState';
import { applyForm } from '../data/forms';
import { catchChance, evYieldParts, formatMultiplier, formatNo, genderText, statColor } from '../data/format';
import { STAT_COLOR, typeChip, typeTint } from '../data/typeColors';
import type { SpeciesDetail, TypeData, TypeName } from '../data/types';
import { Icon } from '../components/Icon';
import { Loading, MonName, TypeChip, playAnim, useToast } from '../components/bits';
import { usePager } from '../components/usePager';
import { usePeek } from '../components/usePeek';
import { MonImg } from '../components/MonImg';
import { EvolutionTab } from './EvolutionTab';
import { LocationsTab } from './LocationsTab';
import { MovesTab } from './MovesTab';
import { SharedGameSheet } from '../components/GamePicker';

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

export function DetailScreen() {
  const id = Number(useParams().id);
  const [params] = useSearchParams();
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
  const { prev, next } = neighbours(id, params.get('form') ?? undefined);
  // The heart follows the form shown; an unknown ?form= shows the default form, so it hearts that.
  const formParam = params.get('form');
  const formKey = formParam && mon?.forms?.some((f) => f.key === formParam) ? formParam : '';
  const favourite = useIsFavourite(id, formKey);
  // A sideways swipe on the hero steps through the Dex rows; the panel below pages through the tabs.
  const touch = useRef<Point | null>(null);
  const {
    ref: panelRef,
    target: selected,
    turn: showTab,
    handlers: swipe,
  } = usePager<HTMLDivElement>(TABS.indexOf(tab), TABS.length, (i) => setTab(TABS[i]));

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

  const go = (target?: string) => target && navigate(target, { replace: true });

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
  if (!mon) return <Loading />;

  // Every section follows the chosen form: Moves, Evolution and Locations use its own data when it has some.
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
          <button
            className="icon-btn"
            aria-label="Back"
            onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}
          >
            <Icon name="back" />
          </button>
          <div>
            <button
              className={playing ? 'icon-btn playing' : 'icon-btn'}
              aria-label={playing ? 'Playing cry' : 'Play cry'}
              onClick={playCry}
            >
              <Icon name="sound" />
            </button>
            <Link className="icon-btn" aria-label="Comparator" to={compareFrom({ id: mon.id, form: form?.key })}>
              <Icon name="compare" />
            </Link>
            <button
              className="icon-btn fav"
              aria-label="Favourite"
              aria-pressed={!!favourite}
              disabled={favourite === undefined}
              onClick={(e) => {
                if (!favourite) playAnim(e.currentTarget, 'heart');
                toggleFavourite(id, formKey);
              }}
            >
              <Icon name="heart" />
            </button>
          </div>
        </div>
        <div className="title">
          <div className="no">{formatNo(mon.id)}</div>
          <h1>
            <MonName name={view.name} />
          </h1>
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
        <div className="art-row">
          <StepLink to={prev} label="Previous" icon="back" />
          <MonImg
            id={mediaId}
            speciesId={mon.id}
            onArtworkFail={() => setNoArtworkFor(mediaId)}
            alt={view.name}
            width={184}
            height={184}
          />
          <StepLink to={next} label="Next" icon="next" />
        </div>
        {noArtworkFor === mediaId && <p className="art-note">Artwork isn't saved offline yet</p>}
      </section>

      <div
        className="tabs"
        role="tablist"
        aria-label="Sections"
        onKeyDown={onTabKey}
        style={{ '--tab': selected } as CSSProperties}
      >
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
          {tab === 'About' && <About mon={view} formKey={formKey} mediaId={mediaId} />}
          {tab === 'Stats' && <Stats mon={view} typeData={typeData} />}
          {tab === 'Moves' && <MovesTab key={mon.id} mon={view} formKey={formKey} />}
        </div>
      </div>
      <div style={{ height: 24 }} />
      <SharedGameSheet />
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
function StepLink({ to, label, icon }: { to?: string; label: string; icon: 'back' | 'next' }) {
  if (!to)
    return (
      <span className="nav-round" aria-disabled="true" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
    );
  return (
    <Link className="nav-round" to={to} replace aria-label={label}>
      <Icon name={icon} size={20} />
    </Link>
  );
}

const GENDER_ICON = { '♂': 'male', '♀': 'female' } as const;

/** genderText() with ♂ and ♀ as coloured icons; the symbols and the " · " separator stay as screen-reader text. */
function GenderRatio({ rate }: { rate: number }) {
  return (
    <span className="gender-ratio">
      {genderText(rate)
        .split(' · ')
        .map((share, i) => (
          <span key={i}>
            {i > 0 && <span className="sr-only"> · </span>}
            {share.split(/([♂♀])/).map((part, j) =>
              part === '♂' || part === '♀' ? (
                <span key={j} className={`gender gender-${GENDER_ICON[part]}`}>
                  <Icon name={GENDER_ICON[part]} size={20} />
                  <span className="sr-only">{part}</span>
                </span>
              ) : (
                part
              ),
            )}
          </span>
        ))}
    </span>
  );
}

/** A decorative bar under a fact; the value it shows is in the fact's text. */
function FactBar({ parts }: { parts: [width: number, className: string, color?: string][] }) {
  return (
    <span className="fact-bar" aria-hidden="true">
      {parts
        .filter(([w]) => w > 0)
        .map(([w, c, bg]) => (
          <span key={c} className={c} style={{ width: `${w}%`, backgroundColor: bg }} />
        ))}
    </span>
  );
}

/** Fact chips; one with a link (egg groups) opens that page. */
function Chips({ items }: { items: [text: string, color: TypeName, to?: string][] }) {
  return (
    <span className="fact-chips">
      {items.map(([t, c, to]) => {
        const props = { className: 'fact-chip', style: { backgroundColor: typeChip(c) }, children: t };
        return to ? <Link key={t} to={to} {...props} /> : <span key={t} {...props} />;
      })}
    </span>
  );
}

function Fact({ k, wide, children }: { k: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'fact wide' : 'fact'}>
      <div className="k">{k}</div>
      <div className="v">{children}</div>
    </div>
  );
}

/** The form shown, plain and shiny, in the Settings art style. */
function Appearance({ mon, mediaId }: { mon: SpeciesDetail; mediaId: number }) {
  return (
    <div className="section">
      <h2>Appearance</h2>
      <div className="looks">
        <figure className="look">
          <MonImg id={mediaId} speciesId={mon.id} alt={mon.name} loading="lazy" width={128} height={128} />
          <figcaption>Normal</figcaption>
        </figure>
        <figure className="look shiny">
          <MonImg
            id={mediaId}
            speciesId={mon.id}
            shiny
            alt={`Shiny ${mon.name}`}
            loading="lazy"
            width={128}
            height={128}
          />
          <figcaption>
            <Icon name="star" size={16} />
            Shiny
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

/** Description, appearance, evolution and locations, then the Training and Breeding facts, all of `mon` in form `formKey`. */
function About({ mon, formKey, mediaId }: { mon: SpeciesDetail; formKey: string; mediaId: number }) {
  const ev = evYieldParts(mon.evYield);
  const female = (mon.genderRate / 8) * 100;
  return (
    <>
      {mon.flavor && (
        <div className="section">
          <p className="flavor">{mon.flavor}</p>
        </div>
      )}
      <Appearance mon={mon} mediaId={mediaId} />
      <EvolutionTab mon={mon} formKey={formKey} />
      <LocationsTab key={mon.id} mon={mon} formKey={formKey} />
      <div className="section">
        <h2>Training</h2>
        <div className="facts">
          <Fact k="Leveling rate">{mon.growthRate}</Fact>
          <Fact k="EV yield">{ev.length ? <Chips items={ev.map((p) => [p.text, STAT_COLOR[p.stat]])} /> : 'None'}</Fact>
          <Fact k="Catch rate" wide>
            <span className="catch-line">
              {mon.catchRate}
              <small className="fact-note">{catchChance(mon.catchRate)} with a Poké Ball at full HP</small>
            </span>
            <FactBar parts={[[(mon.catchRate / 255) * 100, 'fill-catch', typeChip(mon.types[0])]]} />
          </Fact>
        </div>
      </div>
      <div className="section">
        <h2>Breeding</h2>
        <div className="facts">
          <Fact k="Egg groups">
            <Chips
              items={mon.eggGroups.map((g) => [g, EGG_GROUP_COLOR[g], `/reference/egg-groups/${eggGroupSlug(g)}`])}
            />
          </Fact>
          <Fact k="Gender ratio">
            <GenderRatio rate={mon.genderRate} />
            <FactBar
              parts={
                mon.genderRate < 0
                  ? [[100, 'fill-genderless']]
                  : [
                      [100 - female, 'fill-male'],
                      [female, 'fill-female'],
                    ]
              }
            />
          </Fact>
        </div>
      </div>
    </>
  );
}

function Stats({ mon, typeData }: { mon: SpeciesDetail; typeData?: TypeData }) {
  const peek = usePeek();
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
                <span
                  className="fill"
                  style={{ display: 'block', width: `${Math.min(100, (v / 180) * 100)}%`, background: statColor(v) }}
                />
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
            <button className="ability" key={a.name} onClick={() => peek({ kind: 'ability', id: a.id })}>
              {a.name}
              {a.hidden && <small>hidden</small>}
            </button>
          ))}
        </div>
      </div>

      {typeData && <Matchups types={mon.types} data={typeData} />}
    </>
  );
}

function Matchups({ types, data }: { types: TypeName[]; data: TypeData }) {
  return (
    <div className="section">
      <h2>Type matchups</h2>
      {matchupGroups(types, data).map((g) => (
        <div className="eff-group" key={g.label}>
          <h3>{g.label}</h3>
          <div className="chip-wrap">
            {g.hits.map(({ type: t, mult }) => (
              <span key={t} className="type-chip lg" style={{ backgroundColor: typeChip(t) }}>
                {t}
                {mult !== 2 && mult !== 0.5 && mult !== 0 ? ` ${formatMultiplier(mult)}` : ''}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
