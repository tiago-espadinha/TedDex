import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { cap } from '../data/format';
import { nextNavScroll, type NavScroll } from '../data/navHide';
import { SEARCH_HINTS, SEARCH_OPERATORS, type HintList } from '../data/searchHints';
import { typeChip } from '../data/typeColors';
import type { MoveCategory, TypeName } from '../data/types';
import { Icon, type IconName } from './Icon';

/** How long `data-play` stays on: longer than any one-shot animation in styles.css. */
const PLAY_MS = 300;
const playing = new WeakMap<HTMLElement, number>();

/**
 * Plays a one-shot animation: the `[data-play='<name>']` rules in styles.css, restarted if it is
 * already running. Nothing at all under reduced motion. The attribute comes off afterwards, so
 * the element coming back from `display: none` doesn't play it again.
 */
export function playAnim(el: HTMLElement, name: string) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (el.dataset.play) {
    delete el.dataset.play;
    void el.offsetWidth;
  }
  el.dataset.play = name;
  clearTimeout(playing.get(el));
  playing.set(el, window.setTimeout(() => delete el.dataset.play, PLAY_MS));
}

/**
 * The count on a filter button. It bumps when the count changes, but filter sheets apply live and
 * cover the button, so while `held` (the sheet is open) the bump waits until the button shows.
 */
export function CountBadge({ count, held }: { count: number; held?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(count);
  useLayoutEffect(() => {
    if (held || shown.current === count) return;
    shown.current = count;
    if (ref.current) playAnim(ref.current, 'bump');
  }, [count, held]);
  if (count <= 0) return null;
  return (
    <span className="badge" aria-hidden="true" ref={ref}>
      {count}
    </span>
  );
}

const lastSegments = new Map<string, number>();

/**
 * Slides a `.segmented` control's selected background from the option selected before. It reads
 * the selection from the DOM, as the options are the caller's. `memory` keeps it across screens,
 * for links that each render their own control.
 */
export function useSegmentSlide<T extends HTMLElement>(memory?: string) {
  const ref = useRef<T>(null);
  const last = useRef(memory ? lastSegments.get(memory) : undefined);
  useLayoutEffect(() => {
    const options = [...(ref.current?.children ?? [])] as HTMLElement[];
    const index = options.findIndex((o) => o.matches('[aria-checked="true"], [aria-current="page"]'));
    if (index < 0) return;
    const on = options[index];
    const from = options[last.current ?? index];
    if (from && from !== on) {
      on.style.setProperty('--seg-x', `${from.offsetLeft - on.offsetLeft}px`);
      on.style.setProperty('--seg-w', `${from.offsetWidth / on.offsetWidth}`);
      playAnim(on, 'seg');
    }
    last.current = index;
    if (memory) lastSegments.set(memory, index);
  });
  return ref;
}

/** A `.segmented` radio group (`className` adds to it) whose selected background slides between options. */
export function Segmented({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useSegmentSlide<HTMLDivElement>();
  return <div ref={ref} className={className ? `segmented ${className}` : 'segmented'} role="radiogroup" {...props} />;
}

export function TypeChip({ type, large }: { type: TypeName; large?: boolean }) {
  return (
    <span className={large ? 'type-chip lg' : 'type-chip'} style={{ backgroundColor: typeChip(type) }}>
      {type}
    </span>
  );
}

const SIGN_ICON = { '♂': 'male', '♀': 'female' } as const;

/** A Pokémon's name with Nidoran's ♂/♀ drawn on the baseline: fonts lack them, and a fallback glyph sits off it. */
export function MonName({ name }: { name: string }) {
  return name.split(/([♂♀])/).map((part, i) =>
    part === '♂' || part === '♀' ? (
      <span key={i} className={`name-sign name-sign-${SIGN_ICON[part]}`}>
        {/* A word joiner: an inline svg is a break opportunity, the sign is not. */}
        {'\u2060'}
        <Icon name={SIGN_ICON[part]} />
        <span className="sr-only">{part}</span>
      </span>
    ) : (
      part
    ),
  );
}

/** A move's category as a coloured badge: labelled on its own, or `decorative` when the word sits beside it. */
export function CategoryIcon({ category, decorative }: { category: MoveCategory; decorative?: boolean }) {
  return (
    <span
      className={`cat-icon cat-${category}`}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': cap(category) })}
    >
      <Icon name={category} size={13} />
    </span>
  );
}

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Dex', icon: 'dex', end: true },
  { to: '/teams', label: 'Team', icon: 'team' },
  { to: '/reference', label: 'Guide', icon: 'book' },
  { to: '/more', label: 'Settings', icon: 'cog' },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="bottom-nav" aria-label="Main" onFocus={showNav}>
      <span className="nav-ink" aria-hidden="true" />
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          // A species page belongs to the Dex, like a move page to the Guide.
          className={({ isActive }) => (isActive || (n.to === '/' && pathname.startsWith('/pokemon/')) ? 'active' : '')}
          onClick={(e) => {
            if (!e.currentTarget.classList.contains('active')) playAnim(e.currentTarget, 'nav-bounce');
          }}
        >
          <span className="pill">
            <Icon name={n.icon} />
          </span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

let navScroll: NavScroll = { y: 0, away: false };

function setNavScroll(next: NavScroll) {
  navScroll = next;
  document.documentElement.classList.toggle('nav-away', next.away);
}

/** Brings the nav back, and takes the scroll from here: a list restoring its spot isn't scrolling down. */
export function showNav() {
  setNavScroll({ y: scrollY, away: false });
}

/** Slides the nav, and what is anchored above it, away on scrolling down (`.nav-away`). Once, in the shell. */
export function useNavHiding(locationKey: string) {
  useEffect(() => {
    const onScroll = () => {
      // iOS bounces past the bottom, and the way back would read as scrolling up.
      const y = Math.min(scrollY, document.documentElement.scrollHeight - innerHeight);
      // A focused tab stays on screen for whoever is scrolling with the keys.
      const stay = matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('.bottom-nav :focus-visible');
      setNavScroll(stay ? { y, away: false } : nextNavScroll(navScroll, y));
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);
  // After the screens' layout effects, so a spot they restored isn't read as a scroll.
  useLayoutEffect(showNav, [locationKey]);
}

// ---------- on-screen keyboard ----------
/**
 * While an input has focus, keeps `--kb-inset` (how much of the layout viewport's bottom the
 * on-screen keyboard covers) and `--vv-top` (how far iOS has panned the visible area down) on the
 * root, so sheets sit above the keyboard and the pinned search stays in view. Both are 0 otherwise,
 * and stay 0 where the keyboard shrinks the layout viewport itself (desktop, Firefox on Android). Once, in the shell.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const update = () => {
      const typing = document.activeElement instanceof HTMLInputElement;
      root.setProperty('--kb-inset', `${typing ? Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)) : 0}px`);
      root.setProperty('--vv-top', `${typing ? Math.round(vv.offsetTop) : 0}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    addEventListener('focusin', update);
    addEventListener('focusout', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      removeEventListener('focusin', update);
      removeEventListener('focusout', update);
    };
  }, []);
}

// ---------- search ----------
/** Length of the field's morph between its header slot and the pinned bar; matches `.search-bar`'s fade in styles.css. */
const PIN_MORPH_MS = 200;
/** How far a touch must move on the page before it closes the keyboard. */
const DRAG_BLUR_PX = 10;

/**
 * Like an iOS list, a drag anywhere but on the field closes the keyboard (blurs the field), so
 * scrolling shows the list and the pinned bar rather than panning under the keyboard.
 */
function useBlurOnDrag(field: RefObject<HTMLLabelElement | null>) {
  useEffect(() => {
    let startY: number | null = null;
    const onStart = (e: TouchEvent) => {
      startY = field.current?.contains(e.target as Node) ? null : e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      const at = document.activeElement as HTMLElement | null;
      if (startY === null || !at || !field.current?.contains(at)) return;
      if (Math.abs(e.touches[0].clientY - startY) >= DRAG_BLUR_PX) at.blur();
    };
    addEventListener('touchstart', onStart, { passive: true });
    addEventListener('touchmove', onMove, { passive: true });
    return () => {
      removeEventListener('touchstart', onStart);
      removeEventListener('touchmove', onMove);
    };
  }, [field]);
}

/**
 * Pins the search once its slot scrolls under the top of the screen (or under a sticky `.dex-top`
 * bar), and shows the back-to-top arrow after a screen's height. The field itself turns fixed, so
 * focus and typing carry over, and the slot keeps its height, so nothing below moves. The switch is a
 * FLIP of the field between the slot and the bar, both ways (none under reduced motion). One per page:
 * each adds its own arrow.
 */
function usePinnedSearch() {
  const slot = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLLabelElement>(null);
  const [pinTop, setPinTop] = useState<number>();
  const [toTop, setToTop] = useState(false);
  // Where the field was drawn before a pin or unpin, for the morph; unset on the first measure.
  const from = useRef<{ rect: DOMRect; radius: string }>(undefined);
  const morph = useRef<Animation>(undefined);
  // Before paint, so a list restored mid-scroll never shows the field unpinned for a frame.
  useLayoutEffect(() => {
    let frame = 0;
    // Unset until the first measure, which never morphs.
    let pinned: boolean | undefined;
    const measure = () => {
      frame = 0;
      const el = slot.current;
      if (!el) return;
      const bar = document.querySelector('.dex-top');
      // The app's top padding is the safe area.
      const top = (bar ? bar.getBoundingClientRect().bottom : parseFloat(getComputedStyle(el.closest('.app')!).paddingTop)) + 6;
      const pin = el.getBoundingClientRect().top < top;
      if (pinned !== undefined && pin !== pinned && field.current) {
        const rect = field.current.getBoundingClientRect();
        // A jump (a list restoring its scroll) pins straight away rather than flying in from off screen.
        if (rect.bottom > 0) from.current = { rect, radius: getComputedStyle(field.current).borderRadius };
      }
      pinned = pin;
      setPinTop(pin ? top : undefined);
      setToTop(scrollY > innerHeight);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };
    measure();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
    };
  }, []);

  const pinned = pinTop != null;
  useLayoutEffect(() => {
    const start = from.current;
    const el = field.current;
    from.current = undefined;
    if (!start || !el) return;
    morph.current?.cancel();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const end = el.getBoundingClientRect();
    // Width and height animate too, so the text is never squashed by a scale.
    morph.current = el.animate(
      [
        {
          transform: `translate(${start.rect.left - end.left}px, ${start.rect.top - end.top}px)`,
          width: `${start.rect.width}px`,
          height: `${start.rect.height}px`,
          borderRadius: start.radius,
        },
        { transform: 'none', width: `${end.width}px`, height: `${end.height}px`, borderRadius: getComputedStyle(el).borderRadius },
      ],
      { duration: PIN_MORPH_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
  }, [pinned]);

  return { slot, field, pinTop, toTop };
}

/**
 * Search field that sits in a screen's header row, next to its title. `trailing` goes inside the
 * field on the right (after the clear button), like the Dex grid/list toggle. Scrolled away, it
 * pins at the top in a compact form, and a back-to-top arrow appears above the filter button.
 * `hints` adds the "?" that opens the list's search tips.
 */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  trailing,
  hints,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  trailing?: ReactNode;
  hints?: HintList;
}) {
  const [hintsOpen, setHintsOpen] = useState(false);
  const { slot, field, pinTop, toTop } = usePinnedSearch();
  useBlurOnDrag(field);
  // The bar stays mounted at its last height, so it can fade out under the field on unpin.
  const [barTop, setBarTop] = useState(0);
  if (pinTop != null && pinTop !== barTop) setBarTop(pinTop);
  return (
    <div className="search-slot" ref={slot}>
      <div className={`search-bar${pinTop == null ? '' : ' on'}`} style={{ '--pin-top': `${barTop}px` } as CSSProperties} aria-hidden="true" />
      <label ref={field} className={`search in-head${pinTop == null ? '' : ' pinned'}`} style={{ top: pinTop == null ? undefined : `calc(${pinTop}px + var(--vv-top, 0px))` }}>
        <Icon name="search" size={20} />
        <input
          aria-label={label}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button className="icon-btn sm" aria-label="Clear search" onClick={() => onChange('')}>
            <Icon name="close" size={18} />
          </button>
        )}
        {hints && (
          <button className="icon-btn sm search-help" aria-label="Search tips" aria-haspopup="dialog" onClick={() => setHintsOpen(true)}>
            <Icon name="help" size={20} />
          </button>
        )}
        {trailing}
      </label>
      {hints && hintsOpen && <SearchHintSheet list={hints} onClose={() => setHintsOpen(false)} />}
      {toTop && (
        <button
          className="to-top"
          aria-label="Back to top"
          onClick={() => {
            const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
            scrollTo({ top: 0, behavior: instant ? 'instant' : 'smooth' });
            document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
          }}
        >
          <Icon name="up" size={22} />
        </button>
      )}
    </div>
  );
}

/** What a list's search takes: the operators, its keywords and examples that work there. */
function SearchHintSheet({ list, onClose }: { list: HintList; onClose: () => void }) {
  const [sheet, close] = useModalSheet<HTMLElement>(onClose);
  const titleId = useId();
  const { keywords, examples } = SEARCH_HINTS[list];
  return (
    <>
      <div className="scrim" onClick={() => close()} />
      <section ref={sheet} tabIndex={-1} className="sheet hint-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="handle" />
        <div className="sheet-head">
          <h2 id={titleId}>Search tips</h2>
          <button className="icon-btn" aria-label="Close" onClick={() => close()}>
            <Icon name="close" />
          </button>
        </div>
        <h3>Operators</h3>
        <dl className="hint-ops">
          {SEARCH_OPERATORS.map((o) => (
            <div key={o.sign}>
              <dt><code>{o.sign}</code></dt>
              <dd>{o.meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="hint">A space stays part of the name, so combine with &amp;.</p>
        <h3>Keywords</h3>
        <dl className="hint-words">
          {keywords.map((k) => (
            <div key={k.label}>
              <dt>{k.label}</dt>
              <dd>
                {k.words.map((w) => (
                  <code key={w}>{w}</code>
                ))}
                {k.note && <span>{k.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="hint">Any other word searches the names.</p>
        <h3>Examples</h3>
        <dl className="hint-examples">
          {examples.map((e) => (
            <div key={e.query}>
              <dt><code>{e.query}</code></dt>
              <dd>{e.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

// ---------- modal sheet ----------
/** Length of the `.sheet.closing` and `.sheet.dialog.closing` animations in styles.css. */
const SHEET_CLOSE_MS = 180;
/** How far a sheet must be dragged down to close. */
const DRAG_CLOSE_PX = 100;
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour for a sheet or dialog: Escape closes, the page behind doesn't scroll,
 * focus moves in (to a `data-autofocus` field, else the sheet), Tab stays inside, and
 * focus goes back to the opener on close (or to <main> if the opener is gone).
 * On touch, a downward drag while the sheet is scrolled to its top moves the sheet
 * with the finger and closes it past `DRAG_CLOSE_PX`, else springs back; under reduced motion
 * the sheet stays put and only the release counts. `drag: false` leaves that out, for a centred dialog.
 * Returns the sheet's ref and `close(then?)`, which plays the closing animation and then
 * calls `then` (default: `onClose`). Only the first call counts: a tap on the scrim while the
 * sheet sinks must not close it twice (the quick view would step back twice).
 */
export function useModalSheet<T extends HTMLElement>(onClose: () => void, { drag = true } = {}) {
  const ref = useRef<T>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const close = useCallback((then?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    const done = then ?? onCloseRef.current;
    if (!ref.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    ref.current.classList.add('closing');
    setTimeout(done, SHEET_CLOSE_MS);
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const sheet = ref.current;
    (sheet?.querySelector<HTMLElement>('[data-autofocus]') ?? sheet)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab' || !sheet) return;
      const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !sheet.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const stopDrag = drag && sheet ? dragToClose(sheet, () => close()) : undefined;
    return () => {
      stopDrag?.();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      (opener?.isConnected ? opener : document.querySelector('main'))?.focus();
    };
  }, [close, drag]);

  return [ref, close] as const;
}

/** Follows a downward touch drag on `sheet` and calls `close` past `DRAG_CLOSE_PX`; returns the cleanup. */
function dragToClose(sheet: HTMLElement, close: () => void) {
  const scrim = sheet.previousElementSibling as HTMLElement; // every sheet follows its .scrim
  let startX = 0;
  let startY: number | null = null;
  let dy = 0;
  let follow = true;
  let dragging = false;
  const scrolled = (from: EventTarget | null) => {
    for (let el = from as HTMLElement | null; el && sheet.contains(el); el = el.parentElement) {
      if (el.scrollTop > 0) return true;
    }
    return false;
  };
  const place = (y: number, animate: boolean) => {
    sheet.style.transition = scrim.style.transition = animate ? 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms' : 'none';
    sheet.style.transform = y ? `translateY(${y}px)` : '';
    scrim.style.opacity = y ? String(Math.max(0, 1 - y / sheet.offsetHeight)) : '';
  };
  const onStart = (e: TouchEvent) => {
    if (dragging) return; // a second finger mid-drag
    startX = e.touches[0].clientX;
    startY = e.touches.length === 1 && !scrolled(e.target) ? e.touches[0].clientY : null;
    dy = 0;
    follow = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  const onMove = (e: TouchEvent) => {
    if (startY === null) return;
    const d = e.touches[0].clientY - startY;
    if (!dragging) {
      if (Math.abs(d) < 6) return;
      if (d < Math.abs(e.touches[0].clientX - startX)) return void (startY = null); // up or sideways: not a close
      dragging = true;
    }
    e.preventDefault();
    dy = Math.max(0, d);
    if (follow) place(dy, false);
  };
  const onEnd = () => {
    if (dragging && dy >= DRAG_CLOSE_PX) close();
    else if (dragging && follow) place(0, true);
    startY = null;
    dragging = false;
  };
  sheet.addEventListener('touchstart', onStart, { passive: true });
  sheet.addEventListener('touchmove', onMove, { passive: false });
  sheet.addEventListener('touchend', onEnd);
  sheet.addEventListener('touchcancel', onEnd);
  return () => {
    sheet.removeEventListener('touchstart', onStart);
    sheet.removeEventListener('touchmove', onMove);
    sheet.removeEventListener('touchend', onEnd);
    sheet.removeEventListener('touchcancel', onEnd);
  };
}

// ---------- loading ----------
/** A spinning Poké Ball in the theme's colours; still under reduced motion. index.html repeats the markup for the boot screen. */
export function Spinner() {
  return (
    <svg className="spinner" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle className="ball-bottom" cx="24" cy="24" r="21" />
      <path className="ball-top" d="M3 24a21 21 0 0 1 42 0z" />
      <path className="ball-line" d="M3 24h42" />
      <circle className="ball-line" cx="24" cy="24" r="21" />
      <circle className="ball-line ball-button" cx="24" cy="24" r="6" />
    </svg>
  );
}

/** Screen reader status straight away; the spinner only if loading takes a moment. */
export function Loading({ minHeight }: { minHeight?: CSSProperties['minHeight'] }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="loading" role="status" style={{ minHeight }}>
      {visible && <Spinner />}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// ---------- toast ----------
interface ToastMsg {
  text: string;
  action?: { label: string; href: string };
}
const ToastCtx = createContext<(msg: ToastMsg) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<(ToastMsg & { key: number }) | null>(null);
  const show = useCallback((m: ToastMsg) => setMsg({ ...m, key: Date.now() }), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite">
        {msg && (
          <div className="toast" key={msg.key}>
            {msg.text}
            {msg.action && <Link to={msg.action.href}>{msg.action.label}</Link>}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
