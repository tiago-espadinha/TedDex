import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { typeChip } from '../data/typeColors';
import type { TypeName } from '../data/types';
import { Icon, type IconName } from './Icon';

export function TypeChip({ type, large }: { type: TypeName; large?: boolean }) {
  return (
    <span className={large ? 'type-chip lg' : 'type-chip'} style={{ backgroundColor: typeChip(type) }}>
      {type}
    </span>
  );
}

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Dex', icon: 'dex', end: true },
  { to: '/teams', label: 'Team', icon: 'team' },
  { to: '/reference', label: 'Reference', icon: 'book' },
  { to: '/more', label: 'More', icon: 'menu' },
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
 * Search field that sits in a screen's header row, next to its title. `trailing` goes inside the
 * field on the right (after the clear button), like the Dex grid/list toggle.
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
  return (
    <label className="search in-head">
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
  );
}

// ---------- modal sheet ----------
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour for a bottom sheet: Escape closes, the page behind doesn't scroll,
 * focus moves in (to a `data-autofocus` field, else the sheet), Tab stays inside, and
 * focus goes back to the opener on close (or to <main> if the opener is gone).
 */
export function useModalSheet<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const sheet = ref.current;
    (sheet?.querySelector<HTMLElement>('[data-autofocus]') ?? sheet)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close.current();
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
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      (opener?.isConnected ? opener : document.querySelector('main'))?.focus();
    };
  }, []);

  return ref;
}

// ---------- loading ----------
/** Screen reader status straight away; the visible text only if loading takes a moment. */
export function Loading({ minHeight }: { minHeight?: CSSProperties['minHeight'] }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="loading" role="status" style={{ minHeight }}>
      <span className={visible ? undefined : 'sr-only'}>Loading…</span>
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
