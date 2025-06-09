/**
 * The quick view sheet: a move, ability or item summary over the current screen, kept in the URL as
 * `?peek=<kind>-<id>` so Back closes it. Pure, for the sheet and its tests.
 */
export type PeekKind = 'move' | 'ability' | 'item';

export interface Peek {
  kind: PeekKind;
  id: number;
}

const PAGES: Record<PeekKind, string> = { move: 'moves', ability: 'abilities', item: 'items' };

export const peekValue = ({ kind, id }: Peek) => `${kind}-${id}`;

export function parsePeek(value: string | null): Peek | undefined {
  const m = /^(move|ability|item)-([1-9]\d*)$/.exec(value ?? '');
  return m ? { kind: m[1] as PeekKind, id: Number(m[2]) } : undefined;
}

/** The Guide page the sheet's "See Details" goes to. */
export const peekPage = ({ kind, id }: Peek) => `/reference/${PAGES[kind]}/${id}`;
