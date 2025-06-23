/** Inline stroke icons (no icon font, so they work offline from first launch). */
const paths = {
  /* The Dex view toggle: two rows of two squares. For the list shape the squares' inner sides fade and two edges
     grow across the gap, so a row reads as one bar, drawn with transforms only (.view-toggle in styles.css). */
  view: [0, 11].map((y) => (
    <g key={y} transform={`translate(0 ${y})`}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3" />
      <path className="inner" d="M8 3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2M16 3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2" />
      <path className="bridge" d="M8 3h8M8 10h8" />
    </g>
  )),
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1 1-1.1 1.8M12 17h.01" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  compare: <path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />,
  more: (
    <>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
    </>
  ),
  dex: (
    <>
      <path d="M4.5 5a2.5 2.5 0 012.5-2.5h4l2 3h4A2.5 2.5 0 0119.5 8v11a2.5 2.5 0 01-2.5 2.5H7A2.5 2.5 0 014.5 19z" />
      <circle cx="8.5" cy="7.5" r="2" />
      <path d="M4.5 12.5h15" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  team: (
    <>
      <path d="M14.1 6.4A6.2 6.2 0 1 0 6.4 14.1M1.8 8h4.6M9.6 8h3.1" />
      <circle cx="8" cy="8" r="1.6" />
      <circle cx="16" cy="16" r="6.2" />
      <path d="M9.8 16h4.6M17.6 16h4.6" />
      <circle cx="16" cy="16" r="1.6" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
      <path d="M9 9h6M9 13h6" />
    </>
  ),
  cog: (
    <>
      <path d="M13.39 4.94L14.58 2.86L16.64 3.71L16.01 6.02L17.98 7.99L20.29 7.36L21.14 9.42L19.06 10.61L19.06 13.39L21.14 14.58L20.29 16.64L17.98 16.01L16.01 17.98L16.64 20.29L14.58 21.14L13.39 19.06L10.61 19.06L9.42 21.14L7.36 20.29L7.99 17.98L6.02 16.01L3.71 16.64L2.86 14.58L4.94 13.39L4.94 10.61L2.86 9.42L3.71 7.36L6.02 7.99L7.99 6.02L7.36 3.71L9.42 2.86L10.61 4.94z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h6M15 12h6" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />,
  height: (
    <g transform="rotate(-45 12 12)">
      <rect x="3" y="8" width="18" height="8" rx="1.5" />
      <path d="M7 8v3M11 8v4.5M15 8v3" />
    </g>
  ),
  weight: (
    <>
      <path d="M9 8a3 3 0 016 0" />
      <path d="M6.5 8h11L20 20H4z" />
    </>
  ),
  trash: (
    <>
      <path d="M10 11v6M14 11v6M7 7l1 13h8l1-13" />
      <path className="lid" d="M5 7h14M9 7V4h6v3" />
    </>
  ),
  // Move categories (drawn on a coloured badge by CategoryIcon), each stretched along a 30° diagonal:
  // a spike bubble, rings, an oval split by an S-curve with one side filled.
  physical: (
    <path
      transform="rotate(-30 12 12)"
      d="M23.5 12 17.7 13.4 20.1 17.3 14.4 15.3 12 19.5 9.6 15.3 3.9 17.3 6.3 13.4 0.5 12 6.3 10.6 3.9 6.7 9.6 8.7 12 4.5 14.4 8.7 20.1 6.7 17.7 10.6z"
    />
  ),
  special: (
    <g transform="rotate(-30 12 12)">
      <ellipse cx="12" cy="12" rx="10" ry="6.5" />
      <ellipse cx="12" cy="12" rx="4.5" ry="2.5" />
    </g>
  ),
  status: (
    <g transform="rotate(150 12 12)">
      <ellipse cx="12" cy="12" rx="10" ry="7" strokeWidth="2" />
      <path d="M2 12a5 3.5 0 0110 0 5 3.5 0 0010 0 10 7 0 00-20 0z" fill="currentColor" stroke="none" />
    </g>
  ),
  male: (
    <g strokeWidth="2.75">
      <circle cx="10" cy="14" r="6" />
      <path d="M14.5 9.5L20 4M15 4h5v5" />
    </g>
  ),
  female: (
    <g strokeWidth="2.75">
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7M8.5 18.5h7" />
    </g>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
