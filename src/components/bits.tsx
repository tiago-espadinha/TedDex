import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { cap } from '../data/format';
import { typeChip } from '../data/typeColors';
import type { MoveCategory, TypeName } from '../data/types';
import { Icon, type IconName } from './Icon';

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
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="pill">
            <Icon name={n.icon} />
          </span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

// ---------- search ----------
/**
 * Pins the search once its slot scrolls under the top of the screen (or under a sticky `.dex-top`
 * bar), and shows the back-to-top arrow after a screen's height. The field itself turns fixed, so
 * focus and typing carry over, and the slot keeps its height, so nothing below moves. One per page: each
 * adds its own arrow.
 */
function usePinnedSearch() {
  const slot = useRef<HTMLDivElement>(null);
  const [pinTop, setPinTop] = useState<number>();
  const [toTop, setToTop] = useState(false);
  // Before paint, so a list restored mid-scroll never shows the field unpinned for a frame.
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = slot.current;
      if (!el) return;
      const bar = document.querySelector('.dex-top');
      // The app's top padding is the safe area.
      const top = (bar ? bar.getBoundingClientRect().bottom : parseFloat(getComputedStyle(el.closest('.app')!).paddingTop)) + 6;
      setPinTop(el.getBoundingClientRect().top < top ? top : undefined);
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
  return { slot, pinTop, toTop };
}

/**
 * Search field that sits in a screen's header row, next to its title. `trailing` goes inside the
 * field on the right (after the clear button), like the Dex grid/list toggle. Scrolled away, it
 * pins at the top in a compact form, and a back-to-top arrow appears above the filter button.
 */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  trailing?: ReactNode;
}) {
  const { slot, pinTop, toTop } = usePinnedSearch();
  return (
    <div className="search-slot" ref={slot}>
      <label className={`search in-head${pinTop == null ? '' : ' pinned'}`} style={{ top: pinTop }}>
        <Icon name="search" size={20} />
        <span className="sr-only">{label}</span>
        <input
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
        {trailing}
      </label>
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

// ---------- modal sheet ----------
/** Length of the `.sheet.closing` animation in styles.css. */
const SHEET_CLOSE_MS = 180;
/** How far a sheet must be dragged down to close. */
const DRAG_CLOSE_PX = 100;
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour for a bottom sheet: Escape closes, the page behind doesn't scroll,
 * focus moves in (to a `data-autofocus` field, else the sheet), Tab stays inside, and
 * focus goes back to the opener on close (or to <main> if the opener is gone).
 * On touch, a downward drag while the sheet is scrolled to its top moves the sheet
 * with the finger and closes it past `DRAG_CLOSE_PX`, else springs back; under reduced motion
 * the sheet stays put and only the release counts.
 * Returns the sheet's ref and `close(then?)`, which plays the closing animation and then
 * calls `then` (default: `onClose`). Only the first call counts: a tap on the scrim while the
 * sheet sinks must not close it twice (the quick view would step back twice).
 */
export function useModalSheet<T extends HTMLElement>(onClose: () => void) {
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
    const stopDrag = sheet && dragToClose(sheet, () => close());
    return () => {
      stopDrag?.();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      (opener?.isConnected ? opener : document.querySelector('main'))?.focus();
    };
  }, [close]);

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
