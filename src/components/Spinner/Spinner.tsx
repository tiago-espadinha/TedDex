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
