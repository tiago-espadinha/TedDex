import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ToastCtx, type ToastMsg } from '../../hooks/useToast';
import './Toast.css';

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
