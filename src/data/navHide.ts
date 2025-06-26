/** Scroll that moves the nav: enough to ignore a finger's jitter, and slow scrolling still adds up to it. */
const STEP_PX = 8;

export interface NavScroll {
  y: number;
  away: boolean;
}

/** Down slides the nav away, up and the top bring it back. */
export function nextNavScroll(prev: NavScroll, y: number): NavScroll {
  if (y <= 0) return { y: 0, away: false };
  const moved = y - prev.y;
  if (Math.abs(moved) < STEP_PX) return prev;
  return { y, away: moved > 0 };
}
