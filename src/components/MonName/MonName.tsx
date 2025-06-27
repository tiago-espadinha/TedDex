import { Icon } from '../Icon/Icon';

const SIGN_ICON = { '♂': 'male', '♀': 'female' } as const;

/** A Pokémon's name with Nidoran's ♂/♀ drawn on the baseline: fonts lack them, and a fallback glyph sits off it. */
export function MonName({ name }: { name: string }) {
  return name.split(/([♂♀])/).map((part, i) =>
    part === '♂' || part === '♀' ? (
      <span key={i} className={`name-sign name-sign-${SIGN_ICON[part]}`}>
        {/* A word joiner: an inline svg is a break opportunity, the sign is not. */}
        {'\u2060'}
        <Icon name={SIGN_ICON[part]} />
        <span className="sr-only">{part}</span>
      </span>
    ) : (
      part
    ),
  );
}
