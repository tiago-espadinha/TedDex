import { useCallback, useEffect, useRef } from 'react';

/** Length of the `.sheet.closing` and `.sheet.dialog.closing` animations in styles/primitives.css. */
const SHEET_CLOSE_MS = 180;

/** How far a sheet must be dragged down to close. */
const DRAG_CLOSE_PX = 100;

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

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
    sheet.style.transition = scrim.style.transition = animate
      ? 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms'
      : 'none';
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
