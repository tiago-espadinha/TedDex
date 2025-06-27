import type { ReactNode } from 'react';

/** Label-over-value facts in an entry header (moves, items). */
export function Facts({ facts }: { facts: [string, ReactNode][] }) {
  return (
    <dl className="head-facts">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
