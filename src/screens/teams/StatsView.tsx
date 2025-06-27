import { averageStats } from '../../data/coverage';
import { STAT_ROWS, statColor } from '../../data/format';
import type { MemberView } from '../../data/forms';

/** The members' mean base stats as Stats-tab bars. */
export function StatsView({ mons }: { mons: MemberView[] }) {
  const { stats, total } = averageStats(mons);
  return (
    <div className="section">
      <h2>Average base stats</h2>
      {STAT_ROWS.map(([k, label]) => (
        <div className="stat-row" key={k}>
          <span className="label">{label}</span>
          <span className="val">{stats[k]}</span>
          <span className="track">
            <span
              className="fill"
              style={{
                display: 'block',
                width: `${Math.min(100, (stats[k] / 180) * 100)}%`,
                background: statColor(stats[k]),
              }}
            />
          </span>
        </div>
      ))}
      <div className="stat-row total">
        <span className="label">Total</span>
        <span className="val">{total}</span>
        <span />
      </div>
    </div>
  );
}
