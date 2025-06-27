import { useEffect, useState, type CSSProperties } from 'react';
import { Spinner } from '../Spinner/Spinner';

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
